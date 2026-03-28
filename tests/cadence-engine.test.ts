import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SequenceWithRelations } from "@/lib/repositories";

const {
  mockFindActiveByContactId,
  mockSequenceCreate,
  mockCreateStep,
  mockUpdateStep,
  mockUpdateNextStep,
  mockFindById,
  mockUpdateStatus,
  mockFindDueForAdvance,
  mockFindByContactId,
  mockGenerateFollowUpEmail,
  mockPrismaInteractionFindMany,
  mockPrismaNudgeFindMany,
  mockPrismaNudgeCreate,
} = vi.hoisted(() => ({
  mockFindActiveByContactId: vi.fn(),
  mockSequenceCreate: vi.fn(),
  mockCreateStep: vi.fn(),
  mockUpdateStep: vi.fn(),
  mockUpdateNextStep: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockFindDueForAdvance: vi.fn(),
  mockFindByContactId: vi.fn(),
  mockGenerateFollowUpEmail: vi.fn(),
  mockPrismaInteractionFindMany: vi.fn(),
  mockPrismaNudgeFindMany: vi.fn(),
  mockPrismaNudgeCreate: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  sequenceRepo: {
    findActiveByContactId: mockFindActiveByContactId,
    create: mockSequenceCreate,
    createStep: mockCreateStep,
    updateStep: mockUpdateStep,
    updateNextStep: mockUpdateNextStep,
    findById: mockFindById,
    updateStatus: mockUpdateStatus,
    findDueForAdvance: mockFindDueForAdvance,
    findByPartnerId: vi.fn(),
  },
  nudgeRepo: {},
  interactionRepo: {
    findByContactId: mockFindByContactId,
  },
}));

vi.mock("@/lib/services/llm-service", () => ({
  generateFollowUpEmail: mockGenerateFollowUpEmail,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    interaction: {
      findMany: mockPrismaInteractionFindMany,
    },
    nudge: {
      findMany: mockPrismaNudgeFindMany,
      create: mockPrismaNudgeCreate,
    },
  },
}));

function baseContact() {
  return {
    id: "contact-1",
    partnerId: "partner-1",
    name: "Alex Rivera",
    title: "VP",
    importance: "HIGH",
    companyId: "co-1",
    lastContacted: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    company: {
      id: "co-1",
      name: "Acme Corp",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

function baseSequence(overrides: Partial<SequenceWithRelations> = {}): SequenceWithRelations {
  const contact = baseContact();
  return {
    id: "seq-1",
    contactId: contact.id,
    partnerId: "partner-1",
    originNudgeId: "nudge-1",
    status: "ACTIVE",
    currentStep: 0,
    totalSteps: 4,
    angleStrategy: "value-add",
    nextStepAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    contact,
    steps: [],
    ...overrides,
  } as SequenceWithRelations;
}

describe("cadence-engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateFollowUpEmail.mockResolvedValue({
      subject: "Follow up",
      body: "Hello there",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("kickoffSequence", () => {
    it("returns alreadyActive when a sequence already exists for the contact", async () => {
      const existing = baseSequence({ id: "existing" });
      mockFindActiveByContactId.mockResolvedValue(existing);

      const { kickoffSequence } = await import("@/lib/services/cadence-engine");
      const result = await kickoffSequence({
        contactId: "contact-1",
        partnerId: "partner-1",
        originNudgeId: "n-1",
        angleStrategy: "check-in",
      });

      expect(result).toEqual({ sequence: existing, alreadyActive: true });
      expect(mockSequenceCreate).not.toHaveBeenCalled();
    });

    it("creates sequence and step 0, schedules next step at now when not alreadySent", async () => {
      mockFindActiveByContactId.mockResolvedValue(null);
      const createdSeq = { ...baseSequence(), steps: undefined } as unknown as Awaited<
        ReturnType<typeof mockSequenceCreate>
      >;
      mockSequenceCreate.mockResolvedValue(createdSeq);
      const step0 = {
        id: "step-0",
        sequenceId: createdSeq.id,
        stepNumber: 0,
        type: "INITIAL",
        status: "PENDING",
        scheduledAt: new Date(),
        executedAt: null,
        emailSubject: "Subj",
        emailBody: "Body",
        responseDetectedAt: null,
        createdAt: new Date(),
      };
      mockCreateStep.mockResolvedValue(step0);

      const { kickoffSequence } = await import("@/lib/services/cadence-engine");
      const now = new Date("2025-01-15T12:00:00Z");
      vi.setSystemTime(now);

      const result = await kickoffSequence({
        contactId: "contact-1",
        partnerId: "partner-1",
        originNudgeId: "n-1",
        angleStrategy: "check-in",
        initialSubject: "Subj",
        initialBody: "Body",
      });

      expect(mockSequenceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: "contact-1",
          partnerId: "partner-1",
          originNudgeId: "n-1",
          angleStrategy: "check-in",
          totalSteps: 4,
        })
      );
      expect(mockCreateStep).toHaveBeenCalledWith(
        expect.objectContaining({
          sequenceId: createdSeq.id,
          stepNumber: 0,
          type: "INITIAL",
          emailSubject: "Subj",
          emailBody: "Body",
        })
      );
      expect(mockUpdateStep).not.toHaveBeenCalled();
      expect(mockUpdateNextStep).toHaveBeenCalledWith(createdSeq.id, 0, now);
      expect(result.alreadyActive).toBe(false);
      expect(result.sequence).toBe(createdSeq);
      expect(result.step).toBe(step0);
    });

    it("marks step 0 SENT and schedules follow-up when alreadySent is true", async () => {
      mockFindActiveByContactId.mockResolvedValue(null);
      const createdSeq = { ...baseSequence(), steps: undefined } as unknown as Awaited<
        ReturnType<typeof mockSequenceCreate>
      >;
      mockSequenceCreate.mockResolvedValue(createdSeq);
      const step0 = {
        id: "step-0",
        sequenceId: createdSeq.id,
        stepNumber: 0,
        type: "INITIAL",
        status: "PENDING",
        scheduledAt: new Date(),
        executedAt: null,
        emailSubject: null,
        emailBody: null,
        responseDetectedAt: null,
        createdAt: new Date(),
      };
      mockCreateStep.mockResolvedValue(step0);

      const { kickoffSequence } = await import("@/lib/services/cadence-engine");
      const now = new Date("2025-01-15T12:00:00Z");
      vi.setSystemTime(now);

      await kickoffSequence({
        contactId: "contact-1",
        partnerId: "partner-1",
        originNudgeId: "n-1",
        angleStrategy: "check-in",
        alreadySent: true,
      });

      expect(mockUpdateStep).toHaveBeenCalledWith(step0.id, {
        status: "SENT",
        executedAt: now,
      });
      const expectedNext = new Date(now);
      expectedNext.setDate(expectedNext.getDate() + 3);
      expect(mockUpdateNextStep).toHaveBeenCalledWith(createdSeq.id, 0, expectedNext);
    });
  });

  describe("advanceSequence", () => {
    it("completes when next step is past totalSteps without calling LLM", async () => {
      const seq = baseSequence({
        currentStep: 3,
        totalSteps: 4,
        steps: [
          {
            id: "s0",
            sequenceId: "seq-1",
            stepNumber: 0,
            type: "INITIAL",
            status: "SENT",
            scheduledAt: new Date(),
            executedAt: new Date(),
            emailSubject: "A",
            emailBody: "a",
            responseDetectedAt: null,
            createdAt: new Date(),
          },
        ],
      });
      mockFindById.mockResolvedValue(seq);

      const { advanceSequence } = await import("@/lib/services/cadence-engine");
      const result = await advanceSequence("seq-1");

      expect(result?.completed).toBe(true);
      expect(mockUpdateStatus).toHaveBeenCalledWith("seq-1", "COMPLETED", expect.any(Date));
      expect(mockGenerateFollowUpEmail).not.toHaveBeenCalled();
      expect(mockCreateStep).not.toHaveBeenCalled();
    });

    it("advances to next step and creates draft from LLM", async () => {
      const seq = baseSequence({
        currentStep: 0,
        steps: [
          {
            id: "s0",
            sequenceId: "seq-1",
            stepNumber: 0,
            type: "INITIAL",
            status: "SENT",
            scheduledAt: new Date(),
            executedAt: new Date(),
            emailSubject: "Hi",
            emailBody: "First email body",
            responseDetectedAt: null,
            createdAt: new Date(),
          },
        ],
      });
      mockFindById.mockResolvedValue(seq);
      mockFindByContactId.mockResolvedValue([
        {
          id: "int-1",
          contactId: "contact-1",
          type: "EMAIL",
          date: new Date(),
          summary: "They replied",
        },
      ]);
      const newStep = {
        id: "s1",
        sequenceId: "seq-1",
        stepNumber: 1,
        type: "FOLLOW_UP_1",
        status: "PENDING",
        scheduledAt: new Date(),
        executedAt: null,
        emailSubject: "Follow up",
        emailBody: "Hello there",
        responseDetectedAt: null,
        createdAt: new Date(),
      };
      mockCreateStep.mockResolvedValue(newStep);

      const { advanceSequence } = await import("@/lib/services/cadence-engine");
      vi.setSystemTime(new Date("2025-01-10T12:00:00Z"));

      const result = await advanceSequence("seq-1");

      expect(result?.completed).toBe(false);
      expect(mockGenerateFollowUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          contactName: "Alex Rivera",
          stepNumber: 1,
          stepType: "FOLLOW_UP_1",
          previousEmails: ["First email body"],
        })
      );
      expect(mockCreateStep).toHaveBeenCalledWith(
        expect.objectContaining({
          stepNumber: 1,
          type: "FOLLOW_UP_1",
          emailSubject: "Follow up",
          emailBody: "Hello there",
        })
      );
      expect(mockUpdateNextStep).toHaveBeenCalledWith(
        "seq-1",
        1,
        expect.any(Date)
      );
      expect(result?.step).toBe(newStep);
    });

    it("returns null when sequence missing or not ACTIVE", async () => {
      mockFindById.mockResolvedValue(null);
      const { advanceSequence } = await import("@/lib/services/cadence-engine");
      expect(await advanceSequence("missing")).toBeNull();

      mockFindById.mockResolvedValue(baseSequence({ status: "COMPLETED" }));
      expect(await advanceSequence("seq-1")).toBeNull();
    });
  });

  describe("recordResponse", () => {
    it("marks current step RESPONDED and sequence RESPONDED", async () => {
      const currentStep = {
        id: "cur",
        sequenceId: "seq-1",
        stepNumber: 1,
        type: "FOLLOW_UP_1",
        status: "SENT",
        scheduledAt: new Date(),
        executedAt: new Date(),
        emailSubject: "S",
        emailBody: "B",
        responseDetectedAt: null,
        createdAt: new Date(),
      };
      const seq = baseSequence({ currentStep: 1, steps: [currentStep] });
      mockFindById.mockResolvedValue(seq);

      const { recordResponse } = await import("@/lib/services/cadence-engine");
      const result = await recordResponse("seq-1");

      expect(mockUpdateStep).toHaveBeenCalledWith("cur", {
        responseDetectedAt: expect.any(Date),
        status: "RESPONDED",
      });
      expect(mockUpdateStatus).toHaveBeenCalledWith("seq-1", "RESPONDED", expect.any(Date));
      expect(result?.sequence).toBe(seq);
    });
  });

  describe("pauseSequence / resumeSequence / archiveSequence", () => {
    it("pauseSequence sets PAUSED", async () => {
      const { pauseSequence } = await import("@/lib/services/cadence-engine");
      await pauseSequence("seq-1");
      expect(mockUpdateStatus).toHaveBeenCalledWith("seq-1", "PAUSED");
    });

    it("resumeSequence reschedules next step and sets ACTIVE", async () => {
      const seq = baseSequence({ status: "PAUSED", currentStep: 2 });
      mockFindById.mockResolvedValue(seq);
      const { resumeSequence } = await import("@/lib/services/cadence-engine");
      vi.setSystemTime(new Date("2025-03-01T10:00:00Z"));
      await resumeSequence("seq-1");
      expect(mockUpdateNextStep).toHaveBeenCalledWith("seq-1", 2, expect.any(Date));
      expect(mockUpdateStatus).toHaveBeenCalledWith("seq-1", "ACTIVE");
    });

    it("resumeSequence returns null when not PAUSED", async () => {
      mockFindById.mockResolvedValue(baseSequence({ status: "ACTIVE" }));
      const { resumeSequence } = await import("@/lib/services/cadence-engine");
      expect(await resumeSequence("seq-1")).toBeNull();
    });

    it("archiveSequence sets ARCHIVED", async () => {
      const { archiveSequence } = await import("@/lib/services/cadence-engine");
      await archiveSequence("seq-1");
      expect(mockUpdateStatus).toHaveBeenCalledWith("seq-1", "ARCHIVED");
    });
  });

  describe("autoAdvanceDueSequences", () => {
    it("processes multiple sequences and records failure when advance throws", async () => {
      const seqA = baseSequence({ id: "seq-a" });
      const seqB = baseSequence({ id: "seq-b", currentStep: 3, totalSteps: 4 });
      mockFindDueForAdvance.mockResolvedValue([seqA, seqB]);

      mockFindById.mockImplementation(async (id: string) => {
        if (id === "seq-a") throw new Error("simulated advance failure");
        return id === "seq-b" ? seqB : null;
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { autoAdvanceDueSequences } = await import("@/lib/services/cadence-engine");
      const results = await autoAdvanceDueSequences();

      expect(results).toEqual([
        { sequenceId: "seq-a", advanced: false, completed: false },
        { sequenceId: "seq-b", advanced: false, completed: true },
      ]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("detectResponseForContact", () => {
    it("returns null when there is no active sequence", async () => {
      mockFindActiveByContactId.mockResolvedValue(null);
      const { detectResponseForContact } = await import("@/lib/services/cadence-engine");
      expect(await detectResponseForContact("c1")).toBeNull();
      expect(mockUpdateStatus).not.toHaveBeenCalled();
    });

    it("records response when an active sequence exists", async () => {
      const step = {
        id: "st",
        sequenceId: "seq-1",
        stepNumber: 0,
        type: "INITIAL",
        status: "SENT",
        scheduledAt: new Date(),
        executedAt: new Date(),
        emailSubject: null,
        emailBody: null,
        responseDetectedAt: null,
        createdAt: new Date(),
      };
      const seq = baseSequence({ steps: [step] });
      mockFindActiveByContactId.mockResolvedValue(seq);
      mockFindById.mockResolvedValue(seq);

      const { detectResponseForContact } = await import("@/lib/services/cadence-engine");
      const result = await detectResponseForContact("contact-1");

      expect(mockFindActiveByContactId).toHaveBeenCalledWith("contact-1");
      expect(result).not.toBeNull();
      expect(mockUpdateStatus).toHaveBeenCalledWith("seq-1", "RESPONDED", expect.any(Date));
    });
  });

  describe("getWaitingDays", () => {
    it("returns 0 when current step has no executedAt", async () => {
      const { getWaitingDays } = await import("@/lib/services/cadence-engine");
      const seq = baseSequence({
        currentStep: 0,
        steps: [
          {
            id: "s0",
            sequenceId: "seq-1",
            stepNumber: 0,
            type: "INITIAL",
            status: "PENDING",
            scheduledAt: new Date(),
            executedAt: null,
            emailSubject: null,
            emailBody: null,
            responseDetectedAt: null,
            createdAt: new Date(),
          },
        ],
      });
      expect(getWaitingDays(seq)).toBe(0);
    });

    it("returns floored day difference from executedAt", async () => {
      const { getWaitingDays } = await import("@/lib/services/cadence-engine");
      const executedAt = new Date("2025-01-01T00:00:00Z");
      vi.setSystemTime(new Date("2025-01-05T12:00:00Z"));
      const seq = baseSequence({
        currentStep: 0,
        steps: [
          {
            id: "s0",
            sequenceId: "seq-1",
            stepNumber: 0,
            type: "INITIAL",
            status: "SENT",
            scheduledAt: executedAt,
            executedAt,
            emailSubject: null,
            emailBody: null,
            responseDetectedAt: null,
            createdAt: new Date(),
          },
        ],
      });
      expect(getWaitingDays(seq)).toBe(4);
    });
  });

  describe("buildSequenceNudgeReason / buildReplyNeededReason", () => {
    it("formats sequence nudge reason for zero and plural days", async () => {
      const { buildSequenceNudgeReason } = await import("@/lib/services/cadence-engine");
      expect(buildSequenceNudgeReason("Pat", 0)).toBe("Follow up with Pat");
      expect(buildSequenceNudgeReason("Pat", 1)).toBe(
        "Follow up with Pat — no response in 1 day"
      );
      expect(buildSequenceNudgeReason("Pat", 5)).toBe(
        "Follow up with Pat — no response in 5 days"
      );
    });

    it("formats reply-needed reason with singular and plural", async () => {
      const { buildReplyNeededReason } = await import("@/lib/services/cadence-engine");
      expect(buildReplyNeededReason("Sam", 1)).toBe(
        "Sam emailed you 1 day ago — draft a reply?"
      );
      expect(buildReplyNeededReason("Sam", 3)).toBe(
        "Sam emailed you 3 days ago — draft a reply?"
      );
    });
  });

  describe("detectUnrepliedInbound", () => {
    it("creates nudges for priority contacts, dedupes by contact, ignores low importance", async () => {
      vi.setSystemTime(new Date("2025-06-10T12:00:00Z"));
      const emailDate = new Date("2025-06-05T12:00:00Z");

      const interactionHigh = {
        id: "i1",
        contactId: "c1",
        direction: "INBOUND",
        type: "EMAIL",
        repliedAt: null,
        date: emailDate,
        contact: {
          ...baseContact(),
          id: "c1",
          name: "High Contact",
          importance: "HIGH",
        },
      };
      const interactionDup = {
        ...interactionHigh,
        id: "i2",
        contactId: "c1",
        date: emailDate,
        contact: interactionHigh.contact,
      };
      const interactionLow = {
        id: "i3",
        contactId: "c2",
        direction: "INBOUND",
        type: "EMAIL",
        repliedAt: null,
        date: emailDate,
        contact: {
          ...baseContact(),
          id: "c2",
          name: "Low Contact",
          importance: "LOW",
        },
      };

      mockPrismaInteractionFindMany.mockResolvedValue([
        interactionHigh,
        interactionDup,
        interactionLow,
      ]);
      mockPrismaNudgeFindMany.mockResolvedValue([]);

      const { detectUnrepliedInbound } = await import("@/lib/services/cadence-engine");
      const result = await detectUnrepliedInbound();

      expect(result.scanned).toBe(3);
      expect(result.priorityContacts).toBe(2);
      expect(result.nudgesCreated).toBe(1);
      expect(mockPrismaNudgeCreate).toHaveBeenCalledTimes(1);
      expect(mockPrismaNudgeCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactId: "c1",
          ruleType: "REPLY_NEEDED",
          priority: "HIGH",
          status: "OPEN",
        }),
      });
    });

    it("does not create nudge when OPEN REPLY_NEEDED already exists for contact", async () => {
      vi.setSystemTime(new Date("2025-06-10T12:00:00Z"));
      const emailDate = new Date("2025-06-05T12:00:00Z");
      const interaction = {
        id: "i1",
        contactId: "c1",
        direction: "INBOUND",
        type: "EMAIL",
        repliedAt: null,
        date: emailDate,
        contact: { ...baseContact(), id: "c1", importance: "CRITICAL" },
      };
      mockPrismaInteractionFindMany.mockResolvedValue([interaction]);
      mockPrismaNudgeFindMany.mockResolvedValue([{ contactId: "c1" }]);

      const { detectUnrepliedInbound } = await import("@/lib/services/cadence-engine");
      const result = await detectUnrepliedInbound();

      expect(result.nudgesCreated).toBe(0);
      expect(mockPrismaNudgeCreate).not.toHaveBeenCalled();
    });

    it("uses URGENT priority for CRITICAL contacts", async () => {
      vi.setSystemTime(new Date("2025-06-10T12:00:00Z"));
      const emailDate = new Date("2025-06-05T12:00:00Z");
      const interaction = {
        id: "i1",
        contactId: "c1",
        direction: "INBOUND",
        type: "EMAIL",
        repliedAt: null,
        date: emailDate,
        contact: { ...baseContact(), id: "c1", importance: "CRITICAL" },
      };
      mockPrismaInteractionFindMany.mockResolvedValue([interaction]);
      mockPrismaNudgeFindMany.mockResolvedValue([]);

      const { detectUnrepliedInbound } = await import("@/lib/services/cadence-engine");
      await detectUnrepliedInbound();

      expect(mockPrismaNudgeCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ priority: "URGENT" }),
      });
    });
  });
});

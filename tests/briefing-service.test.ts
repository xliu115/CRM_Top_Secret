import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

const {
  mockPartnerFindById,
  mockNudgeFindByPartnerId,
  mockMeetingFindUpcoming,
  mockSignalFindRecent,
  mockSequenceFindByPartnerId,
  mockIngestNews,
  mockRefreshNudges,
  mockGenerateNarrativeBriefing,
  mockBuildBriefingHtml,
  mockResendSend,
} = vi.hoisted(() => ({
  mockPartnerFindById: vi.fn(),
  mockNudgeFindByPartnerId: vi.fn(),
  mockMeetingFindUpcoming: vi.fn(),
  mockSignalFindRecent: vi.fn(),
  mockSequenceFindByPartnerId: vi.fn(),
  mockIngestNews: vi.fn(),
  mockRefreshNudges: vi.fn(),
  mockGenerateNarrativeBriefing: vi.fn(),
  mockBuildBriefingHtml: vi.fn(),
  mockResendSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockResendSend };
  },
}));

vi.mock("@/lib/repositories", () => ({
  partnerRepo: { findById: mockPartnerFindById },
  nudgeRepo: { findByPartnerId: mockNudgeFindByPartnerId },
  meetingRepo: { findUpcomingByPartnerId: mockMeetingFindUpcoming },
  signalRepo: { findRecentByPartnerId: mockSignalFindRecent },
  sequenceRepo: { findByPartnerId: mockSequenceFindByPartnerId },
}));

vi.mock("@/lib/services/nudge-engine", () => ({
  refreshNudgesForPartner: mockRefreshNudges,
}));

vi.mock("@/lib/services/news-ingestion-service", () => ({
  ingestNewsForPartner: mockIngestNews,
}));

vi.mock("@/lib/services/llm-service", () => ({
  generateNarrativeBriefing: mockGenerateNarrativeBriefing,
}));

vi.mock("@/lib/services/email-service", () => ({
  buildBriefingHtml: mockBuildBriefingHtml,
}));

function minimalPartner(overrides: Record<string, unknown> = {}) {
  return {
    id: "partner-1",
    name: "Ava Smith",
    email: "ava@example.com",
    briefingEnabled: true,
    ...overrides,
  };
}

function minimalNudge() {
  return {
    id: "n-1",
    contactId: "c-1",
    partnerId: "partner-1",
    ruleType: "STALE",
    reason: "Reach out",
    priority: "HIGH",
    status: "OPEN",
    createdAt: new Date(),
    updatedAt: new Date(),
    signalId: null,
    metadata: null,
    sequenceId: null,
    cadenceStepId: null,
    contact: {
      id: "c-1",
      partnerId: "partner-1",
      name: "Contact One",
      title: "CFO",
      companyId: "co-1",
      importance: "HIGH",
      lastContacted: new Date("2025-01-01"),
      createdAt: new Date(),
      updatedAt: new Date(),
      company: {
        id: "co-1",
        name: "Acme",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  };
}

async function loadBriefingModule() {
  vi.resetModules();
  return import("@/lib/services/briefing-service");
}

describe("briefing-service", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("sendMorningBriefing", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockIngestNews.mockResolvedValue(2);
      mockRefreshNudges.mockResolvedValue(4);
      mockNudgeFindByPartnerId.mockResolvedValue([minimalNudge()]);
      mockMeetingFindUpcoming.mockResolvedValue([]);
      mockSignalFindRecent.mockResolvedValue([]);
      mockSequenceFindByPartnerId.mockResolvedValue([]);
      mockGenerateNarrativeBriefing.mockResolvedValue({
        narrative: "Your morning overview.",
        topActions: [{ label: "Ping Acme", href: "/contacts/c-1" }],
      });
      mockBuildBriefingHtml.mockReturnValue("<html>brief</html>");
      mockResendSend.mockResolvedValue({});
    });

    it("runs successful send and calls ingest, refresh, LLM, HTML builder, and Resend", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("NUDGE_EMAIL_TO", "digest@example.com");
      vi.stubEnv("NEXTAUTH_URL", "http://app.test");
      vi.stubEnv("CRON_SECRET", "cron-hmac");
      mockPartnerFindById.mockResolvedValue(minimalPartner());

      const { sendMorningBriefing } = await loadBriefingModule();
      const result = await sendMorningBriefing("partner-1");

      expect(result).toEqual({ sent: true });
      expect(mockIngestNews).toHaveBeenCalledWith("partner-1");
      expect(mockRefreshNudges).toHaveBeenCalledWith("partner-1");
      expect(mockGenerateNarrativeBriefing).toHaveBeenCalledWith(
        expect.objectContaining({
          partnerName: "Ava Smith",
          nudges: expect.any(Array),
          meetings: [],
          clientNews: [],
        })
      );
      expect(mockBuildBriefingHtml).toHaveBeenCalled();
      const htmlCall = mockBuildBriefingHtml.mock.calls[0];
      expect(htmlCall[0]).toMatchObject({
        partnerName: "Ava Smith",
        narrative: "Your morning overview.",
        topActions: [{ label: "Ping Acme", href: "/contacts/c-1" }],
      });
      expect(htmlCall[0].unsubscribeUrl).toContain("/api/briefing/unsubscribe?token=");
      expect(htmlCall[1]).toBe("http://app.test");

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "digest@example.com",
          html: "<html>brief</html>",
        })
      );
      expect(mockResendSend.mock.calls[0][0].subject).toContain("Ava");
    });

    it("appends active sequences to the narrative when present", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("NUDGE_EMAIL_TO", "digest@example.com");
      vi.stubEnv("NEXTAUTH_URL", "http://app.test");
      vi.stubEnv("CRON_SECRET", "cron-hmac");
      mockPartnerFindById.mockResolvedValue(minimalPartner());
      mockNudgeFindByPartnerId.mockResolvedValue([]);
      mockGenerateNarrativeBriefing.mockResolvedValue({
        narrative: "Core briefing.",
        topActions: [],
      });
      const executedAt = new Date("2025-03-01T00:00:00Z");
      mockSequenceFindByPartnerId.mockResolvedValue([
        {
          id: "seq-1",
          contactId: "c-1",
          partnerId: "partner-1",
          originNudgeId: "n-0",
          status: "ACTIVE",
          currentStep: 0,
          totalSteps: 4,
          angleStrategy: "check-in",
          nextStepAt: new Date(),
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          contact: {
            id: "c-1",
            name: "Jordan Lee",
            title: "VP",
            partnerId: "partner-1",
            companyId: "co-1",
            importance: "HIGH",
            lastContacted: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            company: { id: "co-1", name: "Globex", createdAt: new Date(), updatedAt: new Date() },
          },
          steps: [
            {
              id: "st-1",
              sequenceId: "seq-1",
              stepNumber: 0,
              type: "INITIAL",
              status: "SENT",
              scheduledAt: new Date(),
              executedAt,
              emailSubject: "Hi",
              emailBody: "Hey",
              responseDetectedAt: null,
              createdAt: new Date(),
            },
          ],
        },
      ]);

      vi.setSystemTime(new Date("2025-03-03T12:00:00Z"));
      const { sendMorningBriefing } = await loadBriefingModule();
      await sendMorningBriefing("partner-1");
      vi.useRealTimers();

      const narrativePassed = mockBuildBriefingHtml.mock.calls[0][0].narrative as string;
      expect(narrativePassed.startsWith("Core briefing.")).toBe(true);
      expect(narrativePassed).toContain("active follow-up");
      expect(narrativePassed).toContain("Jordan Lee");
      expect(narrativePassed).toContain("Globex");
      expect(narrativePassed).toMatch(/waiting \*\*2 days\*\*/);
    });

    it("returns Partner not found", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      mockPartnerFindById.mockResolvedValue(null);
      const { sendMorningBriefing } = await loadBriefingModule();
      expect(await sendMorningBriefing("missing")).toEqual({
        sent: false,
        error: "Partner not found",
      });
      expect(mockIngestNews).not.toHaveBeenCalled();
    });

    it("returns when briefings disabled", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      mockPartnerFindById.mockResolvedValue(
        minimalPartner({ briefingEnabled: false })
      );
      const { sendMorningBriefing } = await loadBriefingModule();
      expect(await sendMorningBriefing("partner-1")).toEqual({
        sent: false,
        error: "Briefings disabled for this partner",
      });
    });

    it("returns when RESEND_API_KEY is not configured", async () => {
      vi.stubEnv("RESEND_API_KEY", "");
      mockPartnerFindById.mockResolvedValue(minimalPartner());
      const { sendMorningBriefing } = await loadBriefingModule();
      expect(await sendMorningBriefing("partner-1")).toEqual({
        sent: false,
        error: "RESEND_API_KEY not configured",
      });
    });

    it("returns when no recipient email is available", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("NUDGE_EMAIL_TO", "");
      mockPartnerFindById.mockResolvedValue(minimalPartner({ email: "" }));
      const { sendMorningBriefing } = await loadBriefingModule();
      expect(await sendMorningBriefing("partner-1")).toEqual({
        sent: false,
        error: "No recipient email",
      });
    });

    it("returns LLM error when generateNarrativeBriefing fails", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("NUDGE_EMAIL_TO", "digest@example.com");
      mockPartnerFindById.mockResolvedValue(minimalPartner());
      mockGenerateNarrativeBriefing.mockRejectedValue(new Error("OpenAI timeout"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { sendMorningBriefing } = await loadBriefingModule();
      const result = await sendMorningBriefing("partner-1");

      expect(result).toEqual({ sent: false, error: "OpenAI timeout" });
      expect(mockResendSend).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("returns Resend error when send fails", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("NUDGE_EMAIL_TO", "digest@example.com");
      mockPartnerFindById.mockResolvedValue(minimalPartner());
      mockResendSend.mockResolvedValue({ error: { message: "Invalid domain" } });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { sendMorningBriefing } = await loadBriefingModule();
      const result = await sendMorningBriefing("partner-1");

      expect(result).toEqual({ sent: false, error: "Invalid domain" });
      consoleSpy.mockRestore();
    });
  });

  describe("generateUnsubscribeToken / verifyUnsubscribeToken", () => {
    beforeEach(() => {
      vi.stubEnv("CRON_SECRET", "signing-secret");
      vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("generateUnsubscribeToken produces a token verifyUnsubscribeToken accepts", async () => {
      const { generateUnsubscribeToken, verifyUnsubscribeToken } =
        await loadBriefingModule();
      const token = generateUnsubscribeToken("partner-xyz");
      expect(token.split(".")).toHaveLength(2);
      expect(verifyUnsubscribeToken(token)).toBe("partner-xyz");
    });

    it("verifyUnsubscribeToken rejects expired tokens", async () => {
      const { verifyUnsubscribeToken } = await loadBriefingModule();
      const past = Math.floor(Date.now() / 1000) - 60;
      const payload = `partner-old:${past}`;
      const sig = createHmac("sha256", "signing-secret")
        .update(payload)
        .digest("hex")
        .slice(0, 16);
      const encoded = Buffer.from(payload).toString("base64url");
      expect(verifyUnsubscribeToken(`${encoded}.${sig}`)).toBeNull();
    });

    it("verifyUnsubscribeToken rejects tampered signature", async () => {
      const { generateUnsubscribeToken, verifyUnsubscribeToken } =
        await loadBriefingModule();
      const token = generateUnsubscribeToken("partner-1");
      const [enc] = token.split(".");
      expect(verifyUnsubscribeToken(`${enc}.deadbeefdeadbeef`)).toBeNull();
    });

    it("verifyUnsubscribeToken rejects malformed tokens", async () => {
      const { verifyUnsubscribeToken } = await loadBriefingModule();
      expect(verifyUnsubscribeToken("not-a-valid-token")).toBeNull();
      expect(verifyUnsubscribeToken("onlyonepart")).toBeNull();
    });

    it("verifyUnsubscribeToken rejects malformed base64url payload", async () => {
      const { verifyUnsubscribeToken } = await loadBriefingModule();
      const bad = "%%%%.aaaaaaaaaaaaaaaa";
      expect(verifyUnsubscribeToken(bad)).toBeNull();
    });
  });
});

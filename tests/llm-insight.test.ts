import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/llm-core", () => ({
  callLLMJson: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  interactionRepo: {
    findByContactId: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    externalSignal: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { callLLMJson } from "@/lib/services/llm-core";
import { generateStrategicInsight, ELIGIBLE_INSIGHT_TYPES } from "@/lib/services/llm-insight";
import type { NudgeWithRelations } from "@/lib/repositories/interfaces/nudge-repository";

const mockCallLLMJson = vi.mocked(callLLMJson);

function makeNudge(overrides: Partial<NudgeWithRelations> = {}): NudgeWithRelations {
  return {
    id: "nudge-1",
    contactId: "contact-1",
    signalId: null,
    ruleType: "COMPANY_NEWS",
    reason: "Company news for Acme Corp",
    priority: "HIGH",
    status: "OPEN",
    metadata: JSON.stringify({ insights: [] }),
    generatedEmail: null,
    snoozedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    contact: {
      id: "contact-1",
      name: "Craig Federighi",
      title: "SVP Software Engineering",
      email: "craig@apple.com",
      importance: "CRITICAL",
      notes: "Key executive contact",
      phone: null,
      companyId: "company-1",
      partnerId: "partner-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      company: {
        id: "company-1",
        name: "Apple",
        industry: "Technology",
        website: "https://apple.com",
        employeeCount: 160000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    signal: null,
    ...overrides,
  } as NudgeWithRelations;
}

const VALID_LLM_RESPONSE = {
  narrative:
    "**Craig Federighi** is likely navigating a pivotal moment for Apple's software organization. With growing AI pressure, he's balancing short-term execution with longer-term bets.",
  oneLiner: "Craig is balancing AI transformation with platform execution at Apple",
  suggestedAction: {
    label: "Reach out about Apple's AI transformation",
    context:
      "Craig is managing the AI transition at Apple with a new CTO in place. Great time to discuss how your firm can support the software transformation.",
    emailAngle: "AI transformation roadmap",
  },
  evidenceCitations: [
    {
      claim: "growing AI pressure",
      insightTypes: ["COMPANY_NEWS"],
      signalIds: ["signal-1"],
      sourceUrls: ["https://news.example.com/apple-ai"],
    },
  ],
};

describe("llm-insight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateStrategicInsight", () => {
    it("returns a valid StrategicInsight on successful LLM response", async () => {
      mockCallLLMJson.mockResolvedValueOnce(VALID_LLM_RESPONSE);

      const nudge = makeNudge();
      const insights = [
        { type: "COMPANY_NEWS", reason: "Apple announced new AI initiatives", priority: "HIGH" },
      ];

      const result = await generateStrategicInsight(nudge, insights, "John Partner");

      expect(result).not.toBeNull();
      expect(result!.narrative).toBe(VALID_LLM_RESPONSE.narrative);
      expect(result!.oneLiner).toBe(VALID_LLM_RESPONSE.oneLiner);
      expect(result!.suggestedAction.label).toBe(VALID_LLM_RESPONSE.suggestedAction.label);
      expect(result!.suggestedAction.context).toBe(VALID_LLM_RESPONSE.suggestedAction.context);
      expect(result!.suggestedAction.emailAngle).toBe(VALID_LLM_RESPONSE.suggestedAction.emailAngle);
      expect(result!.evidenceCitations).toHaveLength(1);
      expect(result!.generatedAt).toBeDefined();
      expect(new Date(result!.generatedAt).getTime()).not.toBeNaN();
    });

    it("returns null when LLM returns null", async () => {
      mockCallLLMJson.mockResolvedValueOnce(null);

      const result = await generateStrategicInsight(makeNudge(), [], "John Partner");
      expect(result).toBeNull();
    });

    it("returns null when LLM response is missing required fields", async () => {
      mockCallLLMJson.mockResolvedValueOnce({
        narrative: "Some narrative",
        // missing oneLiner, suggestedAction
      });

      const result = await generateStrategicInsight(makeNudge(), [], "John Partner");
      expect(result).toBeNull();
    });

    it("returns null when LLM response has empty narrative", async () => {
      mockCallLLMJson.mockResolvedValueOnce({
        ...VALID_LLM_RESPONSE,
        narrative: "",
      });

      const result = await generateStrategicInsight(makeNudge(), [], "John Partner");
      expect(result).toBeNull();
    });

    it("returns null when LLM throws", async () => {
      mockCallLLMJson.mockRejectedValueOnce(new Error("API error"));

      const result = await generateStrategicInsight(makeNudge(), [], "John Partner");
      expect(result).toBeNull();
    });

    it("truncates suggestedAction.label to 60 characters", async () => {
      const longLabel = "A".repeat(80);
      mockCallLLMJson.mockResolvedValueOnce({
        ...VALID_LLM_RESPONSE,
        suggestedAction: {
          ...VALID_LLM_RESPONSE.suggestedAction,
          label: longLabel,
        },
      });

      const result = await generateStrategicInsight(makeNudge(), [], "John Partner");
      expect(result).not.toBeNull();
      expect(result!.suggestedAction.label.length).toBe(60);
    });

    it("handles missing evidenceCitations gracefully", async () => {
      mockCallLLMJson.mockResolvedValueOnce({
        ...VALID_LLM_RESPONSE,
        evidenceCitations: undefined,
      });

      const result = await generateStrategicInsight(makeNudge(), [], "John Partner");
      expect(result).not.toBeNull();
      expect(result!.evidenceCitations).toEqual([]);
    });

    it("handles missing emailAngle gracefully", async () => {
      mockCallLLMJson.mockResolvedValueOnce({
        ...VALID_LLM_RESPONSE,
        suggestedAction: {
          label: "Test label",
          context: "Test context",
          // missing emailAngle
        },
      });

      const result = await generateStrategicInsight(makeNudge(), [], "John Partner");
      expect(result).not.toBeNull();
      expect(result!.suggestedAction.emailAngle).toBe("");
    });
  });

  describe("ELIGIBLE_INSIGHT_TYPES", () => {
    it("contains the 9 expected contact nudge types", () => {
      expect(ELIGIBLE_INSIGHT_TYPES.size).toBe(9);
      expect(ELIGIBLE_INSIGHT_TYPES.has("STALE_CONTACT")).toBe(true);
      expect(ELIGIBLE_INSIGHT_TYPES.has("JOB_CHANGE")).toBe(true);
      expect(ELIGIBLE_INSIGHT_TYPES.has("COMPANY_NEWS")).toBe(true);
      expect(ELIGIBLE_INSIGHT_TYPES.has("LINKEDIN_ACTIVITY")).toBe(true);
      expect(ELIGIBLE_INSIGHT_TYPES.has("UPCOMING_EVENT")).toBe(true);
      expect(ELIGIBLE_INSIGHT_TYPES.has("EVENT_ATTENDED")).toBe(true);
      expect(ELIGIBLE_INSIGHT_TYPES.has("EVENT_REGISTERED")).toBe(true);
      expect(ELIGIBLE_INSIGHT_TYPES.has("ARTICLE_READ")).toBe(true);
      expect(ELIGIBLE_INSIGHT_TYPES.has("MEETING_PREP")).toBe(true);
    });

    it("does not include non-contact nudge types", () => {
      expect(ELIGIBLE_INSIGHT_TYPES.has("CAMPAIGN_APPROVAL")).toBe(false);
      expect(ELIGIBLE_INSIGHT_TYPES.has("ARTICLE_CAMPAIGN")).toBe(false);
      expect(ELIGIBLE_INSIGHT_TYPES.has("FOLLOW_UP")).toBe(false);
      expect(ELIGIBLE_INSIGHT_TYPES.has("REPLY_NEEDED")).toBe(false);
    });
  });
});

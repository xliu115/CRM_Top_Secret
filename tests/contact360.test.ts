import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateContact360,
  generateMini360,
  generateContact360Template,
  type Contact360Context,
  type Contact360Result,
} from "@/lib/services/llm-contact360";

function makeCtx(overrides: Partial<Contact360Context> = {}): Contact360Context {
  return {
    contact: {
      name: "Jane Smith",
      title: "VP of Engineering",
      email: "jane@acme.com",
      importance: "CRITICAL",
      notes: "Met at Davos 2024",
    },
    company: {
      name: "Acme Corp",
      industry: "Technology",
      employeeCount: 5000,
      website: "https://acme.com",
    },
    interactions: [
      {
        type: "Call",
        date: "2025-03-01T10:00:00Z",
        summary: "Discussed Q1 priorities",
        sentiment: "POSITIVE",
        direction: "outbound",
      },
      {
        type: "Email",
        date: "2025-02-15T08:00:00Z",
        summary: "Follow-up on proposal",
        sentiment: "NEUTRAL",
      },
    ],
    signals: [
      {
        type: "JOB_CHANGE",
        date: "2025-03-10T00:00:00Z",
        content: "Jane Smith promoted to CTO at Acme Corp",
        url: "https://news.example.com/jane-cto",
      },
    ],
    meetings: [
      {
        title: "Q2 Strategy Session",
        date: "2025-04-01T14:00:00Z",
        attendees: ["Jane Smith", "Bob Lee"],
        purpose: "Q2 planning",
        briefExcerpt: "Key topics: expansion plans",
      },
    ],
    nudges: [
      {
        ruleType: "STALE_CONTACT",
        reason: "No contact in 30 days",
        priority: "HIGH",
      },
    ],
    sequences: [
      {
        status: "ACTIVE",
        currentStep: 2,
        totalSteps: 4,
        angleStrategy: "Congratulations on promotion",
      },
    ],
    firmRelationships: [
      {
        partnerName: "You",
        isCurrentUser: true,
        interactionCount: 15,
        intensity: "Very High",
        lastInteractionDate: "2025-03-01T10:00:00Z",
        contactsAtCompany: 3,
      },
      {
        partnerName: "David Park",
        isCurrentUser: false,
        interactionCount: 4,
        intensity: "Medium",
        lastInteractionDate: "2025-01-15T09:00:00Z",
        contactsAtCompany: 2,
      },
    ],
    webBackground: [
      {
        title: "LinkedIn Profile",
        content: "Jane Smith, VP of Engineering at Acme Corp. Previously at Google.",
        url: "https://linkedin.com/in/janesmith",
      },
    ],
    webNews: [
      {
        title: "TechCrunch Article",
        content: "Acme Corp announces new product line under Jane Smith's leadership.",
        url: "https://techcrunch.com/acme-new-product",
      },
    ],
    engagements: [
      {
        type: "Event",
        name: "Tech Summit 2025",
        date: "2025-02-20T00:00:00Z",
      },
    ],
    ...overrides,
  };
}

vi.mock("@/lib/services/llm-core", () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from "@/lib/services/llm-core";
const mockCallLLM = vi.mocked(callLLM);

describe("llm-contact360", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateContact360", () => {
    it("parses a valid LLM response into 7 sections + talking points", async () => {
      const llmResponse = `Jane Smith is VP of Engineering at Acme Corp — key player in Q2 expansion.
---SECTIONS---
[
  {"id":"profile","title":"Person Profile","content":"**Jane Smith** is VP of Engineering at **Acme Corp**."},
  {"id":"relationship","title":"Relationship Overview","content":"Strong relationship with 15 interactions."},
  {"id":"timeline","title":"Communication Timeline","content":"Last contact March 1 via call."},
  {"id":"firm","title":"Firm-Wide Connections","content":"2 partners know Jane."},
  {"id":"signals","title":"News and Signals","content":"Recently promoted to CTO."},
  {"id":"actions","title":"Open Threads and Recommendations","content":"Follow up on promotion."},
  {"id":"talking_points","title":"Talking Points","content":"1. Congrats on the CTO promotion.\\n2. Reference the Tech Summit.\\n3. Ask about Q2 expansion plans."}
]`;
      mockCallLLM.mockResolvedValueOnce(llmResponse);

      const result = await generateContact360(makeCtx());

      expect(result.summary).toContain("Jane Smith");
      expect(result.sections).toHaveLength(7);
      expect(result.sections[0].id).toBe("profile");
      expect(result.sections[6].id).toBe("talking_points");
      expect(result.talkingPoints).toHaveLength(3);
      expect(result.talkingPoints[0]).toContain("CTO promotion");
    });

    it("falls back to template when LLM returns null", async () => {
      mockCallLLM.mockResolvedValueOnce(null);

      const result = await generateContact360(makeCtx());

      expect(result.summary).toContain("Jane Smith");
      expect(result.sections.length).toBeGreaterThanOrEqual(7);
      expect(result.sections.find((s) => s.id === "profile")).toBeTruthy();
      expect(result.sections.find((s) => s.id === "talking_points")).toBeTruthy();
    });

    it("falls back to template when LLM returns malformed JSON", async () => {
      mockCallLLM.mockResolvedValueOnce("Some text\n---SECTIONS---\nnot valid json");

      const result = await generateContact360(makeCtx());

      expect(result.summary).toContain("Jane Smith");
      expect(result.sections.length).toBeGreaterThanOrEqual(7);
    });

    it("falls back when LLM returns fewer than 6 sections", async () => {
      const partial = `Summary line
---SECTIONS---
[{"id":"profile","title":"Profile","content":"Only one section"}]`;
      mockCallLLM.mockResolvedValueOnce(partial);

      const result = await generateContact360(makeCtx());

      expect(result.sections.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe("generateContact360Template", () => {
    it("produces all 7 sections", () => {
      const result = generateContact360Template(makeCtx());

      expect(result.sections).toHaveLength(7);
      const ids = result.sections.map((s) => s.id);
      expect(ids).toEqual([
        "profile",
        "relationship",
        "timeline",
        "firm",
        "signals",
        "actions",
        "talking_points",
      ]);
    });

    it("includes web background in profile section", () => {
      const result = generateContact360Template(makeCtx());
      const profile = result.sections.find((s) => s.id === "profile")!;
      expect(profile.content).toContain("Google");
    });

    it("handles empty interactions gracefully", () => {
      const result = generateContact360Template(
        makeCtx({ interactions: [] })
      );
      const relationship = result.sections.find((s) => s.id === "relationship")!;
      expect(relationship.content).toContain("No interactions recorded");
    });

    it("handles single firm relationship", () => {
      const result = generateContact360Template(
        makeCtx({
          firmRelationships: [
            {
              partnerName: "You",
              isCurrentUser: true,
              interactionCount: 5,
              intensity: "High",
              lastInteractionDate: null,
              contactsAtCompany: 1,
            },
          ],
        })
      );
      const firm = result.sections.find((s) => s.id === "firm")!;
      expect(firm.content).toContain("only partner");
    });

    it("generates talking points from available context", () => {
      const result = generateContact360Template(makeCtx());
      expect(result.talkingPoints.length).toBeGreaterThan(0);
    });
  });

  describe("generateMini360", () => {
    it("parses a valid mini response into 3 sections", async () => {
      const miniResponse = `Jane Smith, VP of Engineering at Acme Corp.
---SECTIONS---
[
  {"id":"profile","title":"Person Profile","content":"VP at Acme."},
  {"id":"firm","title":"Firm Connections","content":"2 partners know Jane."},
  {"id":"signals","title":"Key Signals","content":"Promoted to CTO."}
]`;
      mockCallLLM.mockResolvedValueOnce(miniResponse);

      const result = await generateMini360(makeCtx());

      expect(result.sections).toHaveLength(3);
      expect(result.summary).toContain("Jane Smith");
    });

    it("falls back to template when LLM fails", async () => {
      mockCallLLM.mockResolvedValueOnce(null);

      const result = await generateMini360(makeCtx());

      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].id).toBe("profile");
    });

    it("handles context with no signals", async () => {
      mockCallLLM.mockResolvedValueOnce(null);

      const result = await generateMini360(
        makeCtx({ signals: [], webNews: [] })
      );

      const signalSection = result.sections.find((s) => s.id === "signals")!;
      expect(signalSection.content).toContain("No recent signals");
    });
  });

  describe("web failure degradation", () => {
    it("produces valid output with empty web data", async () => {
      mockCallLLM.mockResolvedValueOnce(null);

      const result = await generateContact360(
        makeCtx({ webBackground: [], webNews: [] })
      );

      expect(result.summary).toBeTruthy();
      expect(result.sections.length).toBeGreaterThanOrEqual(7);
    });
  });
});

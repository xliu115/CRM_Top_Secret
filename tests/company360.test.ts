import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateCompany360,
  generateCompany360Template,
  type Company360Context,
} from "@/lib/services/llm-company360";

function makeCtx(overrides: Partial<Company360Context> = {}): Company360Context {
  return {
    company: {
      name: "Acme Corp",
      industry: "Technology",
      description: "Enterprise SaaS platform for supply chain",
      employeeCount: 5000,
      website: "https://acme.com",
    },
    contacts: [
      {
        name: "Jane Smith",
        title: "VP of Engineering",
        importance: "CRITICAL",
        interactionCount: 15,
        lastInteractionDate: "2025-03-01T10:00:00Z",
        sentiment: "POSITIVE",
        openNudges: 1,
      },
      {
        name: "Bob Lee",
        title: "CFO",
        importance: "HIGH",
        interactionCount: 8,
        lastInteractionDate: "2025-02-10T09:00:00Z",
        sentiment: "NEUTRAL",
        openNudges: 0,
      },
      {
        name: "Alice Wong",
        title: "Head of Procurement",
        importance: "MEDIUM",
        interactionCount: 0,
        lastInteractionDate: null,
        sentiment: null,
        openNudges: 2,
      },
    ],
    partners: [
      {
        partnerName: "Sarah Chen",
        isCurrentUser: true,
        contactCount: 2,
        totalInteractions: 23,
        lastInteractionDate: "2025-03-01T10:00:00Z",
      },
      {
        partnerName: "David Park",
        isCurrentUser: false,
        contactCount: 1,
        totalInteractions: 4,
        lastInteractionDate: "2025-01-15T09:00:00Z",
      },
    ],
    signals: [
      {
        type: "COMPANY_NEWS",
        date: "2025-03-10T00:00:00Z",
        content: "Acme Corp raises $200M Series D",
        url: "https://news.example.com/acme-series-d",
      },
    ],
    meetings: [
      {
        title: "Quarterly Business Review",
        date: "2025-04-01T14:00:00Z",
        attendees: ["Jane Smith", "Sarah Chen"],
        contactName: "Jane Smith",
      },
    ],
    sequences: [
      {
        contactName: "Alice Wong",
        status: "ACTIVE",
        currentStep: 1,
        totalSteps: 4,
      },
    ],
    webNews: [
      {
        title: "TechCrunch",
        content: "Acme Corp expands to European market",
        url: "https://techcrunch.com/acme-europe",
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

describe("llm-company360", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateCompany360", () => {
    it("parses a valid LLM response into 5 sections", async () => {
      const llmResponse = `Acme Corp is a $200M-funded Technology leader — strong multi-partner coverage.
---SECTIONS---
[
  {"id":"overview","title":"Company Overview","content":"**Acme Corp** is a leading enterprise SaaS platform."},
  {"id":"coverage","title":"Firm Coverage Map","content":"2 partners cover 3 contacts at Acme."},
  {"id":"health","title":"Relationship Health Matrix","content":"Jane Smith is warm. Alice Wong is cold."},
  {"id":"signals","title":"Signals and News","content":"Series D raised. European expansion."},
  {"id":"recommendations","title":"Strategic Recommendations","content":"Engage Alice Wong proactively."}
]`;
      mockCallLLM.mockResolvedValueOnce(llmResponse);

      const result = await generateCompany360(makeCtx());

      expect(result.summary).toContain("Acme Corp");
      expect(result.sections).toHaveLength(5);
      expect(result.sections[0].id).toBe("overview");
      expect(result.sections[4].id).toBe("recommendations");
    });

    it("falls back to template when LLM returns null", async () => {
      mockCallLLM.mockResolvedValueOnce(null);

      const result = await generateCompany360(makeCtx());

      expect(result.summary).toContain("Acme Corp");
      expect(result.sections).toHaveLength(5);
    });

    it("falls back to template when LLM returns malformed JSON", async () => {
      mockCallLLM.mockResolvedValueOnce("Summary\n---SECTIONS---\nbroken json");

      const result = await generateCompany360(makeCtx());

      expect(result.sections).toHaveLength(5);
    });
  });

  describe("generateCompany360Template", () => {
    it("produces all 5 sections", () => {
      const result = generateCompany360Template(makeCtx());

      expect(result.sections).toHaveLength(5);
      const ids = result.sections.map((s) => s.id);
      expect(ids).toEqual([
        "overview",
        "coverage",
        "health",
        "signals",
        "recommendations",
      ]);
    });

    it("includes contact count in overview", () => {
      const result = generateCompany360Template(makeCtx());
      const overview = result.sections.find((s) => s.id === "overview")!;
      expect(overview.content).toContain("3 contacts");
    });

    it("includes partner coverage details", () => {
      const result = generateCompany360Template(makeCtx());
      const coverage = result.sections.find((s) => s.id === "coverage")!;
      expect(coverage.content).toContain("Sarah Chen");
      expect(coverage.content).toContain("David Park");
    });

    it("identifies cold contacts in health matrix", () => {
      const result = generateCompany360Template(makeCtx());
      const health = result.sections.find((s) => s.id === "health")!;
      expect(health.content).toContain("Alice Wong");
    });

    it("includes web news in signals section", () => {
      const result = generateCompany360Template(makeCtx());
      const signals = result.sections.find((s) => s.id === "signals")!;
      expect(signals.content).toContain("European market");
    });

    it("detects cold contacts and recommends outreach", () => {
      const result = generateCompany360Template(makeCtx());
      const recs = result.sections.find((s) => s.id === "recommendations")!;
      expect(recs.content).toContain("no recent activity");
    });

    it("detects concentration risk with single partner", () => {
      const result = generateCompany360Template(
        makeCtx({
          partners: [
            {
              partnerName: "Sarah Chen",
              isCurrentUser: true,
              contactCount: 3,
              totalInteractions: 23,
              lastInteractionDate: "2025-03-01T10:00:00Z",
            },
          ],
        })
      );
      const recs = result.sections.find((s) => s.id === "recommendations")!;
      expect(recs.content).toContain("1 partner");
    });

    it("handles empty contacts gracefully", () => {
      const result = generateCompany360Template(
        makeCtx({ contacts: [] })
      );
      const health = result.sections.find((s) => s.id === "health")!;
      expect(health.content).toContain("No contacts tracked");
    });

    it("handles no signals or news", () => {
      const result = generateCompany360Template(
        makeCtx({ signals: [], webNews: [] })
      );
      const signals = result.sections.find((s) => s.id === "signals")!;
      expect(signals.content).toContain("No recent signals");
    });

    it("reports healthy when no issues found", () => {
      const result = generateCompany360Template(
        makeCtx({
          contacts: [
            {
              name: "Jane Smith",
              title: "VP",
              importance: "HIGH",
              interactionCount: 10,
              lastInteractionDate: "2025-03-01T10:00:00Z",
              sentiment: "POSITIVE",
              openNudges: 0,
            },
          ],
        })
      );
      const recs = result.sections.find((s) => s.id === "recommendations")!;
      expect(recs.content).toContain("healthy");
    });
  });

  describe("multi-contact aggregation", () => {
    it("includes all contacts in summary count", () => {
      const result = generateCompany360Template(makeCtx());
      expect(result.summary).toContain("3 contacts");
    });

    it("tracks open nudges across contacts", () => {
      const result = generateCompany360Template(makeCtx());
      const recs = result.sections.find((s) => s.id === "recommendations")!;
      expect(recs.content).toContain("3 open nudges");
    });
  });
});

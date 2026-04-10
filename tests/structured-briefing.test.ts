import { describe, it, expect } from "vitest";
import {
  buildDataDrivenSummaryMarkdown,
  buildDataDrivenSummaryFromStructured,
} from "@/lib/services/structured-briefing";
import type { NarrativeBriefingContext } from "@/lib/services/llm-briefing";

describe("buildDataDrivenSummaryMarkdown", () => {
  it("names a contact and days since last outreach", () => {
    const ctx: NarrativeBriefingContext = {
      partnerName: "Ava Patel",
      nudges: [
        {
          contactName: "Jordan Lee",
          company: "Northwind Capital",
          reason: "Stale relationship — check in before quarter-end.",
          priority: "HIGH",
          contactId: "c1",
          nudgeId: "n1",
          daysSince: 60,
        },
      ],
      meetings: [],
      clientNews: [],
    };
    const md = buildDataDrivenSummaryMarkdown(ctx);
    expect(md).toContain("Jordan Lee");
    expect(md).toContain("Northwind Capital");
    expect(md).toContain("60");
    expect(md).toMatch(/days since last outreach|days ago/);
    expect(md).toContain("Why this surfaced");
    expect(md).toContain("Stale relationship");
  });

  it("buildDataDrivenSummaryFromStructured matches API-shaped JSON", () => {
    const md = buildDataDrivenSummaryFromStructured("Ava Patel", {
      nudges: [
        {
          contactName: "Jordan Lee",
          company: "Northwind Capital",
          reason: "Stale relationship.",
          priority: "HIGH",
          contactId: "c1",
          nudgeId: "n1",
          daysSince: 60,
          lastContactedLabel: "Jan 15, 2026",
          lastInteractionSummary: "Quarterly planning call — follow up on scope.",
        },
      ],
      meetings: [],
      news: [],
    });
    expect(md).toContain("60");
    expect(md).toMatch(/days since last outreach|days ago/);
    expect(md).toContain("Jan 15, 2026");
    expect(md).toContain("Latest note");
    expect(md).toContain("Quarterly planning");
  });

  it("handles empty CRM gracefully", () => {
    const ctx: NarrativeBriefingContext = {
      partnerName: "Ava Patel",
      nudges: [],
      meetings: [],
      clientNews: [],
    };
    const md = buildDataDrivenSummaryMarkdown(ctx);
    expect(md).toContain("Ava");
    expect(md.toLowerCase()).toMatch(/nothing urgent|quiet|proactive/);
  });
});

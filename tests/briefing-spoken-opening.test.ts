import { describe, it, expect } from "vitest";
import { buildBriefingSpokenOpening } from "@/lib/utils/briefing-spoken-opening";

describe("buildBriefingSpokenOpening", () => {
  it("builds a rundown matching user-facing counts", () => {
    const text = buildBriefingSpokenOpening(
      {
        structured: {
          nudges: [
            { contactName: "A", company: "Co", contactId: "1", ruleType: "STALE_CONTACT" },
            { contactName: "B", company: "Co", contactId: "2", ruleType: "STALE_CONTACT" },
            { contactName: "C", company: "Co", contactId: "3", ruleType: "STALE_CONTACT" },
            { contactName: "Camp", company: "X", contactId: "4", ruleType: "CAMPAIGN_APPROVAL" },
            { contactName: "Art", company: "Y", contactId: "5", ruleType: "ARTICLE_CAMPAIGN" },
            { contactName: "D", company: "Co", contactId: "6", ruleType: "FOLLOW_UP" },
          ],
          meetings: [{ title: "QBR", startTime: "10am", meetingId: "m1" }],
          news: [{ content: "Nvidia news" }, { content: "Adobe news" }],
        },
      },
      "Jordan",
    );
    expect(text).toContain("Jordan");
    expect(text).toContain("three contacts to reach out to");
    expect(text).toContain("one campaign to approve");
    expect(text).toContain("one article to share");
    expect(text).toContain("one follow-up");
    expect(text).toContain("one meeting on your calendar");
    expect(text).toContain("two headlines on the radar");
  });

  it("handles a quiet queue", () => {
    const text = buildBriefingSpokenOpening(
      { structured: { nudges: [], meetings: [] } },
      "Sam",
    );
    expect(text).toContain("Sam");
    expect(text).toMatch(/lighter day|all caught up/i);
  });
});

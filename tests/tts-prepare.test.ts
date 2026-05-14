import { describe, it, expect } from "vitest";
import { prepareBriefingForTTS } from "@/lib/utils/tts-prepare";

describe("prepareBriefingForTTS", () => {
  it("strips markdown from narrative", () => {
    const result = prepareBriefingForTTS(
      "**Good morning!** You have [3 meetings](http://example.com) today.",
      [],
    );
    expect(result).toBe("Good morning! You have 3 meetings today.");
  });

  it("appends top actions as spoken sentences", () => {
    const result = prepareBriefingForTTS("Hello.", [
      {
        contactName: "Sarah Chen",
        company: "Acme Corp",
        actionLabel: "Follow up",
        detail: "quarterly review discussion",
        deeplink: "/contacts/1",
      },
    ]);
    expect(result).toContain("Hello.");
    expect(result).toContain("Sarah Chen");
    expect(result).toContain("Acme Corp");
    expect(result).toContain("quarterly review discussion");
  });

  it("handles empty narrative gracefully", () => {
    const result = prepareBriefingForTTS("", [
      {
        contactName: "John",
        company: "BigCo",
        actionLabel: "Check in",
        detail: "project update",
        deeplink: "/contacts/2",
      },
    ]);
    expect(result).toContain("John");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles no actions", () => {
    const result = prepareBriefingForTTS("Your day looks clear.", []);
    expect(result).toBe("Your day looks clear.");
  });

  it("limits to reasonable spoken length", () => {
    const longNarrative = "Word ".repeat(500);
    const result = prepareBriefingForTTS(longNarrative, []);
    expect(result.split(" ").length).toBeLessThanOrEqual(350);
  });

  it("prepends spoken opening and skips duplicate priorities lead-in", () => {
    const result = prepareBriefingForTTS(
      "Main body.",
      [
        {
          contactName: "Pat",
          company: "Co",
          actionLabel: "Reach out",
          detail: "stale",
          deeplink: "/c",
        },
      ],
      { spokenOpening: "Alex, here's your morning briefing from ClientIQ." },
    );
    expect(result.startsWith("Alex, here's your morning briefing from ClientIQ.")).toBe(true);
    expect(result).toContain("Here's the full briefing.");
    expect(result).toContain("Main body.");
    expect(result).not.toContain("Here are your priorities for today.");
    expect(result).toContain("First, reach out with Pat");
  });
});

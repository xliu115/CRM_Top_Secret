import { describe, it, expect } from "vitest";

describe("briefing audio - TTS prepare integration", () => {
  it("prepareBriefingForTTS produces non-empty output for typical briefing", async () => {
    const { prepareBriefingForTTS } = await import("@/lib/utils/tts-prepare");

    const result = prepareBriefingForTTS(
      "Good morning! You have 2 meetings today and 3 nudges to review.",
      [
        {
          contactName: "Sarah Chen",
          company: "Acme Corp",
          actionLabel: "Follow up",
          detail: "Q2 proposal",
          deeplink: "/contacts/1",
        },
      ],
    );

    expect(result.length).toBeGreaterThan(20);
    expect(result).not.toContain("**");
    expect(result).not.toContain("[");
  });
});

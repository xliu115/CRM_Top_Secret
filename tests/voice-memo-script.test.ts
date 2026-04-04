import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateVoiceMemoScript,
  generateVoiceMemoScriptFallback,
  type NarrativeBriefingContext,
} from "@/lib/services/llm-briefing";

vi.mock("@/lib/services/llm-core", () => ({
  callLLM: vi.fn(),
  callLLMJson: vi.fn(),
}));

import { callLLMJson } from "@/lib/services/llm-core";

const mockCallLLMJson = vi.mocked(callLLMJson);

function sampleCtx(): NarrativeBriefingContext {
  return {
    partnerName: "Jordan Lee",
    nudges: [
      {
        contactName: "Riley Chen",
        company: "Meridian Group",
        reason: "No outreach in 90 days",
        priority: "HIGH",
        contactId: "c-riley",
        nudgeId: "n-1",
        daysSince: 61,
        lastContactedLabel: "Feb 2, 2026",
      },
    ],
    meetings: [],
    clientNews: [],
  };
}

describe("generateVoiceMemoScript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed segments when LLM returns valid JSON", async () => {
    mockCallLLMJson.mockResolvedValueOnce({
      segments: [
        {
          id: "intro",
          headline: "Morning",
          script:
            "Hi Jordan. You can talk with Riley Chen at Meridian Group — your last touch with Riley was 61 days ago on February second.",
          contactName: "Riley Chen",
          company: "Meridian Group",
        },
      ],
    });

    const segs = await generateVoiceMemoScript(sampleCtx());
    expect(segs).toHaveLength(1);
    expect(segs[0].id).toBe("intro");
    expect(segs[0].headline).toBe("Morning");
    expect(segs[0].script).toContain("Riley Chen");
    expect(segs[0].deeplink).toContain("c-riley");
  });

  it("falls back when LLM returns null", async () => {
    mockCallLLMJson.mockResolvedValueOnce(null);

    const segs = await generateVoiceMemoScript(sampleCtx());
    expect(segs.length).toBeGreaterThan(0);
    expect(segs[0].script).toMatch(/Riley Chen/);
    expect(segs[0].script).not.toMatch(/Why this surfaced/i);
    expect(segs[0].script).not.toMatch(/Latest note:/i);
  });

  it("falls back when segments parse to empty", async () => {
    mockCallLLMJson.mockResolvedValueOnce({
      segments: [{ id: "x", headline: "", script: "" }],
    });

    const segs = await generateVoiceMemoScript(sampleCtx());
    expect(segs.length).toBeGreaterThan(0);
    expect(segs[0].headline.length).toBeGreaterThan(0);
  });
});

describe("generateVoiceMemoScriptFallback", () => {
  it("does not use report-style labels removed from spoken copy", () => {
    const segs = generateVoiceMemoScriptFallback(sampleCtx());
    const joined = segs.map((s) => s.script).join(" ");
    expect(joined).not.toMatch(/Why this surfaced/i);
    expect(joined).not.toMatch(/Latest note:/i);
    expect(joined).not.toMatch(/^Next:/m);
  });
});

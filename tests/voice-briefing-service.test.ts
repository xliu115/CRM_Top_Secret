import { describe, it, expect } from "vitest";
import { computeSegmentOffsetsMs } from "@/lib/utils/voice-timeline";
import { estimateDurationFromBytes } from "@/lib/services/voice-briefing-service";
import { generateVoiceMemoScriptFallback } from "@/lib/services/llm-briefing";

describe("computeSegmentOffsetsMs", () => {
  it("returns zero starts and correct ends for empty input", () => {
    const r = computeSegmentOffsetsMs([]);
    expect(r.startMs).toEqual([]);
    expect(r.endMs).toEqual([]);
    expect(r.totalMs).toBe(0);
  });

  it("accumulates segment boundaries", () => {
    const r = computeSegmentOffsetsMs([1000, 2500, 500]);
    expect(r.startMs).toEqual([0, 1000, 3500]);
    expect(r.endMs).toEqual([1000, 3500, 4000]);
    expect(r.totalMs).toBe(4000);
  });
});

describe("estimateDurationFromBytes", () => {
  it("approximates duration from byte length at 64 kbps", () => {
    const bytes = 8000;
    expect(estimateDurationFromBytes(bytes)).toBe(1000);
  });
});

describe("generateVoiceMemoScriptFallback", () => {
  it("returns a quiet-day segment when there is no CRM activity", () => {
    const segs = generateVoiceMemoScriptFallback({
      partnerName: "Alex Morgan",
      nudges: [],
      meetings: [],
      clientNews: [],
    });
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs[0].headline.length).toBeGreaterThan(0);
    expect(segs[0].script.length).toBeGreaterThan(0);
  });
});

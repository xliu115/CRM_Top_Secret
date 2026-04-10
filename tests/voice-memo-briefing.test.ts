import { describe, it, expect } from "vitest";
import { activeSegmentIndex } from "@/components/voice-memo/voice-memo-briefing";

describe("activeSegmentIndex", () => {
  const segments = [
    { id: "a", headline: "A", startMs: 0, endMs: 1000 },
    { id: "b", headline: "B", startMs: 1000, endMs: 3000 },
    { id: "c", headline: "C", startMs: 3000, endMs: 5000 },
  ];

  it("returns -1 for empty segments", () => {
    expect(activeSegmentIndex([], 0)).toBe(-1);
  });

  it("returns last segment whose startMs is at or before currentMs", () => {
    expect(activeSegmentIndex(segments, 0)).toBe(0);
    expect(activeSegmentIndex(segments, 500)).toBe(0);
    expect(activeSegmentIndex(segments, 1000)).toBe(1);
    expect(activeSegmentIndex(segments, 2999)).toBe(1);
    expect(activeSegmentIndex(segments, 3000)).toBe(2);
    expect(activeSegmentIndex(segments, 99999)).toBe(2);
  });
});

import { describe, it, expect } from "vitest";
import { buildBoardSummaryPlainText } from "@/lib/pipeline/board-summary-text";

describe("buildBoardSummaryPlainText", () => {
  it("includes lane headers and top rows", () => {
    const text = buildBoardSummaryPlainText({
      lens: "pipeline",
      partnerName: "Morgan",
      topNPerLane: 2,
      rows: [
        {
          lens: "pipeline",
          stage: "active_engagements",
          title: "Alpha study",
          nextStep: "Call CFO",
          confirmationStatus: "CONFIRMED",
          archivedAt: null,
        },
        {
          lens: "pipeline",
          stage: "lops_in_discussion",
          title: "Beta",
          nextStep: null,
          confirmationStatus: "CONFIRMED",
          archivedAt: null,
        },
      ],
    });
    expect(text).toContain("Morgan");
    expect(text).toContain("Active engagements");
    expect(text).toContain("Alpha study");
    expect(text).toContain("Call CFO");
    expect(text).toContain("LOPs in discussion");
  });
});

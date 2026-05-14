import { describe, it, expect } from "vitest";
import { tabTriple } from "@/lib/pipeline/tab-counts";

describe("tabTriple", () => {
  it("counts confirmed rows per lane for pipeline lens", () => {
    const rows = [
      {
        lens: "pipeline" as const,
        stage: "active_engagements",
        confirmationStatus: "CONFIRMED" as const,
        archivedAt: null,
      },
      {
        lens: "pipeline" as const,
        stage: "active_engagements",
        confirmationStatus: "CONFIRMED" as const,
        archivedAt: null,
      },
      {
        lens: "pipeline" as const,
        stage: "lops_in_discussion",
        confirmationStatus: "CONFIRMED" as const,
        archivedAt: null,
      },
      {
        lens: "pipeline" as const,
        stage: "serious_discussions",
        confirmationStatus: "DRAFT" as const,
        archivedAt: null,
      },
      {
        lens: "pipeline" as const,
        stage: "serious_discussions",
        confirmationStatus: "CONFIRMED" as const,
        archivedAt: new Date(),
      },
    ];
    expect(tabTriple("pipeline", rows)).toEqual([2, 1, 0]);
  });

  it("excludes drafts and archived from tab counts", () => {
    const rows = [
      {
        lens: "clients" as const,
        stage: "active_clients",
        confirmationStatus: "DRAFT" as const,
        archivedAt: null,
      },
      {
        lens: "clients" as const,
        stage: "active_clients",
        confirmationStatus: "CONFIRMED" as const,
        archivedAt: null,
      },
    ];
    expect(tabTriple("clients", rows)).toEqual([1, 0, 0]);
  });
});

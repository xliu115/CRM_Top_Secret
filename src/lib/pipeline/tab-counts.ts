import type { LensSlug } from "./lens";

export type RowCountInput = {
  lens: LensSlug;
  stage: string;
  confirmationStatus: "DRAFT" | "CONFIRMED";
  archivedAt: Date | null;
};

export function tabTriple(
  lens: LensSlug,
  rows: RowCountInput[],
): [number, number, number] {
  const active = rows.filter(
    (r) =>
      r.lens === lens &&
      r.confirmationStatus === "CONFIRMED" &&
      !r.archivedAt,
  );
  const order =
    lens === "pipeline"
      ? (["active_engagements", "lops_in_discussion", "serious_discussions"] as const)
      : (["active_clients", "warm_relationships", "under_cultivation"] as const);
  return order.map((stage) => active.filter((r) => r.stage === stage).length) as [
    number,
    number,
    number,
  ];
}

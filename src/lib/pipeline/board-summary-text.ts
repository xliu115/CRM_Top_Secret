import type { LensSlug } from "./lens";
import { tabTriple } from "./tab-counts";

const PIPELINE_HEADERS = [
  "Active engagements",
  "LOPs in discussion",
  "Serious discussions",
] as const;
const CLIENT_HEADERS = [
  "Active clients",
  "Warm relationships",
  "Under cultivation",
] as const;

export type SummaryRow = {
  lens: LensSlug;
  stage: string;
  title: string;
  nextStep: string | null;
  confirmationStatus: "DRAFT" | "CONFIRMED";
  archivedAt: Date | null;
};

export function buildBoardSummaryPlainText(args: {
  lens: LensSlug;
  rows: SummaryRow[];
  partnerName?: string;
  topNPerLane?: number;
}): string {
  const { lens, rows, partnerName, topNPerLane = 5 } = args;
  const active = rows.filter(
    (r) =>
      r.lens === lens &&
      r.confirmationStatus === "CONFIRMED" &&
      !r.archivedAt,
  );
  const triple = tabTriple(
    lens,
    active.map((r) => ({
      lens: r.lens,
      stage: r.stage,
      confirmationStatus: r.confirmationStatus,
      archivedAt: r.archivedAt,
    })),
  );
  const headers = lens === "pipeline" ? PIPELINE_HEADERS : CLIENT_HEADERS;
  const lines: string[] = [];
  lines.push(
    partnerName
      ? `Pipeline board summary — ${partnerName}`
      : "Pipeline board summary",
  );
  lines.push(`Lens: ${lens}`);
  lines.push(
    `Counts: ${triple[0]} · ${triple[1]} · ${triple[2]} (${headers.join(" · ")})`,
  );
  const order =
    lens === "pipeline"
      ? (["active_engagements", "lops_in_discussion", "serious_discussions"] as const)
      : (["active_clients", "warm_relationships", "under_cultivation"] as const);
  for (let i = 0; i < order.length; i++) {
    const stage = order[i];
    const label = headers[i];
    const inLane = active
      .filter((r) => r.stage === stage)
      .slice(0, topNPerLane);
    lines.push("");
    lines.push(`${label} (${triple[i]} total, top ${topNPerLane} shown):`);
    if (inLane.length === 0) lines.push("  (none)");
    else {
      for (const r of inLane) {
        const ns = r.nextStep ? ` — Next: ${r.nextStep}` : "";
        lines.push(`  - ${r.title}${ns}`);
      }
    }
  }
  return lines.join("\n");
}

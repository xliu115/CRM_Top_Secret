export const PIPELINE_STAGES = [
  "active_engagements",
  "lops_in_discussion",
  "serious_discussions",
] as const;
export const CLIENT_STAGES = [
  "active_clients",
  "warm_relationships",
  "under_cultivation",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type ClientStage = (typeof CLIENT_STAGES)[number];

export function isPipelineStage(s: string): s is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(s);
}

export function isClientStage(s: string): s is ClientStage {
  return (CLIENT_STAGES as readonly string[]).includes(s);
}

export function defaultStageForLens(
  lens: "pipeline" | "clients",
): PipelineStage | ClientStage {
  return lens === "pipeline" ? "active_engagements" : "active_clients";
}

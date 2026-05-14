import type { PipelineLens } from "@prisma/client";

export type LensSlug = "pipeline" | "clients";

export function lensSlugToPrisma(slug: LensSlug): PipelineLens {
  return slug === "pipeline" ? "PIPELINE" : "CLIENTS";
}

export function prismaLensToSlug(lens: PipelineLens): LensSlug {
  return lens === "PIPELINE" ? "pipeline" : "clients";
}

export function parseLensParam(raw: string | null): LensSlug {
  return raw === "clients" ? "clients" : "pipeline";
}

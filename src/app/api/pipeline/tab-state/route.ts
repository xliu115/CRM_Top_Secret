import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { parseLensParam, type LensSlug } from "@/lib/pipeline/lens";
import { pipelineRepo } from "@/lib/repositories";

type Body = {
  tabKey?: string;
  markSeenNow?: boolean;
  highlightCollapsedUntil?: string | null;
};

export async function PATCH(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();
    const body = (await request.json()) as Body;
    const tabKey = parseLensParam(body.tabKey ?? null) as LensSlug;

    const patch: {
      lastViewedAt?: Date | null;
      highlightCollapsedUntil?: Date | null;
    } = {};

    if (body.markSeenNow) {
      patch.lastViewedAt = new Date();
    }
    if (body.highlightCollapsedUntil !== undefined) {
      patch.highlightCollapsedUntil = body.highlightCollapsedUntil
        ? new Date(body.highlightCollapsedUntil)
        : null;
    }

    const updated = await pipelineRepo.patchTabState(partnerId, tabKey, patch);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[pipeline/tab-state]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

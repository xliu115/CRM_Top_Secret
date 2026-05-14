import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { STAGE_UNDO_WINDOW_MS } from "@/lib/pipeline/constants";
import { pipelineRepo } from "@/lib/repositories";

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await ctx.params;
    const since = new Date(Date.now() - STAGE_UNDO_WINDOW_MS);
    const hit = await pipelineRepo.findLatestUndoableStageChange(
      id,
      partnerId,
      since,
    );
    if (!hit) {
      return NextResponse.json(
        { error: "Nothing to undo in the last few minutes" },
        { status: 400 },
      );
    }
    const row = await pipelineRepo.setStage(id, partnerId, hit.restoreStage, {
      skipEvent: true,
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

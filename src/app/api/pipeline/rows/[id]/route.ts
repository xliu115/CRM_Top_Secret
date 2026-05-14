import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { pipelineRepo } from "@/lib/repositories";
import { validateStageForLens } from "@/lib/services/pipeline-suggestions-service";

type Body = {
  title?: string;
  workingTitle?: string | null;
  nextStep?: string | null;
  clientContact?: string | null;
  lastTouchpoint?: string | null;
  milestoneDate?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  tags?: string[];
  stage?: string;
  confirm?: boolean;
  archive?: boolean;
  dropOffReason?: string | null;
};

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await ctx.params;
    const body = (await request.json()) as Body;

    const existing = await pipelineRepo.findRowById(id, partnerId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.archive === true) {
      const row = await pipelineRepo.archiveRow(
        id,
        partnerId,
        body.dropOffReason ?? null,
      );
      return NextResponse.json(row);
    }

    if (body.confirm === true && existing.confirmationStatus === "DRAFT") {
      await pipelineRepo.confirmRow(id, partnerId);
    }

    if (
      body.stage !== undefined &&
      body.stage !== existing.stage &&
      validateStageForLens(existing.lens, body.stage)
    ) {
      await pipelineRepo.setStage(id, partnerId, body.stage);
    }

    const patch: Parameters<typeof pipelineRepo.updateRow>[2] = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.workingTitle !== undefined) patch.workingTitle = body.workingTitle;
    if (body.nextStep !== undefined) patch.nextStep = body.nextStep;
    if (body.clientContact !== undefined) patch.clientContact = body.clientContact;
    if (body.lastTouchpoint !== undefined) patch.lastTouchpoint = body.lastTouchpoint;
    if (body.milestoneDate !== undefined)
      patch.milestoneDate = body.milestoneDate ? new Date(body.milestoneDate) : null;
    if (body.companyId !== undefined) patch.companyId = body.companyId;
    if (body.contactId !== undefined) patch.contactId = body.contactId;
    if (body.tags !== undefined) patch.tags = body.tags;
    if (body.dropOffReason !== undefined) patch.dropOffReason = body.dropOffReason;

    let row =
      Object.keys(patch).length > 0
        ? await pipelineRepo.updateRow(id, partnerId, patch)
        : await pipelineRepo.findRowById(id, partnerId);

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.stage !== undefined && body.stage !== existing.stage) {
      row = await pipelineRepo.findRowById(id, partnerId);
    }

    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[pipeline/rows PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await ctx.params;
    const row = await pipelineRepo.archiveRow(id, partnerId, null);
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

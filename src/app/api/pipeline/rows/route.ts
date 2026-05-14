import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { lensSlugToPrisma } from "@/lib/pipeline/lens";
import { defaultStageForLens } from "@/lib/pipeline/stages";
import { pipelineRepo } from "@/lib/repositories";
import {
  validateStageForLens,
} from "@/lib/services/pipeline-suggestions-service";

type Body = {
  lens?: string;
  stage?: string;
  title?: string;
  workingTitle?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  nextStep?: string | null;
  provenance?: string;
  confirm?: boolean;
  tags?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();
    const body = (await request.json()) as Body;
    const lensSlug = body.lens === "clients" ? "clients" : "pipeline";
    const stage =
      body.stage && validateStageForLens(lensSlug, body.stage)
        ? body.stage
        : defaultStageForLens(lensSlug);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const provenance =
      body.provenance === "manual" ||
      body.provenance === "system" ||
      body.provenance === "voice" ||
      body.provenance === "upload"
        ? body.provenance
        : "manual";

    const needsDraft =
      provenance === "system" || provenance === "voice" || provenance === "upload";
    const confirmationStatus =
      body.confirm === true || !needsDraft ? "CONFIRMED" : "DRAFT";

    const row = await pipelineRepo.createRow(partnerId, {
      lens: lensSlugToPrisma(lensSlug),
      stage,
      title,
      workingTitle: body.workingTitle ?? null,
      companyId: body.companyId ?? null,
      contactId: body.contactId ?? null,
      nextStep: body.nextStep ?? null,
      provenance,
      confirmationStatus,
      tags: body.tags,
    });

    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[pipeline/rows POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

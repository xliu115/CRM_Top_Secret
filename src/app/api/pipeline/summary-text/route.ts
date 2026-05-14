import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { parseLensParam } from "@/lib/pipeline/lens";
import { buildBoardSummaryPlainText } from "@/lib/pipeline/board-summary-text";
import { partnerRepo, pipelineRepo } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();
    const { searchParams } = new URL(request.url);
    const lens = parseLensParam(searchParams.get("lens"));
    const [rows, partner] = await Promise.all([
      pipelineRepo.listRows(partnerId, undefined, { includeArchived: false }),
      partnerRepo.findById(partnerId),
    ]);
    const text = buildBoardSummaryPlainText({
      lens,
      partnerName: partner?.name,
      rows: rows.map((r) => ({
        lens: r.lens,
        stage: r.stage,
        title: r.title,
        nextStep: r.nextStep,
        confirmationStatus: r.confirmationStatus,
        archivedAt: r.archivedAt ? new Date(r.archivedAt) : null,
      })),
    });
    return NextResponse.json({ text });
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

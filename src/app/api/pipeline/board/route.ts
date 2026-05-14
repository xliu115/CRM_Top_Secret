import { NextRequest, NextResponse, after } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { prisma } from "@/lib/db/prisma";
import { parseLensParam, type LensSlug } from "@/lib/pipeline/lens";
import { tabTriple } from "@/lib/pipeline/tab-counts";
import { pipelineRepo } from "@/lib/repositories";
import { refreshPipelineSuggestions } from "@/lib/services/pipeline-suggestions-service";

/** Avoid static analysis caching; uses cookies + DB. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();
    const { searchParams } = new URL(request.url);
    const lensParam = parseLensParam(searchParams.get("lens"));

    after(() => {
      void refreshPipelineSuggestions(partnerId).catch((e) =>
        console.error("[pipeline/board] refresh suggestions:", e),
      );
    });

    const [rows, tabStates, suggestions] = await Promise.all([
      pipelineRepo.listRows(partnerId, undefined, { includeArchived: false }),
      pipelineRepo.listTabStates(partnerId),
      pipelineRepo.listPendingSuggestions(partnerId),
    ]);

    const tabStateForLens = (slug: LensSlug) =>
      tabStates.find((t) => t.tabKey === slug) ?? {
        tabKey: slug,
        lastViewedAt: null,
        highlightCollapsedUntil: null,
      };

    const sinceRaw = tabStateForLens(lensParam).lastViewedAt;
    const since = sinceRaw ? new Date(sinceRaw) : new Date(0);

    const eventsSince = await pipelineRepo.listEventsSince(
      partnerId,
      lensParam,
      since,
    );

    const companyIds = [...new Set(rows.map((r) => r.companyId).filter(Boolean))] as string[];
    const companies = companyIds.length > 0
      ? await prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } })
      : [];
    const companyMap = new Map(companies.map((c) => [c.id, c.name]));

    const enrichedRows = rows.map((r) => ({
      ...r,
      companyName: r.companyId ? companyMap.get(r.companyId) ?? null : null,
    }));

    const countInputs = rows.map((r) => ({
      lens: r.lens,
      stage: r.stage,
      confirmationStatus: r.confirmationStatus,
      archivedAt: r.archivedAt ? new Date(r.archivedAt) : null,
    }));

    return NextResponse.json({
      rows: enrichedRows,
      tabStates,
      suggestions,
      eventsSince,
      triples: {
        pipeline: tabTriple("pipeline", countInputs),
        clients: tabTriple("clients", countInputs),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[pipeline/board]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

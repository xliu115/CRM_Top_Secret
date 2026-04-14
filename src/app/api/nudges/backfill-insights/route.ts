import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { nudgeRepo, partnerRepo } from "@/lib/repositories";
import { generateStrategicInsight, ELIGIBLE_INSIGHT_TYPES } from "@/lib/services/llm-insight";

export async function POST(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();
    const partner = await partnerRepo.findById(partnerId);
    const partnerName = partner?.name ?? "Partner";

    const force = request.nextUrl.searchParams.get("force") === "true";

    const nudges = await nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" });
    const eligible = nudges.filter((n) => {
      if (!ELIGIBLE_INSIGHT_TYPES.has(n.ruleType)) return false;
      if (force) return true;
      try {
        const meta = JSON.parse(n.metadata ?? "{}");
        return !meta.strategicInsight;
      } catch {
        return true;
      }
    });

    if (eligible.length === 0) {
      return NextResponse.json({ enriched: 0, skipped: nudges.length, message: "All nudges already have strategic insights" });
    }

    let enriched = 0;
    let failed = 0;

    for (const nudge of eligible) {
      try {
        const meta = JSON.parse(nudge.metadata ?? "{}");
        const insights = meta.insights ?? [];
        const result = await generateStrategicInsight(nudge, insights, partnerName);
        if (result) {
          meta.strategicInsight = result;
          await nudgeRepo.updateMetadata(nudge.id, JSON.stringify(meta));
          enriched++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      enriched,
      failed,
      skipped: nudges.length - eligible.length,
      total: nudges.length,
      forced: force,
    });
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

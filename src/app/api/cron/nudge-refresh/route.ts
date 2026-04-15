import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { refreshNudgesForPartner, enrichNudgesWithInsights } from "@/lib/services/nudge-engine";
import { ingestNewsForPartner } from "@/lib/services/news-ingestion-service";
import { verifyCronSecret } from "@/lib/utils/cron-auth";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const partners = await prisma.partner.findMany({
      select: { id: true, name: true },
    });

    const settled = await Promise.allSettled(
      partners.map(async (partner) => {
        const newsCount = await ingestNewsForPartner(partner.id);
        const nudgeCount = await refreshNudgesForPartner(partner.id);
        await enrichNudgesWithInsights(partner.id);
        return { name: partner.name, newsCount, nudgeCount };
      })
    );

    const results = settled.map((s, i) =>
      s.status === "fulfilled"
        ? { ...s.value, success: true }
        : {
            name: partners[i].name,
            newsCount: 0,
            nudgeCount: 0,
            success: false,
            error: s.reason?.message ?? "Unknown error",
          }
    );

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalNudges = results.reduce((sum, r) => sum + r.nudgeCount, 0);
    const totalNews = results.reduce((sum, r) => sum + r.newsCount, 0);

    console.log(
      `[cron/nudge-refresh] Partners: ${succeeded} ok, ${failed} failed | Nudges: ${totalNudges} | News: ${totalNews}`
    );

    return NextResponse.json({
      partners: partners.length,
      succeeded,
      failed,
      totalNudges,
      totalNews,
      details: results,
    });
  } catch (err) {
    console.error("[cron/nudge-refresh] Fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

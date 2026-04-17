import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { refreshNudgesForPartner, enrichNudgesWithInsights } from "@/lib/services/nudge-engine";
import { ingestNewsForPartner } from "@/lib/services/news-ingestion-service";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { refreshCompanyBrief } from "@/lib/services/llm-company-brief";

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

    // Company Brief refresh (non-blocking)
    let briefsRefreshed = 0;
    try {
      briefsRefreshed = await refreshStaleCompanyBriefs();
    } catch (err) {
      console.error("[cron/nudge-refresh] Company Brief refresh failed:", err);
    }

    return NextResponse.json({
      partners: partners.length,
      succeeded,
      failed,
      totalNudges,
      totalNews,
      briefsRefreshed,
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

async function refreshStaleCompanyBriefs(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const activeCompanies = await prisma.company.findMany({
    where: {
      OR: [
        { contacts: { some: { interactions: { some: { date: { gte: sevenDaysAgo } } } } } },
        { signals: { some: { date: { gte: sevenDaysAgo } } } },
      ],
    },
    select: { id: true, name: true, industry: true },
  });

  if (activeCompanies.length === 0) return 0;

  const expiryHours = parseInt(process.env.COMPANY_BRIEF_EXPIRY_HOURS ?? "24", 10);
  const staleThreshold = new Date(Date.now() - expiryHours * 60 * 60 * 1000);

  const companiesToRefresh: typeof activeCompanies = [];
  for (const company of activeCompanies) {
    const latest = await prisma.companyBrief.findFirst({
      where: { companyId: company.id },
      orderBy: { generatedAt: "desc" },
      select: { generatedAt: true },
    });
    if (!latest || latest.generatedAt < staleThreshold) {
      companiesToRefresh.push(company);
    }
  }

  const BATCH_SIZE = 3;
  let refreshed = 0;
  for (let i = 0; i < companiesToRefresh.length; i += BATCH_SIZE) {
    const batch = companiesToRefresh.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((c) => refreshCompanyBrief(c.id, c.name, c.industry ?? ""))
    );
    for (let j = 0; j < batchResults.length; j++) {
      if (batchResults[j].status === "fulfilled") {
        refreshed++;
        console.log(`[cron/company-brief] Refreshed brief for ${batch[j].name}`);
      } else {
        console.error(
          `[cron/company-brief] Failed for ${batch[j].name}:`,
          (batchResults[j] as PromiseRejectedResult).reason?.message ?? "Unknown"
        );
      }
    }
  }

  console.log(`[cron/company-brief] ${refreshed}/${companiesToRefresh.length} briefs refreshed`);
  return refreshed;
}

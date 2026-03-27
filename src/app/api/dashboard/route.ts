import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  contactRepo,
  interactionRepo,
  nudgeRepo,
  meetingRepo,
  signalRepo,
} from "@/lib/repositories";
import { refreshNudgesForPartner } from "@/lib/services/nudge-engine";
import { ingestNewsForPartner } from "@/lib/services/news-ingestion-service";
import { enrichSignalsForDashboard } from "@/lib/dashboard-enrich-news";
import { prisma } from "@/lib/db/prisma";
import { addDays, isBefore } from "date-fns";

export async function GET(_request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    const [
      contactCount,
      openNudgeCount,
      upcomingMeetingCount,
      allUpcomingMeetings,
      clientNewsRaw,
      recentInteractions,
      priorityContacts,
    ] = await Promise.all([
      contactRepo.countByPartnerId(partnerId),
      nudgeRepo.countOpenByPartnerId(partnerId),
      meetingRepo.countUpcomingByPartnerId(partnerId),
      meetingRepo.findUpcomingByPartnerId(partnerId),
      signalRepo.findRecentByPartnerId(partnerId, 40),
      interactionRepo.findRecentByPartnerId(partnerId, 5),
      prisma.contact.findMany({
        where: {
          partnerId,
          importance: { in: ["CRITICAL", "HIGH"] },
        },
        select: { id: true, companyId: true },
      }),
    ]);

    if (openNudgeCount === 0) {
      autoRefreshNudges(partnerId).catch((err) =>
        console.error("[dashboard] Auto-refresh nudges failed:", err)
      );
    }

    const now = new Date();
    const sevenDaysFromNow = addDays(now, 7);
    const upcomingMeetings = allUpcomingMeetings.filter((m) =>
      isBefore(new Date(m.startTime), sevenDaysFromNow)
    );

    const { clientNews, criticalBreakingNews, breakingIds } =
      enrichSignalsForDashboard(clientNewsRaw, priorityContacts, now);

    const clientNewsForResponse = clientNews
      .filter((n) => !breakingIds.has(n.id))
      .map(({ catchyTitle: _c, linkContactId: _l, linkCompanyId: _m, ...rest }) => rest);

    const criticalBreakingResponse = criticalBreakingNews.map((n) => ({
      id: n.id,
      storyKindLabel: n.storyKindLabel,
      catchyTitle: n.catchyTitle,
      date: n.date,
      url: n.url,
      linkContactId: n.linkContactId,
      linkCompanyId: n.linkCompanyId,
    }));

    const recentInteractionsSerialized = recentInteractions.map((i) => ({
      id: i.id,
      type: i.type,
      date: i.date.toISOString(),
      summary: i.summary,
      contact: {
        id: i.contact.id,
        name: i.contact.name,
        company: { name: i.contact.company.name },
      },
    }));

    return NextResponse.json({
      contactCount,
      openNudgeCount,
      upcomingMeetingCount,
      upcomingMeetings: upcomingMeetings.map((m) => ({
        id: m.id,
        title: m.title,
        purpose: m.purpose,
        startTime: m.startTime.toISOString(),
        generatedBrief: m.generatedBrief,
        attendees: m.attendees.map((a) => ({
          contact: {
            id: a.contact.id,
            name: a.contact.name,
            title: a.contact.title,
            importance: a.contact.importance,
            company: { id: a.contact.company.id, name: a.contact.company.name },
          },
        })),
      })),
      clientNews: clientNewsForResponse,
      criticalBreakingNews: criticalBreakingResponse,
      recentInteractions: recentInteractionsSerialized,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

async function autoRefreshNudges(partnerId: string) {
  console.log("[dashboard] No open nudges — auto-refreshing...");
  const newsCount = await ingestNewsForPartner(partnerId);
  const nudgeCount = await refreshNudgesForPartner(partnerId);
  console.log(`[dashboard] Auto-refresh complete: ${newsCount} news, ${nudgeCount} nudges`);
}

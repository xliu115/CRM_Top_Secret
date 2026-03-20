import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  contactRepo,
  nudgeRepo,
  meetingRepo,
  signalRepo,
} from "@/lib/repositories";
import { refreshNudgesForPartner } from "@/lib/services/nudge-engine";
import { ingestNewsForPartner } from "@/lib/services/news-ingestion-service";
import { addDays, isBefore } from "date-fns";

export async function GET(_request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    const [contactCount, openNudgeCount, upcomingMeetingCount, allUpcomingMeetings, clientNews] =
      await Promise.all([
        contactRepo.countByPartnerId(partnerId),
        nudgeRepo.countOpenByPartnerId(partnerId),
        meetingRepo.countUpcomingByPartnerId(partnerId),
        meetingRepo.findUpcomingByPartnerId(partnerId),
        signalRepo.findRecentByPartnerId(partnerId, 15),
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

    const clientNewsSerialized = clientNews.map((s) => ({
      id: s.id,
      type: s.type,
      date: s.date.toISOString(),
      content: s.content,
      url: s.url,
      contact: s.contact
        ? { name: s.contact.name, company: s.contact.company?.name }
        : null,
      company: s.company ? { id: s.company.id, name: s.company.name } : null,
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
      clientNews: clientNewsSerialized,
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

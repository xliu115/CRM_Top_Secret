import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  contactRepo,
  nudgeRepo,
  meetingRepo,
  signalRepo,
  interactionRepo,
} from "@/lib/repositories";
import { refreshNudgesForPartner, enrichNudgesWithInsights } from "@/lib/services/nudge-engine";
import { ingestNewsForPartner } from "@/lib/services/news-ingestion-service";
import { generateMeetingBrief } from "@/lib/services/llm-service";
import { addDays, isBefore } from "date-fns";
import { formatDateForLLM } from "@/lib/utils/format-date";

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
        ? {
            name: s.contact.name,
            importance: s.contact.importance,
            company: s.contact.company?.name,
          }
        : null,
      company: s.company ? { id: s.company.id, name: s.company.name } : null,
    }));

    const meetingsWithoutBriefs = upcomingMeetings.filter((m) => !m.generatedBrief);
    if (meetingsWithoutBriefs.length > 0) {
      generateMissingBriefs(partnerId, meetingsWithoutBriefs.map((m) => m.id)).catch(
        (err) => console.error("[dashboard] Background brief generation failed:", err)
      );
    }

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
  await enrichNudgesWithInsights(partnerId);
  console.log(`[dashboard] Auto-refresh complete: ${newsCount} news, ${nudgeCount} nudges`);
}

async function generateMissingBriefs(partnerId: string, meetingIds: string[]) {
  for (const meetingId of meetingIds.slice(0, 3)) {
    try {
      const meeting = await meetingRepo.findById(meetingId, partnerId);
      if (!meeting || meeting.generatedBrief) continue;

      const attendeeIds = meeting.attendees.map((a) => a.contactId);
      const [interactions, signals] = await Promise.all([
        interactionRepo.findByContactIds(attendeeIds),
        signalRepo.findByContactIds(attendeeIds),
      ]);

      const attendees = meeting.attendees.map((a) => ({
        name: a.contact.name,
        title: a.contact.title,
        company: a.contact.company.name,
        recentInteractions: interactions
          .filter((i) => i.contactId === a.contactId)
          .slice(0, 3)
          .map((i) => `${i.type} (${formatDateForLLM(i.date)}): ${i.summary}`),
        signals: signals
          .filter((s) => s.contactId === a.contactId)
          .slice(0, 3)
          .map((s) => `${s.type}: ${s.content}`),
      }));

      const brief = await generateMeetingBrief({
        meetingTitle: meeting.title,
        meetingPurpose: meeting.purpose || "",
        attendees,
      });

      await meetingRepo.updateBrief(meetingId, brief);
      console.log(`[dashboard] Generated brief for meeting ${meetingId}`);
    } catch (err) {
      console.warn(`[dashboard] Failed to generate brief for meeting ${meetingId}:`, err);
    }
  }
}

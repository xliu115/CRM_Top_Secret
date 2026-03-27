import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { nudgeRepo, meetingRepo, signalRepo, partnerRepo } from "@/lib/repositories";
import { generateNarrativeBriefing, type NarrativeBriefingContext } from "@/lib/services/llm-service";
import { addDays, isBefore, format, differenceInDays } from "date-fns";

export async function GET(_request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    const [partner, openNudges, allUpcomingMeetings, clientNews] =
      await Promise.all([
        partnerRepo.findById(partnerId),
        nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" }),
        meetingRepo.findUpcomingByPartnerId(partnerId),
        signalRepo.findRecentByPartnerId(partnerId, 10),
      ]);

    const partnerName = partner?.name ?? "there";
    const now = new Date();

    const topNudges = openNudges.slice(0, 5).map((n) => {
      const daysSince = n.contact.lastContacted
        ? differenceInDays(now, new Date(n.contact.lastContacted))
        : undefined;

      return {
        contactName: n.contact.name,
        company: n.contact.company.name,
        reason: n.reason,
        priority: n.priority,
        contactId: n.contact.id,
        nudgeId: n.id,
        ruleType: n.ruleType,
        daysSince,
      };
    });

    const twoDaysFromNow = addDays(now, 2);
    const nearMeetings = allUpcomingMeetings
      .filter((m) => isBefore(new Date(m.startTime), twoDaysFromNow))
      .slice(0, 3)
      .map((m) => ({
        title: m.title,
        startTime: format(new Date(m.startTime), "EEE h:mm a"),
        attendeeNames: m.attendees.map((a) => a.contact.name),
        meetingId: m.id,
      }));

    const newsItems = clientNews.slice(0, 5).map((s) => ({
      content: s.content,
      contactName: s.contact?.name,
      company: s.contact?.company?.name ?? s.company?.name,
    }));

    const ctx: NarrativeBriefingContext = {
      partnerName,
      nudges: topNudges,
      meetings: nearMeetings,
      clientNews: newsItems,
    };

    const result = await generateNarrativeBriefing(ctx);

    return NextResponse.json({
      briefing: result.narrative,
      topActions: result.topActions,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[dashboard/briefing] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

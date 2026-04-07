import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { nudgeRepo, meetingRepo, signalRepo, partnerRepo } from "@/lib/repositories";
import { generateNarrativeBriefing, type NarrativeBriefingContext } from "@/lib/services/llm-service";
import { refreshNudgesForPartner } from "@/lib/services/nudge-engine";
import { addDays, isBefore, format, differenceInDays } from "date-fns";

export async function GET(_request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    await refreshNudgesForPartner(partnerId);

    const [partner, openNudges, allUpcomingMeetings, clientNews] =
      await Promise.all([
        partnerRepo.findById(partnerId),
        nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" }),
        meetingRepo.findUpcomingByPartnerId(partnerId),
        signalRepo.findRecentByPartnerId(partnerId, 10),
      ]);

    const partnerName = partner?.name ?? "there";
    const now = new Date();

    const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const sortedNudges = [...openNudges].sort(
      (a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
    );

    const reservedTypes = new Set(["CAMPAIGN_APPROVAL", "ARTICLE_CAMPAIGN", "FOLLOW_UP"]);
    const reserved = sortedNudges.filter((n) => reservedTypes.has(n.ruleType));
    const otherNudges = sortedNudges.filter((n) => !reservedTypes.has(n.ruleType));
    const seen = new Set<string>();
    const dedupedReserved = reserved.filter((n) => {
      if (seen.has(n.ruleType)) return false;
      seen.add(n.ruleType);
      return true;
    });
    const remainingSlots = Math.max(0, 5 - dedupedReserved.length);
    const mergedNudges = [...dedupedReserved, ...otherNudges.slice(0, remainingSlots)];

    const topNudges = mergedNudges.map((n) => {
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
        metadata: n.metadata ?? undefined,
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

    const newsWithUrls = clientNews.slice(0, 5).map((s) => ({
      content: s.content,
      contactName: s.contact?.name,
      company: s.contact?.company?.name ?? s.company?.name,
      companyId: s.company?.id,
      url: s.url,
    }));

    return NextResponse.json({
      briefing: result.narrative,
      topActions: result.topActions,
      structured: {
        nudges: topNudges,
        meetings: nearMeetings,
        news: newsWithUrls,
      },
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

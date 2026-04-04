import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  nudgeRepo,
  meetingRepo,
  signalRepo,
  partnerRepo,
  interactionRepo,
} from "@/lib/repositories";
import {
  buildTopNudgePayloads,
  mapLatestInteractionSummaryByContact,
} from "@/lib/services/briefing-nudge-payload";
import {
  generateNarrativeBriefing,
  generateVoiceMemoScript,
  generateVoiceMemoScriptFallback,
  type NarrativeBriefingContext,
} from "@/lib/services/llm-service";
import { buildDataDrivenSummaryMarkdown } from "@/lib/services/structured-briefing";
import { synthesizeVoiceMemo } from "@/lib/services/voice-briefing-service";
import { refreshNudgesForPartner } from "@/lib/services/nudge-engine";
import { addDays, isBefore, format } from "date-fns";

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

    const topContactIds = sortedNudges.slice(0, 5).map((n) => n.contact.id);
    const interactionsForTop =
      topContactIds.length > 0
        ? await interactionRepo.findByContactIds(topContactIds)
        : [];
    const latestSummaryByContact = mapLatestInteractionSummaryByContact(
      interactionsForTop.map((i) => ({ contactId: i.contactId, summary: i.summary }))
    );

    const topNudges = buildTopNudgePayloads(sortedNudges, now, latestSummaryByContact);

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

    const [result, voiceSegments] = await Promise.all([
      generateNarrativeBriefing(ctx),
      generateVoiceMemoScript(ctx).catch((err) => {
        console.warn("[dashboard/briefing] Voice script generation failed:", err);
        return generateVoiceMemoScriptFallback(ctx);
      }),
    ]);
    let dataDrivenSummary = "";
    try {
      dataDrivenSummary = buildDataDrivenSummaryMarkdown(ctx);
    } catch (ddErr) {
      console.error("[dashboard/briefing] dataDrivenSummary failed:", ddErr);
    }

    let voiceMemo = null;
    try {
      voiceMemo = await synthesizeVoiceMemo(partnerId, voiceSegments);
    } catch (voiceErr) {
      console.warn("[dashboard/briefing] Voice memo skipped:", voiceErr);
    }

    const newsWithUrls = clientNews.slice(0, 5).map((s) => ({
      content: s.content,
      contactName: s.contact?.name,
      company: s.contact?.company?.name ?? s.company?.name,
      companyId: s.company?.id,
      url: s.url,
    }));

    const voiceOutline = voiceSegments.map(({ id, headline, script, deeplink }) => ({
      id,
      headline,
      script,
      ...(deeplink ? { deeplink } : {}),
    }));

    return NextResponse.json({
      briefing: result.narrative,
      topActions: result.topActions,
      voiceMemo,
      voiceOutline,
      dataDrivenSummary,
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

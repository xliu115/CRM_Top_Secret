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
import { refreshNudgesForPartner, enrichNudgesWithInsights } from "@/lib/services/nudge-engine";
import { pregenerateTopNudgeEmails } from "@/lib/services/nudge-email-cache";
import { addDays, isBefore, format, differenceInDays } from "date-fns";

export async function GET(_request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    // Fire-and-forget: refreshing nudges + generating strategic insights for
    // *every* open nudge is a 1–3 minute LLM-bound operation. Awaiting it
    // here makes the morning brief feel like it never loads. We instead let
    // these run in the background so this request renders fast against the
    // current DB state; the next open of /mobile will see the freshened data.
    // (`/api/nudges/refresh` and the cron job remain available for explicit
    // refreshes.)
    void (async () => {
      try {
        await refreshNudgesForPartner(partnerId);
        await enrichNudgesWithInsights(partnerId);
      } catch (bgErr) {
        console.warn(
          "[dashboard/briefing] background refresh/enrich failed:",
          bgErr,
        );
      }
    })();

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
    const typeOrder: Record<string, number> = {
      MEETING_PREP: 0, REPLY_NEEDED: 1, JOB_CHANGE: 2, STALE_CONTACT: 3,
      FOLLOW_UP: 4, CAMPAIGN_APPROVAL: 5, ARTICLE_CAMPAIGN: 6,
      LINKEDIN_ACTIVITY: 7, EVENT_ATTENDED: 8, EVENT_REGISTERED: 9,
      ARTICLE_READ: 10, UPCOMING_EVENT: 11, COMPANY_NEWS: 12,
    };
    const sortedNudges = [...openNudges].sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 4;
      const pb = priorityOrder[b.priority] ?? 4;
      if (pa !== pb) return pa - pb;
      return (typeOrder[a.ruleType] ?? 99) - (typeOrder[b.ruleType] ?? 99);
    });

    const reservedTypes = new Set(["CAMPAIGN_APPROVAL", "ARTICLE_CAMPAIGN", "FOLLOW_UP", "REPLY_NEEDED"]);
    const reserved = sortedNudges.filter((n) => reservedTypes.has(n.ruleType));
    const otherNudges = sortedNudges.filter((n) => !reservedTypes.has(n.ruleType));
    const seen = new Set<string>();
    const dedupedReserved = reserved.filter((n) => {
      if (n.ruleType === "ARTICLE_CAMPAIGN") return true;
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

    // Speculative pre-generation: warm the email-draft cache for the nudges
    // shown in the brief. By the time the partner taps "Draft email" on a
    // priority pill, the LLM call is already done. Fire-and-forget — never
    // blocks the response, never throws.
    const pregenIds = mergedNudges
      .filter((n) => !n.generatedEmail)
      .slice(0, 3)
      .map((n) => n.id);
    if (pregenIds.length > 0) {
      pregenerateTopNudgeEmails(pregenIds);
    }

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

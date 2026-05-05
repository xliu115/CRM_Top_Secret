import { createHash } from "node:crypto";
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

// Per-partner timestamps of the last destructive nudge refresh. Lives in the
// process; resets on dev restart, which is fine — the goal is just to keep
// concurrent / rapid brief loads from stomping on each other's email cache.
const REFRESH_THROTTLE_MS = 5 * 60 * 1000;
const lastRefreshAt = new Map<string, number>();

// Per-partner full-response cache. Building a brief involves three serial
// LLM/TTS calls (narrative, voice script, voice synthesis) that together run
// 25–40 seconds. The output only changes when the underlying nudge set
// changes, so we cache the full JSON keyed by (partnerId, nudge-set-hash)
// for the configured TTL. This makes browser reloads during the demo
// instant; the first load (or one triggered by the prewarm script) pays the
// generation cost.
const BRIEFING_TTL_MS = (() => {
  const raw = Number(process.env.BRIEFING_CACHE_TTL_MIN);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 60;
  return minutes * 60 * 1000;
})();
type CachedBriefing = {
  expiresAt: number;
  nudgeHash: string;
  body: unknown;
};
const briefingCache = new Map<string, CachedBriefing>();

function hashNudgeSet(
  nudges: { id: string; status: string; metadata: string | null }[],
): string {
  const h = createHash("sha1");
  for (const n of nudges) {
    h.update(n.id);
    h.update("|");
    h.update(n.status);
    h.update("|");
    h.update(n.metadata ?? "");
    h.update("\n");
  }
  return h.digest("hex");
}

function shouldRunRefresh(partnerId: string): boolean {
  // Hard-disable for demos. When set, refresh only happens via the explicit
  // /api/nudges/refresh endpoint, the cron job, or the prewarm script. This
  // keeps the email-draft and strategic-insight caches stable across browser
  // reloads, which makes the action-card tap feel instant.
  if (process.env.BRIEFING_DISABLE_AUTO_REFRESH === "1") return false;
  const last = lastRefreshAt.get(partnerId) ?? 0;
  if (Date.now() - last < REFRESH_THROTTLE_MS) return false;
  lastRefreshAt.set(partnerId, Date.now());
  return true;
}

export async function GET(_request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    // Fire-and-forget background refresh — and crucially, throttle the
    // *destructive* part of it.
    //
    // refreshNudgesForPartner deletes every OPEN nudge and recreates them with
    // fresh IDs. If we run that on every brief load, in-flight email/insight
    // pregeneration from the previous load lands on stale IDs (Prisma P2025
    // "record not found" spam) and the email-draft cache never sticks — every
    // tap of "View drafted email" triggers a fresh ~10s LLM call.
    //
    // Instead we throttle the refresh to once per REFRESH_THROTTLE_MS per
    // partner. Enrichment + email pregeneration stay non-throttled because
    // they are idempotent (each skips items that are already cached) and
    // cheap to repeat. `/api/nudges/refresh` and the cron job remain the
    // explicit-refresh paths.
    if (shouldRunRefresh(partnerId)) {
      void (async () => {
        try {
          await refreshNudgesForPartner(partnerId);
        } catch (bgErr) {
          console.warn(
            "[dashboard/briefing] background refresh failed:",
            bgErr,
          );
        }
      })();
    }
    void (async () => {
      try {
        await enrichNudgesWithInsights(partnerId);
      } catch (bgErr) {
        console.warn(
          "[dashboard/briefing] background enrich failed:",
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

    // Cache lookup — keyed by partner + nudge-set hash so a refresh
    // automatically busts it. The DB queries above are <100ms total; the
    // expensive part is everything below.
    const nudgeHash = hashNudgeSet(openNudges);
    const cached = briefingCache.get(partnerId);
    if (
      cached &&
      cached.expiresAt > Date.now() &&
      cached.nudgeHash === nudgeHash
    ) {
      return NextResponse.json(cached.body);
    }

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
    // Always reserve a slot for the top URGENT/HIGH non-reserved nudge (e.g.
    // a fresh JOB_CHANGE / executive transition or escalated stale contact)
    // so a wave of article campaigns can't squeeze a high-priority signal
    // out of the brief. Falls back to the original "fill up to 5" behavior
    // when no high-priority other nudges exist.
    const hasHighPriorityOther = otherNudges.some(
      (n) => n.priority === "URGENT" || n.priority === "HIGH",
    );
    const remainingSlots = Math.max(
      hasHighPriorityOther ? 1 : 0,
      5 - dedupedReserved.length,
    );
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

    // Speculative pre-generation: warm the email-draft cache for every
    // contact nudge in the brief (CAMPAIGN_APPROVAL / ARTICLE_CAMPAIGN are
    // picker-driven and don't open a single drafted email, so we skip them).
    // By the time the partner taps "View drafted email" on any contact, the
    // LLM call is already done. Fire-and-forget — never blocks the response,
    // never throws.
    const pregenIds = mergedNudges
      .filter(
        (n) =>
          !n.generatedEmail &&
          n.ruleType !== "CAMPAIGN_APPROVAL" &&
          n.ruleType !== "ARTICLE_CAMPAIGN",
      )
      .map((n) => n.id);
    if (pregenIds.length > 0) {
      pregenerateTopNudgeEmails(pregenIds, { concurrency: 3 });
    }

    const responseBody = {
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
    };
    briefingCache.set(partnerId, {
      expiresAt: Date.now() + BRIEFING_TTL_MS,
      nudgeHash,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
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

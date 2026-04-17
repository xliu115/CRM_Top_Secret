import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { contactRepo, partnerRepo, interactionRepo, signalRepo, meetingRepo, nudgeRepo, type NudgeWithRelations } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { retrieveContext, searchWeb } from "@/lib/services/rag-service";
import { generateChatAnswer, generateEmail, generateMeetingBrief } from "@/lib/services/llm-service";
import { generateNote } from "@/lib/services/llm-email";
import { generateStrategicInsight } from "@/lib/services/llm-insight";
import {
  generateQuick360,
  generateContact360,
  type Contact360Context,
} from "@/lib/services/llm-contact360";
import { generateCompany360, generateMiniFinancialSnapshot, computeIntensity, type Company360Context } from "@/lib/services/llm-company360";
import { classifyIntent, type IntentType } from "@/lib/services/llm-intent";
import { parseStructuredBrief, type StructuredBrief } from "@/lib/types/structured-brief";
import {
  buildSummaryFragments,
  type InsightData,
  type SentenceFragment,
} from "@/lib/utils/nudge-summary";
import type { ChatBlock } from "@/lib/types/chat-blocks";
import { formatDateForLLM, formatDateTimeForLLM } from "@/lib/utils/format-date";
import { differenceInDays, format } from "date-fns";

const FULL_CONTACT_360_INTENT =
  /\b(full\s+contact\s*360)\b/i;
const QUICK_360_INTENT =
  /\b(tell me (?:everything|all) about|contact ?360|recap|dossier|what do (?:you|we) know about|full (?:intel|intelligence) on|brief me on|quick ?360)\b/i;
const COMPANY_360_INTENT =
  /\b(company ?360|company dossier|tell me about (?:the )?company|company intel(?:ligence)?)\b/i;
const DRAFT_EMAIL_INTENT =
  /\b(draft (?:an? )?(?:[\w-]+ ){0,4}email|write (?:an? )?(?:[\w-]+ ){0,4}email|email draft|compose (?:an? )?(?:[\w-]+ ){0,4}email|draft (?:a )?(?:follow[- ]?up|reply|check[- ]?in|thank[- ]?you|congrat\w*|intro(?:duction)?) to)\b/i;
const SHARE_DOSSIER_INTENT =
  /\b(share (?:the )?dossier|share (?:the )?360|send (?:the )?dossier)\b/i;
const MEETING_PREP_INTENT =
  /\b(prep(?:are)?\s+(?:me\s+)?for\s+(?:the\s+)?|meeting (?:brief|prep)\s+(?:for\s+)?)/i;
const MEETINGS_TODAY_INTENT =
  /\b((?:show|list|what are)\s+(?:my\s+)?meetings?\s+(?:today|this week|upcoming)|my meetings?\s+today|today'?s?\s+meetings?|upcoming meetings?)\b/i;
const DAILY_PRIORITIES_INTENT =
  /\b(what should I\s+(?:do|focus on|prioritize)|(?:what (?:are|do I need to do)|my)\s+(?:priorities|today)|today'?s?\s+(?:priorities|plan|agenda)|plan (?:my day|for (?:today|the day))|(?:help me )?plan (?:my )?(?:today|day))\b/i;
const NEEDS_ATTENTION_INTENT = new RegExp(
  [
    "(?:who|which)\\s+(?:contacts?|clients?|people)\\s+need\\s+(?:attention|outreach|follow.?up)",
    "(?:who|which)\\s+(?:contacts?|clients?|people)\\s+haven'?t\\s+I\\s+(?:spoken|talked|reached|contacted)",
    "(?:who|which)\\s+(?:contacts?|clients?|people)\\s+are\\s+(?:stale|cold|overdue|at.?risk)",
    "(?:who|which)\\s+(?:contacts?|clients?|people)\\s+(?:I\\s+)?haven'?t\\s+(?:spoken|talked|reached)",
    "who\\s+(?:needs?|is\\s+needing)\\s+(?:attention|outreach|follow.?up)",
    "who\\s+haven'?t\\s+I\\s+(?:spoken|talked|reached|contacted)\\s+(?:to\\s+)?(?:in|for|since|recently|lately)?",
    "contacts?\\s+(?:I\\s+)?haven'?t\\s+(?:spoken|talked|reached)\\s+(?:to|out)",
    "contacts?\\s+(?:I\\s+)?(?:haven'?t|not)\\s+(?:spoken|talked|reached|contacted)\\s+(?:to\\s+)?(?:in|for|since|recently|lately)",
    "need(?:s|ing)?\\s+(?:attention|follow.?up)",
    "at.?risk\\s+(?:contacts?|clients?|relationships?)",
    "stale\\s+contacts?",
    "overdue\\s+(?:contacts?|follow.?ups?)",
    "contacts?\\s+going\\s+cold",
  ].join("|"),
  "i",
);
const NUDGE_SUMMARY_INTENT =
  /\b(nudge summary|show (?:me )?(?:the )?(?:nudge|evidence|summary) for|why (?:should I |do I need to )?(?:reach out|contact|follow up)|outreach summary)\b/i;
const FIRM_RELATIONSHIPS_INTENT =
  /\b(who (?:else )?(?:knows|covers|has (?:a )?relationship)|(?:firm|shared|cross)[- ](?:relationships?|coverage)|other partners (?:at|for|with)|introductions? (?:to|for)|who knows my contacts?)\b/i;
const CLIENT_UPDATES_INTENT =
  /\b((?:what'?s|any) (?:the )?(?:latest|new|updates?|news) (?:with|on|about|for) (?:my )?(?:top |key )?(?:clients?|contacts?|accounts?)|(?:client|contact|account) (?:updates?|activity|news)|recent (?:news|activity|updates?) (?:on|about|for) (?:my )?(?:clients?|contacts?)|top clients? (?:updates?|news))\b/i;
const WEEKLY_SUMMARY_INTENT =
  /\b(summarize (?:my )?(?:week|past week)|weekly (?:recap|summary|review|report)|(?:my )?week in review|(?:what (?:happened|did I do)|recap (?:of )?(?:the |my )?(?:past |this )?week)|(?:my|this) (?:past )?week(?:'?s)? (?:summary|recap))\b/i;

const ALL_INTENTS = [FULL_CONTACT_360_INTENT, QUICK_360_INTENT, COMPANY_360_INTENT, DRAFT_EMAIL_INTENT, SHARE_DOSSIER_INTENT, MEETING_PREP_INTENT, MEETINGS_TODAY_INTENT, DAILY_PRIORITIES_INTENT, NEEDS_ATTENTION_INTENT, NUDGE_SUMMARY_INTENT, FIRM_RELATIONSHIPS_INTENT, CLIENT_UPDATES_INTENT, WEEKLY_SUMMARY_INTENT];

function extractNameFromQuery(query: string): string {
  let cleaned = query;
  for (const re of ALL_INTENTS) cleaned = cleaned.replace(re, "");
  cleaned = cleaned
    .replace(/\bfor\b/i, "")
    .replace(/\bto\b/i, "")
    .replace(/[?.,!]/g, "")
    .trim();
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    let body: {
      message?: string;
      history?: { role: "user" | "assistant"; content: string }[];
      context?: { nudgeId?: string; contactId?: string; meetingId?: string };
    } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const ctx_ids = body.context ?? {};
    const partner = await partnerRepo.findById(partnerId);
    const partnerName = partner?.name ?? "User";

    // ── Intent detection (LLM classifier with regex fallback) ────────
    let detectedIntent: IntentType = "general_question";
    let detectedEntity: string | null = null;

    const classified = await classifyIntent(message, body.history).catch((err) => {
      console.error("[chat] LLM intent classification failed, using regex fallback:", err);
      return null;
    });

    // Regex always runs — produces a definitive signal when pattern matches.
    // Order matters: more specific intents checked before broader ones (e.g., weekly_summary before quick_360 to prevent "recap" collision).
    let regexIntent: IntentType = "general_question";
    if (FULL_CONTACT_360_INTENT.test(message)) regexIntent = "full_360";
    else if (WEEKLY_SUMMARY_INTENT.test(message)) regexIntent = "weekly_summary";
    else if (QUICK_360_INTENT.test(message)) regexIntent = "quick_360";
    else if (COMPANY_360_INTENT.test(message)) regexIntent = "company_360";
    else if (DRAFT_EMAIL_INTENT.test(message)) regexIntent = "draft_email";
    else if (SHARE_DOSSIER_INTENT.test(message)) regexIntent = "share_dossier";
    else if (MEETING_PREP_INTENT.test(message)) regexIntent = "meeting_prep";
    else if (MEETINGS_TODAY_INTENT.test(message)) regexIntent = "meetings_today";
    else if (DAILY_PRIORITIES_INTENT.test(message)) regexIntent = "daily_priorities";
    else if (NEEDS_ATTENTION_INTENT.test(message)) regexIntent = "needs_attention";
    else if (NUDGE_SUMMARY_INTENT.test(message)) regexIntent = "nudge_summary";
    else if (FIRM_RELATIONSHIPS_INTENT.test(message)) regexIntent = "firm_relationships";
    else if (CLIENT_UPDATES_INTENT.test(message)) regexIntent = "client_updates";

    if (classified && classified.confidence >= 0.5 && classified.intent !== "general_question") {
      detectedIntent = classified.intent;
      detectedEntity = classified.entity;
    } else if (regexIntent !== "general_question") {
      detectedIntent = regexIntent;
      detectedEntity = extractNameFromQuery(message);
    } else if (classified && classified.confidence >= 0.5) {
      detectedIntent = classified.intent;
      detectedEntity = classified.entity;
    }

    // Regex override: if regex matched a specific intent but LLM said general_question, trust the regex
    if (detectedIntent === "general_question" && regexIntent !== "general_question") {
      detectedIntent = regexIntent;
      detectedEntity = detectedEntity || extractNameFromQuery(message);
    }

    // ── Nudge-type-aware intent override ─────────────────────────────
    // When a nudgeId is provided (user clicked a specific nudge action),
    // check the nudge's ruleType to ensure correct routing:
    // - Only MEETING_PREP nudges should route to the meeting brief path
    // - All other contact nudges route to strategic insights + drafted email
    let overrideNudge: NudgeWithRelations | null = null;
    if (ctx_ids.nudgeId) {
      const nudgeLookup = await prisma.nudge.findUnique({
        where: { id: ctx_ids.nudgeId },
        include: { contact: { include: { company: true } }, signal: true },
      }).catch(() => null);

      if (nudgeLookup) {
        overrideNudge = nudgeLookup as NudgeWithRelations;
        if (nudgeLookup.ruleType !== "MEETING_PREP") {
          detectedIntent = "nudge_summary";
        }
      } else if (ctx_ids.contactId) {
        const fallbackNudges = await nudgeRepo.findByContactId(ctx_ids.contactId).catch(() => []);
        const openFallback = fallbackNudges.filter((n) => n.status === "OPEN");
        if (openFallback.length > 0) {
          const nonMeeting = openFallback.find((n) => n.ruleType !== "MEETING_PREP") ?? openFallback[0];
          overrideNudge = nonMeeting;
          if (nonMeeting.ruleType !== "MEETING_PREP") {
            detectedIntent = "nudge_summary";
          }
        } else {
          detectedIntent = "nudge_summary";
        }
      } else {
        detectedIntent = "nudge_summary";
      }
    }

    const isMeetingPrep = detectedIntent === "meeting_prep";
    const isMeetingsToday = detectedIntent === "meetings_today";
    const isDailyPriorities = detectedIntent === "daily_priorities";
    const isNeedsAttention = detectedIntent === "needs_attention";
    const isNudgeSummary = detectedIntent === "nudge_summary";
    const isFullContact360 = detectedIntent === "full_360";
    const isQuick360 = detectedIntent === "quick_360";
    const isCompany360 = detectedIntent === "company_360";
    const isDraftEmail = detectedIntent === "draft_email";
    const isDraftNote = detectedIntent === "draft_note";
    const isShareDossier = detectedIntent === "share_dossier";
    const isFirmRelationships = detectedIntent === "firm_relationships";
    const isClientUpdates = detectedIntent === "client_updates";
    const isWeeklySummary = detectedIntent === "weekly_summary";

    // ── Meeting Prep ─────────────────────────────────────────────────
    if (isMeetingPrep) {
      try {
        const meetingTitle = detectedEntity || message
          .replace(MEETING_PREP_INTENT, "")
          .replace(/\bmeeting\b/i, "")
          .replace(/[?.,!]/g, "")
          .trim();

        const meetings = await meetingRepo.findUpcomingByPartnerId(partnerId);
        let match = ctx_ids.meetingId
          ? meetings.find((m) => m.id === ctx_ids.meetingId)
          : undefined;
        if (!match) {
          match = meetings.find((m) =>
            m.title.toLowerCase().includes(meetingTitle.toLowerCase())
          ) ?? meetings[0];
        }

        if (match) {
          const attendeeIds = match.attendees.map((a) => a.contactId);
          const [interactionsByContact, signalsByContact] = await Promise.all([
            interactionRepo.findByContactIds(attendeeIds).catch(() => []),
            signalRepo.findByContactIds(attendeeIds).catch(() => []),
          ]);

          const attendees = match.attendees.map((a) => {
            const c = a.contact;
            return {
              name: c.name,
              title: c.title ?? "",
              company: c.company?.name ?? "",
              recentInteractions: interactionsByContact
                .filter((i) => i.contactId === c.id)
                .slice(0, 3)
                .map((i) => `${i.type} (${formatDateForLLM(i.date)}): ${i.summary}`),
              signals: signalsByContact
                .filter((s) => s.contactId === c.id)
                .slice(0, 3)
                .map((s) => `${s.type}: ${s.content}`),
            };
          });

          const briefRaw = await generateMeetingBrief({
            meetingTitle: match.title,
            meetingPurpose: match.purpose ?? "",
            attendees,
          });

          const structured = parseStructuredBrief(briefRaw);
          const briefBody = structured
            ? structuredBriefToMarkdown(structured)
            : briefRaw;

          const md = [
            `## Meeting Prep: ${match.title}`,
            `*${new Date(match.startTime).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}*`,
            "",
            briefBody,
            "",
            `---`,
            ...match.attendees.map((a) =>
              `<!--QUICK_ACTIONS:${JSON.stringify([
                { label: `Draft Email to ${a.contact.name}`, query: `Draft email to ${a.contact.name}` },
              ])}-->`
            ).slice(0, 1),
          ].filter(Boolean).join("\n\n");

          const meetingBlocks: ChatBlock[] = [
            {
              type: "meeting_card",
              data: {
                title: match.title,
                startTime: new Date(match.startTime).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
                attendees: match.attendees.map((a) => ({ name: a.contact.name, title: a.contact.title ?? undefined })),
                meetingId: match.id,
                purpose: match.purpose ?? undefined,
              },
            },
          ];
          if (match.attendees.length > 0) {
            const firstAttendee = match.attendees[0].contact.name;
            meetingBlocks.push({
              type: "action_bar",
              data: {
                primary: { label: `Draft Email to ${firstAttendee}`, query: `Draft email to ${firstAttendee}`, icon: "mail" },
                secondary: match.attendees.slice(1, 4).map((a) => ({
                  label: `Email ${a.contact.name}`,
                  query: `Draft email to ${a.contact.name}`,
                  icon: "mail",
                })),
              },
            });
          }
          return NextResponse.json({ answer: stripMarkers(md), sources: [], blocks: meetingBlocks });
        }

        return NextResponse.json({
          answer: "I couldn't find an upcoming meeting matching that title. Try \"Show my meetings today\" to see what's scheduled.",
          sources: [],
        });
      } catch (err) {
        console.error("[chat] meeting prep intent failed:", err);
      }
    }

    // ── Meetings Today / Upcoming ────────────────────────────────────
    if (isMeetingsToday) {
      try {
        const meetings = await meetingRepo.findUpcomingByPartnerId(partnerId);
        if (meetings.length === 0) {
          return NextResponse.json({
            answer: "You don't have any upcoming meetings on your calendar. Looks like a good day to do proactive outreach!",
            sources: [],
          });
        }

        const lines = meetings.slice(0, 10).map((m) => {
          const time = new Date(m.startTime).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          const attendeeNames = m.attendees.map((a) => a.contact.name).join(", ");
          return `### ${m.title}\n**When:** ${time}\n**Attendees:** ${attendeeNames}${m.purpose ? `\n**Purpose:** ${m.purpose}` : ""}`;
        });

        const quickActions = meetings.slice(0, 3).map((m) => ({
          label: `Prep for ${m.title.length > 20 ? m.title.slice(0, 20) + "..." : m.title}`,
          query: `Prepare me for the ${m.title} meeting`,
        }));

        const md = [
          `## Your Upcoming Meetings (${meetings.length})`,
          "",
          ...lines,
          "",
          `<!--QUICK_ACTIONS:${JSON.stringify(quickActions)}-->`,
        ].join("\n\n");

        const meetingBlocks: ChatBlock[] = meetings.slice(0, 10).map((m) => ({
          type: "meeting_card" as const,
          data: {
            title: m.title,
            startTime: new Date(m.startTime).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
            attendees: m.attendees.map((a) => ({ name: a.contact.name, title: a.contact.title ?? undefined })),
            meetingId: m.id,
            purpose: m.purpose ?? undefined,
          },
        }));
        meetingBlocks.push({
          type: "action_bar",
          data: {
            primary: {
              label: quickActions[0]?.label ?? "Prep for meeting",
              query: quickActions[0]?.query ?? "",
              icon: "calendar",
            },
            secondary: quickActions.slice(1).map((qa) => ({ label: qa.label, query: qa.query, icon: "calendar" })),
          },
        });
        const cleanMeetingAnswer = `## Your Upcoming Meetings (${meetings.length})`;
        return NextResponse.json({ answer: cleanMeetingAnswer, sources: [], blocks: meetingBlocks });
      } catch (err) {
        console.error("[chat] meetings today intent failed:", err);
      }
    }

    // ── Daily Priorities ─────────────────────────────────────────────
    if (isDailyPriorities) {
      try {
        const [openNudges, meetings, staleContacts] = await Promise.all([
          nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" }).catch(() => []),
          meetingRepo.findUpcomingByPartnerId(partnerId).catch(() => []),
          prisma.contact.findMany({
            where: {
              partnerId,
              importance: { in: ["CRITICAL", "HIGH"] },
              interactions: {
                every: { date: { lt: new Date(Date.now() - 30 * 86400000) } },
              },
            },
            include: { company: true, interactions: { orderBy: { date: "desc" }, take: 1 } },
            take: 5,
          }).catch(() => []),
        ]);

        const criticalNudges = openNudges.filter((n) => n.priority === "CRITICAL" || n.priority === "HIGH");
        const todayMeetings = meetings.filter((m) => {
          const mDate = new Date(m.startTime);
          const now = new Date();
          return mDate.toDateString() === now.toDateString();
        });

        const sections: string[] = [`## Your Day at a Glance`, ""];

        if (todayMeetings.length > 0) {
          sections.push(`### Meetings Today (${todayMeetings.length})`);
          todayMeetings.forEach((m) => {
            const time = new Date(m.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            const names = m.attendees.map((a) => a.contact.name).join(", ");
            sections.push(`- **${time}** — ${m.title} *(${names})*`);
          });
          sections.push("");
        }

        if (criticalNudges.length > 0) {
          sections.push(`### Priority Actions (${criticalNudges.length})`);
          criticalNudges.slice(0, 5).forEach((n) => {
            sections.push(`- **${n.contact.name}** (${n.contact.company?.name ?? ""}): ${n.reason}`);
          });
          sections.push("");
        }

        if (staleContacts.length > 0) {
          sections.push(`### Relationships Going Cold`);
          staleContacts.forEach((c) => {
            const lastDate = c.interactions[0]?.date;
            const days = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : "30+";
            sections.push(`- **${c.name}** (${c.company?.name ?? ""}): No contact in ${days} days`);
          });
          sections.push("");
        }

        if (todayMeetings.length === 0 && criticalNudges.length === 0 && staleContacts.length === 0) {
          sections.push("Your slate looks clear today. A great time for proactive outreach or strategic planning!");
        }

        const quickActions: { label: string; query: string }[] = [];
        if (todayMeetings.length > 0) {
          quickActions.push({ label: "Prep for next meeting", query: `Prepare me for the ${todayMeetings[0].title} meeting` });
        }
        const contactOnlyNudge = criticalNudges.find((n) =>
          n.ruleType !== "MEETING_PREP" && n.ruleType !== "CAMPAIGN_APPROVAL" && n.ruleType !== "ARTICLE_CAMPAIGN"
        );
        if (contactOnlyNudge) {
          const topContact = contactOnlyNudge.contact.name;
          quickActions.push({ label: `Quick 360: ${topContact}`, query: `Quick 360 for ${topContact}` });
        }
        quickActions.push({ label: "Who needs attention?", query: "Which contacts need attention?" });

        if (quickActions.length > 0) {
          sections.push(`<!--QUICK_ACTIONS:${JSON.stringify(quickActions)}-->`);
        }

        const priorityBlocks: ChatBlock[] = [];
        if (staleContacts.length > 0) {
          priorityBlocks.push({
            type: "stale_contacts_list",
            data: {
              contacts: staleContacts.map((c) => {
                const lastDate = c.interactions[0]?.date;
                const days = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : 30;
                return {
                  name: c.name,
                  company: c.company?.name ?? "",
                  contactId: c.id,
                  daysSince: days,
                };
              }),
            },
          });
        }
        priorityBlocks.push({
          type: "action_bar",
          data: {
            primary: {
              label: quickActions[0]?.label ?? "Who needs attention?",
              query: quickActions[0]?.query ?? "Which contacts need attention?",
              icon: quickActions[0]?.label?.startsWith("Prep") ? "calendar" : "search",
            },
            secondary: quickActions.slice(1).map((qa) => ({ label: qa.label, query: qa.query, icon: "search" })),
          },
        });

        const cleanSections: string[] = [`## Your Day at a Glance`, ""];
        if (todayMeetings.length > 0) {
          cleanSections.push(`### Meetings Today (${todayMeetings.length})`);
          todayMeetings.forEach((m) => {
            const time = new Date(m.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            const names = m.attendees.map((a) => a.contact.name).join(", ");
            cleanSections.push(`- **${time}** — ${m.title} *(${names})*`);
          });
          cleanSections.push("");
        }
        if (criticalNudges.length > 0) {
          cleanSections.push(`### Priority Actions (${criticalNudges.length})`);
          criticalNudges.slice(0, 5).forEach((n) => {
            cleanSections.push(`- **${n.contact.name}** (${n.contact.company?.name ?? ""}): ${n.reason}`);
          });
          cleanSections.push("");
        }
        if (staleContacts.length > 0) {
          cleanSections.push(`### Relationships Going Cold`);
        }
        if (todayMeetings.length === 0 && criticalNudges.length === 0 && staleContacts.length === 0) {
          cleanSections.push("Your slate looks clear today. A great time for proactive outreach or strategic planning!");
        }
        return NextResponse.json({ answer: cleanSections.join("\n"), sources: [], blocks: priorityBlocks });
      } catch (err) {
        console.error("[chat] daily priorities intent failed:", err);
      }
    }

    // ── Contacts Needing Attention ───────────────────────────────────
    if (isNeedsAttention) {
      try {
        const [openNudges, staleContacts] = await Promise.all([
          nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" }).catch(() => []),
          prisma.contact.findMany({
            where: {
              partnerId,
              importance: { in: ["CRITICAL", "HIGH"] },
              interactions: {
                every: { date: { lt: new Date(Date.now() - 14 * 86400000) } },
              },
            },
            include: { company: true, interactions: { orderBy: { date: "desc" }, take: 1 }, signals: { orderBy: { date: "desc" }, take: 1 } },
            take: 10,
          }).catch(() => []),
        ]);

        const sections: string[] = [`## Contacts Needing Attention`, ""];

        const byPriority: Record<string, NudgeWithRelations[]> = {};
        for (const n of openNudges) {
          const p = n.priority ?? "MEDIUM";
          if (!byPriority[p]) byPriority[p] = [];
          byPriority[p].push(n);
        }

        for (const priority of ["CRITICAL", "HIGH", "MEDIUM"]) {
          const group = byPriority[priority];
          if (!group?.length) continue;
          sections.push(`### ${priority} Priority`);
          group.slice(0, 5).forEach((n) => {
            sections.push(`- **${n.contact.name}** (${n.contact.company?.name ?? ""}): ${n.reason}`);
          });
          sections.push("");
        }

        const nudgeContactIds = new Set(openNudges.map((n) => n.contactId));
        const additionalStale = staleContacts.filter((c) => !nudgeContactIds.has(c.id));
        if (additionalStale.length > 0) {
          sections.push(`### Going Cold (No Recent Interaction)`);
          additionalStale.forEach((c) => {
            const lastDate = c.interactions[0]?.date;
            const days = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : "14+";
            const signal = c.signals[0]?.content?.slice(0, 60);
            sections.push(`- **${c.name}** (${c.company?.name ?? ""}): ${days} days since last contact${signal ? ` — Recent signal: ${signal}` : ""}`);
          });
          sections.push("");
        }

        if (openNudges.length === 0 && additionalStale.length === 0) {
          sections.push("All your key contacts look well-maintained. Nice work keeping up with your relationships!");
        }

        const contactNudges = openNudges.filter((n) =>
          n.ruleType !== "MEETING_PREP" && n.ruleType !== "CAMPAIGN_APPROVAL" && n.ruleType !== "ARTICLE_CAMPAIGN"
        );
        const topContacts = [...contactNudges.slice(0, 2).map((n) => n.contact.name), ...additionalStale.slice(0, 1).map((c) => c.name)];
        const quickActions = topContacts.map((name) => ({
          label: `Quick 360: ${name}`,
          query: `Quick 360 for ${name}`,
        }));
        if (quickActions.length > 0) {
          sections.push(`<!--QUICK_ACTIONS:${JSON.stringify(quickActions)}-->`);
        }

        const attentionBlocks: ChatBlock[] = [];
        const staleListItems = additionalStale.map((c) => {
          const lastDate = c.interactions[0]?.date;
          const days = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : 14;
          const signal = c.signals[0]?.content?.slice(0, 60);
          return { name: c.name, company: c.company?.name ?? "", contactId: c.id, daysSince: days, signal };
        });
        const nudgeListItems = contactNudges.slice(0, 5).map((n) => ({
          name: n.contact.name,
          company: n.contact.company?.name ?? "",
          contactId: n.contactId,
          daysSince: 0,
          signal: n.reason.slice(0, 60),
        }));
        const combinedStale = [...nudgeListItems, ...staleListItems];
        if (combinedStale.length > 0) {
          attentionBlocks.push({ type: "stale_contacts_list", data: { contacts: combinedStale } });
        }
        if (quickActions.length > 0) {
          attentionBlocks.push({
            type: "action_bar",
            data: {
              primary: { label: quickActions[0].label, query: quickActions[0].query, icon: "search" },
              secondary: quickActions.slice(1).map((qa) => ({ label: qa.label, query: qa.query, icon: "search" })),
            },
          });
        }

        const fullMarkdown = sections.join("\n");
        const cleanAnswer = attentionBlocks.length > 0
          ? stripMarkers(`## Contacts Needing Attention\n\nHere are the contacts that need your attention, sorted by priority.`)
          : stripMarkers(fullMarkdown);
        return NextResponse.json({ answer: cleanAnswer, sources: [], blocks: attentionBlocks.length > 0 ? attentionBlocks : undefined });
      } catch (err) {
        console.error("[chat] needs attention intent failed:", err);
      }
    }

    // ── Nudge Summary (evidence-first outreach view) ──────────────────
    if (isNudgeSummary) {
      try {
        const nameQuery = detectedEntity || extractNameFromQuery(message);

        let nudges: NudgeWithRelations[] = [];
        if (overrideNudge) {
          nudges = [overrideNudge];
        } else if (ctx_ids.contactId) {
          nudges = await nudgeRepo.findByContactId(ctx_ids.contactId);
          nudges = nudges.filter((n) => n.status === "OPEN");
        } else if (ctx_ids.nudgeId) {
          const single = await prisma.nudge.findUnique({
            where: { id: ctx_ids.nudgeId },
            include: { contact: { include: { company: true } }, signal: true },
          });
          if (single) nudges = [single as NudgeWithRelations];
        }

        if (nudges.length === 0 && nameQuery) {
          const contacts = await contactRepo.search(nameQuery, partnerId);
          const contact = contacts[0];
          if (contact) {
            nudges = await nudgeRepo.findByContactId(contact.id);
            nudges = nudges.filter((n) => n.status === "OPEN");
          }
        }

        if (nudges.length > 0) {
          const primary = nudges[0];
          const contactName = primary.contact.name;
          const companyName = primary.contact.company?.name ?? "";
          // Collect insights and strategic narrative from all nudges
          let allInsights: InsightData[] = [];
          let strategicNarrative: string | null = null;
          let strategicOneLiner: string | null = null;
          let suggestedAction: { label: string; context?: string } | null = null;

          for (const nudge of nudges) {
            let insights: InsightData[] = [];
            try {
              const meta = JSON.parse(nudge.metadata ?? "{}");
              insights = meta?.insights ?? [];
              if (!strategicNarrative && meta?.strategicInsight?.narrative) {
                strategicNarrative = meta.strategicInsight.narrative;
                strategicOneLiner = meta.strategicInsight.oneLiner ?? null;
                suggestedAction = meta.strategicInsight.suggestedAction ?? null;
              }
            } catch { /* ignore */ }
            allInsights = allInsights.concat(insights);
          }

          // If strategic insight hasn't been enriched yet, generate on the fly
          if (!strategicNarrative && primary.ruleType !== "MEETING_PREP") {
            try {
              const partner = await partnerRepo.findById(partnerId);
              const pName = partner?.name ?? "Partner";
              const insight = await generateStrategicInsight(primary, allInsights, pName);
              if (insight) {
                strategicNarrative = insight.narrative;
                strategicOneLiner = insight.oneLiner;
                suggestedAction = insight.suggestedAction;
                const meta = JSON.parse(primary.metadata ?? "{}");
                meta.strategicInsight = insight;
                nudgeRepo.updateMetadata(primary.id, JSON.stringify(meta)).catch(() => {});
              }
            } catch (err) {
              console.error("[chat] on-the-fly insight generation failed:", err);
            }
          }

          // Unified block-based response for all non-meeting nudge summaries
          {
            const blocks: ChatBlock[] = [
              {
                type: "contact_card",
                data: {
                  name: contactName,
                  title: primary.contact.title ?? undefined,
                  company: companyName || undefined,
                  contactId: primary.contactId,
                  priority: primary.priority ?? undefined,
                },
              },
              {
                type: "strategic_insight",
                data: {
                  narrative: strategicNarrative ?? primary.reason,
                  oneLiner: strategicOneLiner ?? undefined,
                  suggestedAction: suggestedAction ?? undefined,
                  insights: allInsights.map((ins) => ({
                    type: ins.type,
                    reason: ins.reason,
                    signalContent: ins.signalContent,
                    signalUrl: ins.signalUrl ?? undefined,
                  })),
                },
              },
            ];

            // Generate drafted email
            try {
              const contact = primary.contact;
              const company = contact.company;
              const emailCtx = await buildContactContext(contact, company ? { name: company.name, industry: company.industry ?? undefined, employeeCount: company.employeeCount ?? undefined, website: company.website ?? undefined } : undefined, partnerId);
              emailCtx.partnerName = partnerName;

              let nudgeReason = primary.reason;
              if (suggestedAction?.context) {
                nudgeReason = `${primary.reason}. Context: ${suggestedAction.context}`;
              }

              const emailResult = await generateEmail({
                partnerName,
                contactName,
                contactTitle: contact.title ?? "",
                companyName: companyName,
                nudgeReason,
                recentInteractions: emailCtx.interactions.slice(0, 5).map((i) => `${i.type} on ${i.date}: ${i.summary}`),
                signals: emailCtx.signals.slice(0, 3).map((s) => `${s.type}: ${s.content.slice(0, 100)}`),
              });

              blocks.push({
                type: "email_preview",
                data: {
                  to: contactName,
                  subject: emailResult.subject,
                  body: emailResult.body,
                  contactId: primary.contactId,
                },
              });
            } catch (emailErr) {
              console.error("[chat] nudge email generation failed:", emailErr);
            }

            blocks.push({
              type: "action_bar",
              data: {
                primary: { label: "Send Email", query: `Send email to ${contactName}`, icon: "send" },
                secondary: [
                  { label: "Copy Email", query: "__copy_email__", icon: "copy" },
                  { label: "Quick 360", query: `Quick 360 for ${contactName}`, icon: "search" },
                  { label: "Company 360", query: `Company 360 for ${companyName || contactName}`, icon: "briefcase" },
                ],
              },
            });

            return NextResponse.json({
              answer: "",
              sources: [],
              blocks,
            });
          }
        }
      } catch (err) {
        console.error("[chat] nudge summary intent failed:", err);
      }
    }

    // ── Firm Relationships ────────────────────────────────────────────
    if (isFirmRelationships) {
      try {
        const nameQuery = detectedEntity || extractNameFromQuery(message);

        if (!nameQuery) {
          const topContacts = await contactRepo.findByPartnerId(partnerId);
          const critical = topContacts.filter((c) => c.importance === "CRITICAL" || c.importance === "HIGH").slice(0, 8);
          const contactList = critical.length > 0 ? critical : topContacts.slice(0, 8);

          const companyIds = [...new Set(contactList.map((c) => c.companyId))];
          const otherPartners = await prisma.contact.findMany({
            where: { companyId: { in: companyIds }, partnerId: { not: partnerId } },
            select: { companyId: true, partner: { select: { name: true } } },
            distinct: ["companyId", "partnerId"],
          });
          const partnersByCompany = new Map<string, string[]>();
          for (const row of otherPartners) {
            const arr = partnersByCompany.get(row.companyId) ?? [];
            arr.push(row.partner.name);
            partnersByCompany.set(row.companyId, arr);
          }

          const blocks: ChatBlock[] = [];
          const staleItems = contactList.map((c) => {
            const others = partnersByCompany.get(c.companyId) ?? [];
            return {
              name: c.name,
              company: c.company?.name ?? "",
              contactId: c.id,
              daysSince: 0,
              signal: others.length > 0 ? `Also known by: ${others.join(", ")}` : "No other firm relationships found",
            };
          });
          if (staleItems.length > 0) {
            blocks.push({ type: "stale_contacts_list", data: { contacts: staleItems } });
          }
          blocks.push({
            type: "action_bar",
            data: {
              primary: { label: `Quick 360: ${contactList[0]?.name ?? "Contact"}`, query: `Quick 360 for ${contactList[0]?.name ?? ""}`, icon: "search" },
              secondary: contactList.slice(1, 3).map((c) => ({ label: `Quick 360: ${c.name}`, query: `Quick 360 for ${c.name}`, icon: "search" })),
            },
          });

          return NextResponse.json({
            answer: `## Firm Relationships\n\nHere are your key contacts and who else at the firm has relationships with them. Click any contact for a deeper look.`,
            sources: [],
            blocks,
          });
        }

        const contacts = await contactRepo.findByPartnerId(partnerId);
        const matched = contacts.find((c) =>
          c.name.toLowerCase().includes(nameQuery.toLowerCase())
        );
        if (matched) {
          const otherPartners = await prisma.contact.findMany({
            where: { companyId: matched.companyId, partnerId: { not: partnerId } },
            select: { partner: { select: { name: true } }, name: true },
          });
          const partnerNames = [...new Set(otherPartners.map((o) => o.partner.name))];
          const otherContacts = otherPartners.map((o) => `${o.name} (covered by ${o.partner.name})`);

          const blocks: ChatBlock[] = [
            { type: "contact_card", data: { name: matched.name, title: matched.title ?? undefined, company: matched.company?.name ?? undefined, contactId: matched.id } },
            {
              type: "action_bar",
              data: {
                primary: { label: "Quick 360", query: `Quick 360 for ${matched.name}`, icon: "search" },
                secondary: [{ label: "Draft Email", query: `Draft a check-in email to ${matched.name}`, icon: "mail" }],
              },
            },
          ];

          const partnerList = partnerNames.length > 0 ? partnerNames.join(", ") : "No other partners";
          const otherContactList = otherContacts.length > 0 ? `\n\n**Other contacts at ${matched.company?.name ?? "the company"}:**\n${otherContacts.map((c) => `- ${c}`).join("\n")}` : "";
          return NextResponse.json({
            answer: `## Firm Relationships for ${matched.name}\n\n**Other partners with relationships at ${matched.company?.name ?? "the company"}:** ${partnerList}${otherContactList}`,
            sources: [],
            blocks,
          });
        }

        return NextResponse.json({
          answer: `I couldn't find a contact matching "${nameQuery}". Could you try the full name?`,
          sources: [],
        });
      } catch (err) {
        console.error("[chat] firm relationships intent failed:", err);
        return NextResponse.json({ answer: "Sorry, I had trouble looking up firm relationships. Please try again.", sources: [] });
      }
    }

    // ── Client Updates (latest news/signals for top contacts) ────────
    if (isClientUpdates) {
      try {
        const [signals, nudges] = await Promise.all([
          prisma.externalSignal.findMany({
            where: { contact: { partnerId } },
            include: { contact: { include: { company: true } }, company: true },
            orderBy: { date: "desc" },
            take: 15,
          }).catch(() => []),
          nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" }).catch(() => []),
        ]);

        const blocks: ChatBlock[] = [];
        const recentSignals = signals.filter((s) => s.contact?.id).slice(0, 10);

        if (recentSignals.length > 0 || nudges.length > 0) {
          const staleItems = recentSignals.map((s) => ({
            name: s.contact!.name,
            company: s.contact!.company?.name ?? "",
            contactId: s.contact!.id,
            daysSince: Math.floor((Date.now() - new Date(s.date).getTime()) / 86400000),
            signal: `${s.type}: ${s.content.slice(0, 100)}`,
          }));
          if (staleItems.length > 0) {
            blocks.push({ type: "stale_contacts_list", data: { contacts: staleItems } });
          }

          const topNames = [...new Set(recentSignals.slice(0, 3).map((s) => s.contact?.name).filter(Boolean))];
          if (topNames.length > 0) {
            blocks.push({
              type: "action_bar",
              data: {
                primary: { label: `Quick 360: ${topNames[0]}`, query: `Quick 360 for ${topNames[0]}`, icon: "search" },
                secondary: topNames.slice(1).map((n) => ({ label: `Quick 360: ${n}`, query: `Quick 360 for ${n}`, icon: "search" })),
              },
            });
          }
        }

        const signalCount = recentSignals.length;
        const nudgeCount = nudges.length;
        const summary = signalCount > 0 || nudgeCount > 0
          ? `Here are the latest updates across your contacts — ${signalCount} recent signal${signalCount !== 1 ? "s" : ""} and ${nudgeCount} open nudge${nudgeCount !== 1 ? "s" : ""}.`
          : "No recent signals or updates found for your contacts.";

        return NextResponse.json({
          answer: `## Latest Client Updates\n\n${summary}`,
          sources: [],
          blocks: blocks.length > 0 ? blocks : undefined,
        });
      } catch (err) {
        console.error("[chat] client updates intent failed:", err);
        return NextResponse.json({ answer: "Sorry, I had trouble fetching client updates. Please try again.", sources: [] });
      }
    }

    // ── Weekly Summary ──────────────────────────────────────────────
    if (isWeeklySummary) {
      try {
        const weekAgo = new Date(Date.now() - 7 * 86400000);
        const [interactions, meetings, signals, nudges] = await Promise.all([
          prisma.interaction.findMany({
            where: { contact: { partnerId }, date: { gte: weekAgo } },
            include: { contact: { include: { company: true } } },
            orderBy: { date: "desc" },
            take: 50,
          }).catch(() => []),
          prisma.meeting.findMany({
            where: { partnerId, startTime: { gte: weekAgo } },
            include: { attendees: { include: { contact: true } } },
            orderBy: { startTime: "desc" },
          }).catch(() => []),
          prisma.externalSignal.findMany({
            where: { contact: { partnerId }, date: { gte: weekAgo } },
            include: { contact: { include: { company: true } } },
            orderBy: { date: "desc" },
            take: 10,
          }).catch(() => []),
          nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" }).catch(() => []),
        ]);

        const sections: string[] = [`## Your Week in Review`, ""];

        if (meetings.length > 0) {
          sections.push(`### Meetings (${meetings.length})`);
          meetings.forEach((m) => {
            const attendeeNames = m.attendees.map((a) => a.contact.name).join(", ");
            sections.push(`- **${m.title}** — ${formatDateTimeForLLM(m.startTime)}${attendeeNames ? ` with ${attendeeNames}` : ""}`);
          });
          sections.push("");
        }

        if (interactions.length > 0) {
          sections.push(`### Interactions (${interactions.length})`);
          const byType = new Map<string, typeof interactions>();
          for (const i of interactions) {
            const group = byType.get(i.type) ?? [];
            group.push(i);
            byType.set(i.type, group);
          }
          for (const [type, items] of byType) {
            sections.push(`**${type}s:** ${items.length}`);
            items.slice(0, 3).forEach((i) => {
              sections.push(`- ${i.contact.name} (${i.contact.company?.name ?? ""}): ${i.summary.slice(0, 80)}`);
            });
          }
          sections.push("");
        }

        if (signals.length > 0) {
          sections.push(`### Signals & News (${signals.length})`);
          signals.slice(0, 5).forEach((s) => {
            sections.push(`- **${s.contact?.name ?? "Unknown"}**: ${s.content.slice(0, 80)}`);
          });
          sections.push("");
        }

        sections.push(`### Open Nudges: ${nudges.length}`);
        if (nudges.length === 0 && meetings.length === 0 && interactions.length === 0) {
          sections.push("Looks like a quiet week — no interactions, meetings, or signals recorded.");
        }

        const blocks: ChatBlock[] = [];
        if (nudges.length > 0) {
          const topNudgeContacts = nudges.slice(0, 3).map((n) => n.contact.name);
          blocks.push({
            type: "action_bar",
            data: {
              primary: { label: "Today's Priorities", query: "What should I focus on today?", icon: "zap" },
              secondary: topNudgeContacts.map((name) => ({ label: `Quick 360: ${name}`, query: `Quick 360 for ${name}`, icon: "search" })),
            },
          });
        }

        return NextResponse.json({
          answer: sections.join("\n"),
          sources: [],
          blocks: blocks.length > 0 ? blocks : undefined,
        });
      } catch (err) {
        console.error("[chat] weekly summary intent failed:", err);
        return NextResponse.json({ answer: "Sorry, I had trouble generating your weekly summary. Please try again.", sources: [] });
      }
    }

    const hasStructuredIntent = isFullContact360 || isQuick360 || isCompany360 || isDraftEmail || isDraftNote || isShareDossier;

    if (hasStructuredIntent) {
      const currentAction: ActionKey = isFullContact360 ? "full360"
        : isCompany360 ? "company360"
        : (isDraftEmail || isDraftNote) ? "email"
        : isShareDossier ? "share"
        : "quick360";
      const usedActions = getUsedActions(body.history ?? [], currentAction);

      const nameQuery = detectedEntity || extractNameFromQuery(message);
      if (!nameQuery) {
        const actionName = isDraftEmail ? "draft an email" : isDraftNote ? "draft a note" : isShareDossier ? "share a dossier" : isCompany360 ? "look up a company" : "look up a contact";
        return NextResponse.json({
          answer: `Who would you like me to ${actionName} for? Try something like "${isDraftEmail ? "Draft an email to" : isDraftNote ? "Draft a note to" : "Tell me about"} [name]."`,
          sources: [],
        });
      }
      if (nameQuery) {
        try {
          // ── Company 360 ──
          if (isCompany360) {
            // Try direct company name match first
            let companies = await prisma.company.findMany({
              where: { contacts: { some: { partnerId } }, name: { contains: nameQuery } },
              take: 1,
            });

            // If no company match, resolve via contact name → their company
            if (companies.length === 0) {
              const matchedContacts = await contactRepo.search(nameQuery, partnerId);
              if (matchedContacts.length > 0) {
                const matchedContact = matchedContacts[0];
                const contactCompany = (matchedContact as Record<string, unknown>).company as { id: string; name: string } | undefined;
                if (contactCompany?.id) {
                  const co = await prisma.company.findUnique({ where: { id: contactCompany.id } });
                  if (co) companies = [co];
                }
              }
            }

            if (companies.length > 0) {
              const co = companies[0];
              const now = new Date();

              // Fetch firm-wide contacts (all partners) + signals in parallel
              const [allContacts, coSignals] = await Promise.all([
                prisma.contact.findMany({
                  where: { companyId: co.id },
                  include: {
                    partner: { select: { id: true, name: true } },
                    interactions: { orderBy: { date: "desc" }, take: 10 },
                    nudges: { where: { status: "OPEN" } },
                  },
                }),
                signalRepo.findByCompanyId(co.id).catch(() => []),
              ]);

              // Build partner coverage map
              const partnerMap = new Map<string, { name: string; isCurrentUser: boolean; contacts: number; interactions: number; lastDate: Date | null }>();
              for (const c of allContacts) {
                const pid = c.partner?.id ?? c.partnerId;
                const existing = partnerMap.get(pid) ?? {
                  name: c.partner?.name ?? "Unknown",
                  isCurrentUser: pid === partnerId,
                  contacts: 0,
                  interactions: 0,
                  lastDate: null,
                };
                existing.contacts++;
                existing.interactions += c.interactions.length;
                const lastInt = c.interactions[0]?.date ? new Date(c.interactions[0].date) : null;
                if (lastInt && (!existing.lastDate || lastInt > existing.lastDate)) {
                  existing.lastDate = lastInt;
                }
                partnerMap.set(pid, existing);
              }

              // Build top contacts with intensity
              const contactsWithIntensity = allContacts.map((c) => {
                const lastInt = c.interactions[0]?.date ? new Date(c.interactions[0].date) : null;
                const daysSince = lastInt ? differenceInDays(now, lastInt) : null;
                const { level } = computeIntensity(c.interactions.length, daysSince);
                return {
                  name: c.name,
                  title: c.title ?? "",
                  importance: c.importance ?? "MEDIUM",
                  interactionCount: c.interactions.length,
                  lastInteractionDate: lastInt ? formatDateForLLM(lastInt) : null,
                  sentiment: c.interactions[0]?.sentiment ?? null,
                  openNudges: c.nudges?.length ?? 0,
                  intensity: level,
                };
              }).sort((a, b) => {
                const impOrder: Record<string, number> = { CHAMPION: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                return (impOrder[a.importance] ?? 4) - (impOrder[b.importance] ?? 4);
              });

              // Build LLM context (use all contacts for richer overview)
              const coCtx: Company360Context = {
                company: {
                  name: co.name,
                  industry: co.industry ?? "",
                  description: "",
                  employeeCount: co.employeeCount ?? 0,
                  website: co.website ?? "",
                },
                contacts: contactsWithIntensity.map((c) => ({
                  name: c.name,
                  title: c.title,
                  importance: c.importance,
                  interactionCount: c.interactionCount,
                  lastInteractionDate: c.lastInteractionDate,
                  sentiment: c.sentiment,
                  openNudges: c.openNudges,
                })),
                partners: Array.from(partnerMap.entries()).map(([, p]) => ({
                  partnerName: p.name,
                  isCurrentUser: p.isCurrentUser,
                  contactCount: p.contacts,
                  totalInteractions: p.interactions,
                  lastInteractionDate: p.lastDate ? formatDateForLLM(p.lastDate) : null,
                })),
                signals: coSignals.slice(0, 10).map((s) => ({
                  type: s.type,
                  date: formatDateForLLM(new Date(s.date)),
                  content: s.content,
                  url: s.url ?? null,
                })),
                meetings: [],
                sequences: [],
                webNews: [],
              };

              // Run LLM overview + financial snapshot in parallel
              const [coResult, financialSnapshot] = await Promise.all([
                generateCompany360(coCtx),
                generateMiniFinancialSnapshot(co.name, co.industry ?? "").catch(() => null),
              ]);

              // Build Firm Relationship Snapshot markdown
              const partners = Array.from(partnerMap.values())
                .sort((a, b) => b.interactions - a.interactions);
              const firmLines: string[] = [];
              firmLines.push(`**${partners.length} partner${partners.length !== 1 ? "s" : ""}** cover **${allContacts.length} contact${allContacts.length !== 1 ? "s" : ""}** at ${co.name}.`);
              for (const p of partners) {
                const tag = p.isCurrentUser ? " (You)" : "";
                const lastStr = p.lastDate ? format(p.lastDate, "MMM d") : "never";
                firmLines.push(`- **${p.name}${tag}**: ${p.contacts} contact${p.contacts !== 1 ? "s" : ""} · ${p.interactions} interactions · last ${lastStr}`);
              }
              // Deduplicate contacts by name (same person tracked by multiple partners)
              const seenNames = new Set<string>();
              const uniqueContacts = contactsWithIntensity.filter((c) => {
                if (seenNames.has(c.name)) return false;
                seenNames.add(c.name);
                return true;
              });
              const topContacts = uniqueContacts.slice(0, 5);
              if (topContacts.length > 0) {
                const contactChips = topContacts.map((c) => {
                  const coldNote = c.intensity === "Cold" ? " — needs re-engagement" : "";
                  return `**${c.name}** (${c.title || "N/A"}, ${c.intensity}${coldNote})`;
                });
                firmLines.push(`\nKey contacts: ${contactChips.join(" · ")}`);
              }

              // Assemble final markdown
              const overviewSection = coResult.sections.find((s) => s.id === "overview");
              const recsSection = coResult.sections.find((s) => s.id === "recommendations");

              const mdParts: string[] = [
                `## Company 360: ${co.name}`,
                `*${coResult.summary}*`,
              ];
              if (overviewSection) {
                mdParts.push(`### Overview\n${overviewSection.content}`);
              }
              mdParts.push(`### Firm Relationships\n${firmLines.join("\n")}`);
              if (financialSnapshot) {
                mdParts.push(`### Financial Performance\n${financialSnapshot.content}`);
              }
              if (recsSection) {
                mdParts.push(`### Recommendations\n${recsSection.content}`);
              }
              if (financialSnapshot && financialSnapshot.sources.length > 0) {
                const sourceLines = financialSnapshot.sources.map((s, i) => `[${i + 1}] [${s.title}](${s.url})`);
                mdParts.push(`---\n*Sources:* ${sourceLines.join(" · ")}`);
              }

              const md = mdParts.join("\n\n");

              const blocks: ChatBlock[] = [{
                type: "action_bar",
                data: {
                  primary: { label: "Draft Email", query: `Draft email to ${nameQuery}`, icon: "mail" },
                  secondary: [
                    { label: "Quick 360", query: `Quick 360 for ${nameQuery}`, icon: "search" },
                  ],
                },
              }];
              return NextResponse.json({ answer: stripMarkers(md), sources: [], blocks });
            }
            if (isCompany360) {
              return NextResponse.json({
                answer: `I couldn't find a company matching "${nameQuery}" in your CRM. Try the full company name, or check the Companies tab.`,
                sources: [],
              });
            }
          }

          // ── Contact-based intents (Full 360, Quick 360, Draft Email, Share) ──
          let contact: Awaited<ReturnType<typeof contactRepo.search>>[0] | null = null;
          if (ctx_ids.contactId) {
            contact = await contactRepo.findById(ctx_ids.contactId, partnerId);
          }
          if (!contact) {
            const contacts = await contactRepo.search(nameQuery, partnerId);
            contact = contacts[0] ?? null;
          }
          if (!contact) {
            return NextResponse.json({
              answer: `I couldn't find a contact matching "${nameQuery}" in your CRM. Try using their full name, or check the Contacts tab to verify the spelling.`,
              sources: [],
            });
          }
          if (contact) {
            const company = (contact as Record<string, unknown>).company as { name: string; industry?: string; employeeCount?: number; website?: string } | undefined;

            // Build shared contact context
            const ctx = await buildContactContext(contact, company, partnerId);
            ctx.partnerName = partnerName;

            // ── Full Contact 360 ──
            if (isFullContact360) {
              const result = await generateContact360(ctx);
              const md = [
                `## Contact 360: ${contact.name}`,
                contact.title ? `**${contact.title}**${company?.name ? ` at ${company.name}` : ""}` : "",
                "",
                `*${result.summary}*`,
                "",
                ...result.sections.map((s) => `### ${s.title}\n${s.content}`),
                buildQuickActionsMarker(contact.name, usedActions, company?.name),
              ].filter(Boolean).join("\n\n");

              const blocks: ChatBlock[] = [
                {
                  type: "contact_card",
                  data: { name: contact.name, title: contact.title ?? undefined, company: company?.name ?? undefined, contactId: contact.id },
                },
                {
                  type: "action_bar",
                  data: {
                    primary: { label: "Draft Email", query: `Draft email to ${contact.name}`, icon: "mail" },
                    secondary: buildSecondaryActions(contact.name, usedActions, company?.name),
                  },
                },
              ];
              return NextResponse.json({ answer: stripMarkers(md), sources: [], blocks });
            }

            // ── Draft Email ──
            if (isDraftEmail) {
              let nudgeReason = "Proactive outreach to strengthen the relationship";
              if (ctx_ids.nudgeId) {
                const nudge = await prisma.nudge.findUnique({ where: { id: ctx_ids.nudgeId } }).catch(() => null);
                if (nudge?.reason) nudgeReason = nudge.reason;
              }
              const emailResult = await generateEmail({
                partnerName,
                contactName: contact.name,
                contactTitle: contact.title ?? "",
                companyName: company?.name ?? "",
                nudgeReason,
                recentInteractions: ctx.interactions.slice(0, 5).map((i) => `${i.type} on ${i.date}: ${i.summary}`),
                signals: ctx.signals.slice(0, 3).map((s) => `${s.type}: ${s.content.slice(0, 100)}`),
              });
              const cleanEmailAnswer = `## Draft Email to ${contact.name}\n\nHere's a draft you can copy and edit before sending.`;

              const blocks: ChatBlock[] = [
                {
                  type: "contact_card",
                  data: {
                    name: contact.name,
                    title: contact.title ?? undefined,
                    company: company?.name ?? undefined,
                    contactId: contact.id,
                  },
                },
                {
                  type: "email_preview",
                  data: {
                    to: contact.name,
                    subject: emailResult.subject,
                    body: emailResult.body,
                    contactId: contact.id,
                  },
                },
                {
                  type: "action_bar",
                  data: {
                    primary: { label: "Copy Email", query: "", icon: "copy" },
                    secondary: buildSecondaryActions(contact.name, usedActions, company?.name),
                  },
                },
              ];
              return NextResponse.json({ answer: cleanEmailAnswer, sources: [], blocks });
            }

            // ── Draft Note ──
            if (isDraftNote) {
              const noteResult = await generateNote({
                partnerName,
                contactName: contact.name,
                contactTitle: contact.title ?? "",
                companyName: company?.name ?? "",
                recentInteractions: ctx.interactions.slice(0, 5).map((i) => `${i.type} on ${i.date}: ${i.summary}`),
                signals: ctx.signals.slice(0, 3).map((s) => `${s.type}: ${s.content.slice(0, 100)}`),
              });
              const md = [
                `## Note to ${contact.name}`,
                "",
                noteResult.body,
                "",
                `---`,
                `*You can copy and edit this note before sending.*`,
                buildQuickActionsMarker(contact.name, usedActions, company?.name),
              ].filter(Boolean).join("\n\n");

              const blocks: ChatBlock[] = [
                {
                  type: "contact_card",
                  data: { name: contact.name, title: contact.title ?? undefined, company: company?.name ?? undefined, contactId: contact.id },
                },
                {
                  type: "action_bar",
                  data: {
                    primary: { label: "Copy Note", query: "", icon: "copy" },
                    secondary: buildSecondaryActions(contact.name, usedActions, company?.name),
                  },
                },
              ];
              return NextResponse.json({ answer: stripMarkers(md), sources: [], blocks });
            }

            // ── Share Dossier ──
            if (isShareDossier) {
              const result = await generateQuick360(ctx);
              const md = [
                `## Share Dossier: ${contact.name}`,
                "",
                `To share this dossier, go to the contact's full profile and use the **Share** button on the Contact 360 card.`,
                "",
                `Here's a preview of what will be shared:`,
                "",
                `*${result.insight}*`,
                "",
                `**Talking Points:**`,
                ...result.talkingPoints.map((tp, i) => `${i + 1}. ${tp}`),
                buildQuickActionsMarker(contact.name, usedActions, company?.name),
              ].filter(Boolean).join("\n\n");

              const blocks: ChatBlock[] = [
                {
                  type: "contact_card",
                  data: { name: contact.name, title: contact.title ?? undefined, company: company?.name ?? undefined, contactId: contact.id },
                },
                {
                  type: "action_bar",
                  data: {
                    primary: { label: "Share Dossier", query: `Share dossier for ${contact.name}`, icon: "share" },
                    secondary: buildSecondaryActions(contact.name, usedActions, company?.name),
                  },
                },
              ];
              return NextResponse.json({ answer: stripMarkers(md), sources: [], blocks });
            }

            // ── Quick 360 (default contact intent) ──
            const q360 = await generateQuick360(ctx);
            const tpFormatted = q360.talkingPoints.length > 0
              ? q360.talkingPoints.map((tp, i) => `${i + 1}. ${tp}`).join("\n")
              : "1. Ask about their current priorities and how things have evolved.";

            const md = [
              `## Quick 360: ${q360.contactName}`,
              q360.title ? `**${q360.title}**${q360.companyName ? ` at ${q360.companyName}` : ""}` : "",
              "",
              `### Insight Summary`,
              q360.insight,
              "",
              `### Firm Coverage`,
              q360.firmCoverage,
              "",
              `### Talking Points`,
              tpFormatted,
              buildQuickActionsMarker(contact.name, usedActions, company?.name),
            ].filter(Boolean).join("\n\n");

            const blocks: ChatBlock[] = [
              {
                type: "contact_card",
                data: { name: contact.name, title: contact.title ?? undefined, company: company?.name ?? undefined, contactId: contact.id },
              },
              {
                type: "action_bar",
                data: {
                  primary: { label: "Draft Email", query: `Draft email to ${contact.name}`, icon: "mail" },
                  secondary: buildSecondaryActions(contact.name, usedActions, company?.name),
                },
              },
            ];
            return NextResponse.json({ answer: stripMarkers(md), sources: [], blocks });
          }
        } catch (err) {
          console.error("[chat] structured intent failed, falling through to default:", err);
        }
      }
    }

    // Run CRM search and web search in parallel; don't let one failure break the other
    const [crmSources, webSources] = await Promise.all([
      retrieveContext(message, partnerId).catch((err) => {
        console.error("[chat] CRM retrieval failed:", err);
        return [] as Awaited<ReturnType<typeof retrieveContext>>;
      }),
      searchWeb(message, 5).catch((err) => {
        console.error("[chat] Web search failed:", err);
        return [] as Awaited<ReturnType<typeof searchWeb>>;
      }),
    ]);

    const sources = [...crmSources, ...webSources];

    let answer: string;
    try {
      answer = await generateChatAnswer({
        question: message,
        retrievedDocs: sources,
        partnerName,
        history: body.history ?? [],
      });
    } catch (llmErr) {
      console.error("[chat] LLM generation failed:", llmErr);
      answer =
        "I found some relevant information but had trouble generating a response. " +
        (sources.length > 0
          ? "Please check the sources below for details."
          : "Please try again in a moment.");
    }

    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error("[chat] Error:", err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function stripMarkers(text: string): string {
  return text
    .replace(/<!--QUICK_ACTIONS:[\s\S]*?-->/g, "")
    .replace(/<!--SIGNAL_LABELS:[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function buildContactContext(
  contact: { id: string; name: string; title: string | null; email: string | null; importance: string | null; notes: string | null; companyId: string },
  company: { name: string; industry?: string; employeeCount?: number; website?: string } | undefined,
  partnerId: string,
): Promise<Contact360Context> {
  const [interactions, signals, meetings, firmContacts, webResults] = await Promise.all([
    interactionRepo.findByContactId(contact.id).catch(() => []),
    signalRepo.findByContactId(contact.id).catch(() => []),
    meetingRepo.findByContactId(contact.id).catch(() => []),
    prisma.contact.findMany({
      where: { name: contact.name, companyId: contact.companyId },
      include: { partner: true, interactions: { orderBy: { date: "desc" }, take: 1 } },
    }).catch(() => []),
    searchWeb(`${contact.name} ${contact.title ?? ""} ${company?.name ?? ""} latest news`, 3).catch(() => []),
  ]);

  return {
    contact: {
      name: contact.name,
      title: contact.title ?? "",
      email: contact.email ?? "",
      importance: contact.importance ?? "MEDIUM",
      notes: contact.notes,
    },
    company: {
      name: company?.name ?? "",
      industry: company?.industry ?? "",
      employeeCount: company?.employeeCount ?? 0,
      website: company?.website ?? "",
    },
    interactions: interactions.slice(0, 10).map((i) => ({
      type: i.type,
      date: formatDateForLLM(new Date(i.date)),
      summary: i.summary ?? "",
      sentiment: i.sentiment ?? "NEUTRAL",
      direction: (i as Record<string, unknown>).direction as string | undefined,
    })),
    signals: signals.slice(0, 10).map((s) => ({
      type: s.type,
      date: formatDateForLLM(new Date(s.date)),
      content: s.content,
      url: s.url ?? null,
    })),
    meetings: meetings.slice(0, 5).map((m) => ({
      title: m.title,
      date: formatDateTimeForLLM(new Date(m.startTime)),
      attendees: ((m.attendees ?? []) as { contact?: { name?: string } }[]).map((a) => a.contact?.name ?? "Unknown"),
      purpose: m.purpose ?? null,
      briefExcerpt: m.generatedBrief?.slice(0, 200) ?? null,
    })),
    nudges: [],
    sequences: [],
    firmRelationships: firmContacts.map((rc) => {
      const count = rc.interactions?.length ?? 0;
      const last = rc.interactions?.[0];
      const daysSince = last ? Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000) : null;
      return {
        partnerName: rc.partner?.name ?? "Unknown",
        isCurrentUser: rc.partnerId === partnerId,
        interactionCount: count,
        intensity: count >= 4 && daysSince !== null && daysSince <= 60 ? "High" : count >= 2 ? "Medium" : "Light",
        lastInteractionDate: last?.date ? formatDateForLLM(new Date(last.date)) : null,
        contactsAtCompany: 0,
      };
    }),
    webBackground: [],
    webNews: webResults.filter((d) => d.type !== "Web Summary").map((d) => ({
      title: d.type,
      content: d.content,
      url: d.url ?? "",
    })),
    engagements: [],
  };
}

type ActionKey = "quick360" | "full360" | "company360" | "email" | "share";

function getUsedActions(
  history: { role: string; content: string }[],
  currentAction: ActionKey,
): Set<ActionKey> {
  const used = new Set<ActionKey>([currentAction]);
  for (const msg of history) {
    if (msg.role !== "user") continue;
    const text = msg.content;
    if (FULL_CONTACT_360_INTENT.test(text)) used.add("full360");
    if (!FULL_CONTACT_360_INTENT.test(text) && QUICK_360_INTENT.test(text)) used.add("quick360");
    if (COMPANY_360_INTENT.test(text)) used.add("company360");
    if (DRAFT_EMAIL_INTENT.test(text)) used.add("email");
    if (SHARE_DOSSIER_INTENT.test(text)) used.add("share");
  }
  return used;
}

function buildSecondaryActions(contactName: string, used: Set<ActionKey>, companyName?: string): { label: string; query: string; icon: string }[] {
  const all: { key: ActionKey; label: string; query: string; icon: string }[] = [
    { key: "email", label: "Draft Email", query: `Draft email to ${contactName}`, icon: "mail" },
    { key: "quick360", label: "Quick 360", query: `Quick 360 for ${contactName}`, icon: "search" },
    { key: "full360", label: "Full Contact 360", query: `Full Contact 360 for ${contactName}`, icon: "user" },
    { key: "company360", label: "Company 360", query: `Company 360 for ${companyName || contactName}`, icon: "briefcase" },
    { key: "share", label: "Share Dossier", query: `Share dossier for ${contactName}`, icon: "share" },
  ];
  return all.filter((a) => !used.has(a.key)).map(({ label, query, icon }) => ({ label, query, icon }));
}

function buildQuickActionsMarker(contactName: string, used: Set<ActionKey>, companyName?: string): string {
  const all: { key: ActionKey; label: string; query: string }[] = [
    { key: "email", label: "Draft Email", query: `Draft email to ${contactName}` },
    { key: "full360", label: "Full Contact 360", query: `Full Contact 360 for ${contactName}` },
    { key: "company360", label: "Company 360", query: `Company 360 for ${companyName || contactName}` },
    { key: "share", label: "Share Dossier", query: `Share dossier for ${contactName}` },
  ];
  const filtered = all.filter((a) => !used.has(a.key));
  if (filtered.length === 0) return "";
  return `<!--QUICK_ACTIONS:${JSON.stringify(filtered.map(({ label, query }) => ({ label, query })))}-->`;
}

function structuredBriefToMarkdown(brief: StructuredBrief): string {
  const sections: string[] = [];

  sections.push(`### Meeting Goal`);
  sections.push(brief.meetingGoal.statement);
  if (brief.meetingGoal.successCriteria) {
    sections.push(`\n*${brief.meetingGoal.successCriteria}*`);
  }

  if (brief.primaryContactProfile.bullets.length > 0) {
    sections.push(`\n### ${brief.primaryContactProfile.name}`);
    for (const b of brief.primaryContactProfile.bullets) {
      sections.push(`- **${b.label}:** ${b.detail}`);
    }
  }
  if (brief.primaryContactProfile.emptyReason) {
    sections.push(`\n*${brief.primaryContactProfile.emptyReason}*`);
  }

  if (brief.conversationStarters.length > 0) {
    sections.push(`\n### Conversation Starters`);
    for (let i = 0; i < brief.conversationStarters.length; i++) {
      const s = brief.conversationStarters[i];
      sections.push(`${i + 1}. *"${s.question}"*`);
      if (s.tacticalNote) sections.push(`   ${s.tacticalNote}`);
    }
  }

  if (brief.newsInsights.length > 0) {
    sections.push(`\n### News & Insights`);
    for (const n of brief.newsInsights) {
      sections.push(`**${n.headline}**`);
      sections.push(n.body);
    }
  } else if (brief.newsEmptyReason) {
    sections.push(`\n### News & Insights`);
    sections.push(`*${brief.newsEmptyReason}*`);
  }

  if (brief.executiveProfile.bioSummary) {
    sections.push(`\n### Executive Profile`);
    sections.push(brief.executiveProfile.bioSummary);
    if (brief.executiveProfile.recentMoves.length > 0) {
      sections.push(`\n**Recent Moves:**`);
      for (const m of brief.executiveProfile.recentMoves) {
        sections.push(`- ${m.date}: ${m.description}`);
      }
    }
    if (brief.executiveProfile.patternCallout) {
      sections.push(`\n*${brief.executiveProfile.patternCallout}*`);
    }
  }

  const tempEmoji: Record<string, string> = { COLD: "Cold", COOL: "Cool", WARM: "Warm", HOT: "Hot" };
  sections.push(`\n### Relationship: ${tempEmoji[brief.relationshipHistory.temperature] ?? brief.relationshipHistory.temperature}`);
  sections.push(brief.relationshipHistory.summary);
  if (brief.relationshipHistory.engagements.length > 0) {
    for (const e of brief.relationshipHistory.engagements) {
      sections.push(`- **${e.period}:** ${e.description}`);
    }
  }

  if (brief.attendees.length > 0) {
    sections.push(`\n### Attendees`);
    for (const a of brief.attendees) {
      sections.push(`- **${a.name}** — ${a.title}`);
    }
  }

  return sections.join("\n");
}

function fragmentsToMarkdown(fragments: SentenceFragment[]): string {
  let md = "";
  for (const f of fragments) {
    if (f.lineBreak) {
      md += "\n\n";
      continue;
    }
    md += f.bold ? `**${f.text}**` : f.text;
  }
  return md.trim();
}

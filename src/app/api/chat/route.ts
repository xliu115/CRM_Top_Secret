import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { contactRepo, partnerRepo, interactionRepo, signalRepo, meetingRepo, nudgeRepo, type NudgeWithRelations } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { retrieveContext, searchWeb } from "@/lib/services/rag-service";
import { generateChatAnswer, generateEmail, generateMeetingBrief } from "@/lib/services/llm-service";
import { generateNote } from "@/lib/services/llm-email";
import {
  generateQuick360,
  generateContact360,
  type Contact360Context,
} from "@/lib/services/llm-contact360";
import { generateCompany360, type Company360Context } from "@/lib/services/llm-company360";
import { classifyIntent, type IntentType } from "@/lib/services/llm-intent";
import { parseStructuredBrief, type StructuredBrief } from "@/lib/types/structured-brief";
import {
  buildSummaryFragments,
  type InsightData,
  type SentenceFragment,
} from "@/lib/utils/nudge-summary";

const FULL_CONTACT_360_INTENT =
  /\b(full\s+contact\s*360)\b/i;
const QUICK_360_INTENT =
  /\b(tell me (?:everything|all) about|contact ?360|recap|dossier|what do (?:you|we) know about|full (?:intel|intelligence) on|brief me on|quick ?360)\b/i;
const COMPANY_360_INTENT =
  /\b(company ?360|company dossier|tell me about (?:the )?company|company intel(?:ligence)?)\b/i;
const DRAFT_EMAIL_INTENT =
  /\b(draft (?:an? )?(?:follow[- ]?up |reply )?email|write (?:an? )?(?:follow[- ]?up |reply )?email|email draft|compose (?:an? )?(?:follow[- ]?up |reply )?email|draft (?:a )?(?:follow[- ]?up|reply) to)\b/i;
const SHARE_DOSSIER_INTENT =
  /\b(share (?:the )?dossier|share (?:the )?360|send (?:the )?dossier)\b/i;
const MEETING_PREP_INTENT =
  /\b(prep(?:are)?\s+(?:me\s+)?for\s+(?:the\s+)?|meeting (?:brief|prep)\s+(?:for\s+)?)/i;
const MEETINGS_TODAY_INTENT =
  /\b((?:show|list|what are)\s+(?:my\s+)?meetings?\s+(?:today|this week|upcoming)|my meetings?\s+today|today'?s?\s+meetings?|upcoming meetings?)\b/i;
const DAILY_PRIORITIES_INTENT =
  /\b(what should I\s+(?:do|focus on|prioritize)|my priorities|today'?s?\s+(?:priorities|plan|agenda)|plan (?:my|for) (?:today|the day))\b/i;
const NEEDS_ATTENTION_INTENT =
  /\b((?:who|which)\s+(?:contacts?|clients?|people)\s+need\s+(?:attention|outreach|follow.?up)|need(?:s|ing)?\s+attention|at.?risk\s+(?:contacts?|clients?|relationships?))\b/i;
const NUDGE_SUMMARY_INTENT =
  /\b(nudge summary|show (?:me )?(?:the )?(?:nudge|evidence|summary) for|why (?:should I |do I need to )?(?:reach out|contact|follow up)|outreach summary)\b/i;

const ALL_INTENTS = [FULL_CONTACT_360_INTENT, QUICK_360_INTENT, COMPANY_360_INTENT, DRAFT_EMAIL_INTENT, SHARE_DOSSIER_INTENT, MEETING_PREP_INTENT, MEETINGS_TODAY_INTENT, DAILY_PRIORITIES_INTENT, NEEDS_ATTENTION_INTENT, NUDGE_SUMMARY_INTENT];

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

    if (classified && classified.confidence >= 0.5) {
      detectedIntent = classified.intent;
      detectedEntity = classified.entity;
    } else {
      // Regex fallback
      if (FULL_CONTACT_360_INTENT.test(message)) detectedIntent = "full_360";
      else if (QUICK_360_INTENT.test(message)) detectedIntent = "quick_360";
      else if (COMPANY_360_INTENT.test(message)) detectedIntent = "company_360";
      else if (DRAFT_EMAIL_INTENT.test(message)) detectedIntent = "draft_email";
      else if (SHARE_DOSSIER_INTENT.test(message)) detectedIntent = "share_dossier";
      else if (MEETING_PREP_INTENT.test(message)) detectedIntent = "meeting_prep";
      else if (MEETINGS_TODAY_INTENT.test(message)) detectedIntent = "meetings_today";
      else if (DAILY_PRIORITIES_INTENT.test(message)) detectedIntent = "daily_priorities";
      else if (NEEDS_ATTENTION_INTENT.test(message)) detectedIntent = "needs_attention";
      else if (NUDGE_SUMMARY_INTENT.test(message)) detectedIntent = "nudge_summary";

      if (detectedIntent !== "general_question") {
        detectedEntity = extractNameFromQuery(message);
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
                .map((i) => `${i.type} (${i.date.toISOString().split("T")[0]}): ${i.summary}`),
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
          return NextResponse.json({ answer: md, sources: [] });
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
        return NextResponse.json({ answer: md, sources: [] });
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

        return NextResponse.json({ answer: sections.join("\n"), sources: [] });
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

        return NextResponse.json({ answer: sections.join("\n"), sources: [] });
      } catch (err) {
        console.error("[chat] needs attention intent failed:", err);
      }
    }

    // ── Nudge Summary (evidence-first outreach view) ──────────────────
    if (isNudgeSummary) {
      try {
        const nameQuery = detectedEntity || extractNameFromQuery(message);

        let nudges: NudgeWithRelations[] = [];
        if (ctx_ids.contactId) {
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

          const sections: string[] = [];
          sections.push(`## Why Reach Out: ${contactName}`);
          if (primary.contact.title) {
            sections.push(`**${primary.contact.title}** at ${companyName}`);
          }
          sections.push("");

          const SKIP_LABEL_TYPES = new Set(["STALE_CONTACT", "FOLLOW_UP", "REPLY_NEEDED", "CAMPAIGN_APPROVAL", "ARTICLE_CAMPAIGN"]);
          const seenLabels = new Map<string, string | null>();

          for (const nudge of nudges) {
            let insights: InsightData[] = [];
            try {
              const meta = JSON.parse(nudge.metadata ?? "{}");
              insights = meta?.insights ?? [];
            } catch { /* ignore */ }

            const fragments = buildSummaryFragments(nudge, insights);
            const md = fragmentsToMarkdown(fragments);
            sections.push(md);

            for (const ins of insights) {
              if (SKIP_LABEL_TYPES.has(ins.type)) continue;
              if (!seenLabels.has(ins.type)) {
                seenLabels.set(ins.type, ins.signalUrl ?? null);
              } else if (!seenLabels.get(ins.type) && ins.signalUrl) {
                seenLabels.set(ins.type, ins.signalUrl);
              }
            }
          }

          if (seenLabels.size > 0) {
            const labelData = [...seenLabels.entries()].map(([type, url]) => ({ type, url }));
            sections.push(`<!--SIGNAL_LABELS:${JSON.stringify(labelData)}-->`);
          }

          const NUDGE_TYPE_QUICK_ACTION: Record<string, { label: string; queryPrefix: string }> = {
            MEETING_PREP: { label: "Review Meeting Brief", queryPrefix: "Review meeting brief for" },
            REPLY_NEEDED: { label: "Draft Reply", queryPrefix: "Draft a reply to" },
            JOB_CHANGE: { label: "Draft Congratulations", queryPrefix: "Draft a congratulations email to" },
            STALE_CONTACT: { label: "Draft Check-in", queryPrefix: "Draft a check-in email to" },
            FOLLOW_UP: { label: "Continue Follow-up", queryPrefix: "Continue follow-up with" },
            COMPANY_NEWS: { label: "Draft News Email", queryPrefix: "Draft a news follow-up email to" },
            UPCOMING_EVENT: { label: "Draft Pre-Event Email", queryPrefix: "Draft a pre-event email to" },
            EVENT_ATTENDED: { label: "Draft Follow-Up", queryPrefix: "Draft an event follow-up email to" },
            EVENT_REGISTERED: { label: "Draft Outreach", queryPrefix: "Draft an event outreach email to" },
            ARTICLE_READ: { label: "Draft Content Email", queryPrefix: "Draft a content follow-up email to" },
            LINKEDIN_ACTIVITY: { label: "Draft LinkedIn Email", queryPrefix: "Draft a LinkedIn follow-up email to" },
          };
          const primaryType = primary.ruleType;
          const typeAction = NUDGE_TYPE_QUICK_ACTION[primaryType] ?? { label: "Draft Email", queryPrefix: "Draft email to" };

          const quickActions = [
            { label: typeAction.label, query: `${typeAction.queryPrefix} ${contactName}` },
            { label: "Quick 360", query: `Quick 360 for ${contactName}` },
            { label: "Company 360", query: `Company 360 for ${companyName || contactName}` },
          ];
          sections.push(`\n<!--QUICK_ACTIONS:${JSON.stringify(quickActions)}-->`);

          return NextResponse.json({
            answer: sections.join("\n\n"),
            sources: [],
          });
        }
      } catch (err) {
        console.error("[chat] nudge summary intent failed:", err);
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
      if (!nameQuery && (isDraftEmail || isDraftNote)) {
        return NextResponse.json({
          answer: `Who would you like me to draft a ${isDraftNote ? "note" : "email"} for? You can say something like "Draft a ${isDraftNote ? "note" : "email"} to [contact name]."`,
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
              const companyContacts = await prisma.contact.findMany({
                where: { companyId: co.id, partnerId },
                include: {
                  interactions: { orderBy: { date: "desc" }, take: 5 },
                  signals: { orderBy: { date: "desc" }, take: 3 },
                },
                take: 20,
              });
              const coSignals = await signalRepo.findByCompanyId(co.id).catch(() => []);
              const coWeb = await searchWeb(`${co.name} ${co.industry ?? ""} latest news`, 3).catch(() => []);

              const coCtx: Company360Context = {
                company: {
                  name: co.name,
                  industry: co.industry ?? "",
                  description: "",
                  employeeCount: co.employeeCount ?? 0,
                  website: co.website ?? "",
                },
                contacts: companyContacts.map((c) => ({
                  name: c.name,
                  title: c.title ?? "",
                  importance: c.importance ?? "MEDIUM",
                  interactionCount: c.interactions.length,
                  lastInteractionDate: c.interactions[0]?.date?.toISOString() ?? null,
                  sentiment: c.interactions[0]?.sentiment ?? null,
                  openNudges: 0,
                })),
                partners: [],
                signals: coSignals.slice(0, 10).map((s) => ({
                  type: s.type,
                  date: new Date(s.date).toISOString(),
                  content: s.content,
                  url: s.url ?? null,
                })),
                meetings: [],
                sequences: [],
                webNews: coWeb.filter((d) => d.type !== "Web Summary").map((d) => ({
                  title: d.type,
                  content: d.content,
                  url: d.url ?? "",
                })),
              };
              const coResult = await generateCompany360(coCtx);
              const md = [
                `## Company 360: ${co.name}`,
                `*${coResult.summary}*`,
                "",
                ...coResult.sections.map((s) => `### ${s.title}\n${s.content}`),
              ].join("\n\n");
              return NextResponse.json({ answer: md, sources: [] });
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
              return NextResponse.json({ answer: md, sources: [] });
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
              const md = [
                `## Draft Email to ${contact.name}`,
                "",
                `**Subject:** ${emailResult.subject}`,
                "",
                emailResult.body,
                "",
                `---`,
                `*You can copy and edit this draft before sending.*`,
                buildQuickActionsMarker(contact.name, usedActions, company?.name),
              ].filter(Boolean).join("\n\n");
              return NextResponse.json({ answer: md, sources: [] });
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
              return NextResponse.json({ answer: md, sources: [] });
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
              return NextResponse.json({ answer: md, sources: [] });
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
            return NextResponse.json({ answer: md, sources: [] });
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
      date: new Date(i.date).toISOString(),
      summary: i.summary ?? "",
      sentiment: i.sentiment ?? "NEUTRAL",
      direction: (i as Record<string, unknown>).direction as string | undefined,
    })),
    signals: signals.slice(0, 10).map((s) => ({
      type: s.type,
      date: new Date(s.date).toISOString(),
      content: s.content,
      url: s.url ?? null,
    })),
    meetings: meetings.slice(0, 5).map((m) => ({
      title: m.title,
      date: new Date(m.startTime).toISOString(),
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
        lastInteractionDate: last?.date?.toISOString() ?? null,
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

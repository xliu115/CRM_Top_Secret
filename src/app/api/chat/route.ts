import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { contactRepo, partnerRepo, interactionRepo, signalRepo, meetingRepo } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { retrieveContext, searchWeb } from "@/lib/services/rag-service";
import { generateChatAnswer, generateEmail } from "@/lib/services/llm-service";
import {
  generateQuick360,
  generateContact360,
  type Contact360Context,
} from "@/lib/services/llm-contact360";
import { generateCompany360, type Company360Context } from "@/lib/services/llm-company360";

const FULL_CONTACT_360_INTENT =
  /\b(full\s+contact\s*360)\b/i;
const QUICK_360_INTENT =
  /\b(tell me (?:everything|all) about|contact ?360|recap|dossier|what do (?:you|we) know about|full (?:intel|intelligence) on|brief me on|quick ?360)\b/i;
const COMPANY_360_INTENT =
  /\b(company ?360|company dossier|tell me about (?:the )?company|company intel(?:ligence)?)\b/i;
const DRAFT_EMAIL_INTENT =
  /\b(draft (?:an? )?email|write (?:an? )?email|email draft|compose (?:an? )?email)\b/i;
const SHARE_DOSSIER_INTENT =
  /\b(share (?:the )?dossier|share (?:the )?360|send (?:the )?dossier)\b/i;

const ALL_INTENTS = [FULL_CONTACT_360_INTENT, QUICK_360_INTENT, COMPANY_360_INTENT, DRAFT_EMAIL_INTENT, SHARE_DOSSIER_INTENT];

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

    const partner = await partnerRepo.findById(partnerId);
    const partnerName = partner?.name ?? "User";

    // ── Intent detection ──────────────────────────────────────────────
    const isFullContact360 = FULL_CONTACT_360_INTENT.test(message);
    const isQuick360 = !isFullContact360 && QUICK_360_INTENT.test(message);
    const isCompany360 = COMPANY_360_INTENT.test(message);
    const isDraftEmail = DRAFT_EMAIL_INTENT.test(message);
    const isShareDossier = SHARE_DOSSIER_INTENT.test(message);

    const hasStructuredIntent = isFullContact360 || isQuick360 || isCompany360 || isDraftEmail || isShareDossier;

    if (hasStructuredIntent) {
      const currentAction: ActionKey = isFullContact360 ? "full360"
        : isCompany360 ? "company360"
        : isDraftEmail ? "email"
        : isShareDossier ? "share"
        : "quick360";
      const usedActions = getUsedActions(body.history ?? [], currentAction);

      const nameQuery = extractNameFromQuery(message);
      if (nameQuery) {
        try {
          // ── Company 360 ──
          if (isCompany360) {
            const companies = await prisma.company.findMany({
              where: { contacts: { some: { partnerId } }, name: { contains: nameQuery } },
              take: 1,
            });
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
          const contacts = await contactRepo.search(nameQuery, partnerId);
          if (contacts.length > 0) {
            const contact = contacts[0];
            const company = (contact as Record<string, unknown>).company as { name: string; industry?: string; employeeCount?: number; website?: string } | undefined;

            // Build shared contact context
            const ctx = await buildContactContext(contact, company, partnerId);

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
                buildQuickActionsMarker(contact.name, usedActions),
              ].filter(Boolean).join("\n\n");
              return NextResponse.json({ answer: md, sources: [] });
            }

            // ── Draft Email ──
            if (isDraftEmail) {
              const emailResult = await generateEmail({
                partnerName,
                contactName: contact.name,
                contactTitle: contact.title ?? "",
                companyName: company?.name ?? "",
                nudgeReason: "Proactive outreach to strengthen the relationship",
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
                buildQuickActionsMarker(contact.name, usedActions),
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
                buildQuickActionsMarker(contact.name, usedActions),
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
              `### Talking Points`,
              tpFormatted,
              buildQuickActionsMarker(contact.name, usedActions),
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

function buildQuickActionsMarker(contactName: string, used: Set<ActionKey>): string {
  const all: { key: ActionKey; label: string; query: string }[] = [
    { key: "full360", label: "Full Contact 360", query: `Full Contact 360 for ${contactName}` },
    { key: "company360", label: "Company 360", query: `Company 360 for ${contactName}` },
    { key: "email", label: "Draft Email", query: `Draft email to ${contactName}` },
    { key: "share", label: "Share Dossier", query: `Share dossier for ${contactName}` },
  ];
  const filtered = all.filter((a) => !used.has(a.key));
  if (filtered.length === 0) return "";
  return `<!--QUICK_ACTIONS:${JSON.stringify(filtered.map(({ label, query }) => ({ label, query })))}-->`;
}

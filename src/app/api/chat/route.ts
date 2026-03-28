import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { contactRepo, partnerRepo, interactionRepo, signalRepo, meetingRepo } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { retrieveContext, searchWeb } from "@/lib/services/rag-service";
import { generateChatAnswer } from "@/lib/services/llm-service";
import { generateQuick360, type Contact360Context } from "@/lib/services/llm-contact360";

const CONTACT_360_INTENT =
  /\b(tell me (?:everything|all) about|contact ?360|recap|dossier|what do (?:you|we) know about|full (?:intel|intelligence) on|brief me on|quick ?360)\b/i;
const COMPANY_360_INTENT =
  /\b(company ?360|company dossier|tell me about (?:the )?company|company intel(?:ligence)?)\b/i;

function extractNameFromQuery(query: string): string {
  const cleaned = query
    .replace(CONTACT_360_INTENT, "")
    .replace(COMPANY_360_INTENT, "")
    .replace(/\bfor\b/i, "")
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

    // Detect Contact 360 or Company 360 intent
    const isContact360 = CONTACT_360_INTENT.test(message);
    const isCompany360 = COMPANY_360_INTENT.test(message);

    if (isContact360 || isCompany360) {
      const nameQuery = extractNameFromQuery(message);
      if (nameQuery) {
        try {
          if (isCompany360) {
            const companies = await prisma.company.findMany({
              where: {
                contacts: { some: { partnerId } },
                name: { contains: nameQuery },
              },
              take: 1,
            });
            if (companies.length > 0) {
              const companyContacts = await prisma.contact.findMany({
                where: { companyId: companies[0].id, partnerId },
                include: {
                  interactions: { orderBy: { date: "desc" }, take: 3 },
                },
                take: 10,
              });
              const md = [
                `## Company 360: ${companies[0].name}`,
                `*${companies[0].industry ?? "Industry unknown"} · ${companyContacts.length} contacts tracked*`,
                "",
                `### Your Contacts at ${companies[0].name}`,
                ...companyContacts.map((c) => {
                  const last = c.interactions[0];
                  const days = last ? Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000) : null;
                  return `- **${c.name}** — ${c.title ?? "No title"}${days !== null ? ` · Last contact ${days}d ago` : " · No interactions"}`;
                }),
              ].join("\n\n");
              return NextResponse.json({ answer: md, sources: [] });
            }
          } else {
            const contacts = await contactRepo.search(nameQuery, partnerId);
            if (contacts.length > 0) {
              const contact = contacts[0];
              const company = (contact as Record<string, unknown>).company as { name: string; industry?: string; employeeCount?: number; website?: string } | undefined;

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

              const ctx: Contact360Context = {
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
                `<!--QUICK_ACTIONS:${JSON.stringify([
                  { label: "Full Contact 360", href: `/contacts/${contact.id}` },
                  { label: "Company 360", href: `/companies/${contact.companyId}` },
                  { label: "Draft Email", href: `/contacts/${contact.id}?action=email` },
                  { label: "Share Dossier", href: `/contacts/${contact.id}?action=share` },
                ])}-->`,
              ].filter(Boolean).join("\n\n");
              return NextResponse.json({ answer: md, sources: [] });
            }
          }
        } catch (err) {
          console.error("[chat] 360 intent failed, falling through to default:", err);
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

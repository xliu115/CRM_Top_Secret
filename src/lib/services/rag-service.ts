import {
  contactRepo,
  interactionRepo,
  signalRepo,
  nudgeRepo,
  meetingRepo,
  engagementRepo,
} from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { formatDateForLLM } from "@/lib/utils/format-date";
import { tavily } from "@tavily/core";

function getNudgeNarrative(metadata: string | null | undefined): string | null {
  if (!metadata) return null;
  try {
    const meta = JSON.parse(metadata);
    return meta?.strategicInsight?.narrative ?? null;
  } catch { return null; }
}

export interface RetrievedDoc {
  type: string;
  content: string;
  date?: string;
  id?: string;
  url?: string;
  contactId?: string; // for Nudge sources — enables Draft email CTA
}

function isFirmRelationshipQuery(q: string): boolean {
  return /who knows|firm relationship|other partners|who has (a )?relationship|relationship at|who else (knows|has)|introductions?/i.test(q);
}

function isStaleFollowUpQuery(q: string): boolean {
  return /stale|follow ?up|follow-up|who needs|overdue|check ?in|haven'?t spoken|hasn'?t spoken|no contact|out of touch|reconnect/i.test(q);
}

function isInteractionQuery(q: string): boolean {
  return /interaction|meeting|call|email|conversation|last spoke|last contact/i.test(q);
}

/**
 * Simple keyword-based retrieval for MVP.
 * Searches across contacts, interactions, signals, nudges, and meetings.
 * For CRM-specific queries (interactions, firm relationships, stale contacts)
 * we explicitly pull from mock data to ensure answers use real data.
 */
export async function retrieveContext(
  query: string,
  partnerId: string,
  limit = 15
): Promise<RetrievedDoc[]> {
  const docs: RetrievedDoc[] = [];
  const keywords = extractKeywords(query);
  const fallbackKeywords = keywords.slice(0, 3);

  // Search contacts (use full list for firm-relationship / stale queries so we surface mock data)
  const contacts =
    isFirmRelationshipQuery(query) || isStaleFollowUpQuery(query)
      ? await contactRepo.findByPartnerId(partnerId)
      : await searchContactsWithFallback(query, partnerId, fallbackKeywords);
  for (const c of contacts.slice(0, 5)) {
    docs.push({
      type: "Contact",
      content: `${c.name} – ${c.title} at ${c.company.name}. Importance: ${c.importance}. ${c.notes || ""}`,
      id: c.id,
    });
  }

  // Firm relationships: who knows my contacts / other partners at company (use mock data)
  if (isFirmRelationshipQuery(query) && contacts.length > 0) {
    const companyIds = [...new Set(contacts.map((c) => c.companyId))];
    const otherPartnersAtCompanies = await prisma.contact.findMany({
      where: {
        companyId: { in: companyIds },
        partnerId: { not: partnerId },
      },
      select: { companyId: true, partner: { select: { name: true } } },
      distinct: ["companyId", "partnerId"],
    });
    const otherPartnersByCompany = new Map<string, string[]>();
    for (const row of otherPartnersAtCompanies) {
      const arr = otherPartnersByCompany.get(row.companyId);
      if (arr) arr.push(row.partner.name);
      else otherPartnersByCompany.set(row.companyId, [row.partner.name]);
    }
    const companyNames = new Map(contacts.map((c) => [c.companyId, c.company.name]));
    for (const c of contacts.slice(0, 10)) {
      const others = otherPartnersByCompany.get(c.companyId) ?? [];
      const companyName = companyNames.get(c.companyId) ?? "Unknown";
      docs.push({
        type: "Firm Relationship",
        content: `${c.name} at ${companyName}. Other partners with relationships: ${others.length > 0 ? others.join(", ") : "None"}.`,
        id: c.id,
      });
    }
  }

  // Stale / follow-up: include open nudges and contacts needing follow-up (use mock data)
  if (isStaleFollowUpQuery(query)) {
    const allNudges = await nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" });
    const staleNudges = allNudges.filter((n) =>
      n.reason.toLowerCase().includes("interaction") ||
      n.reason.toLowerCase().includes("days") ||
      n.ruleType === "STALE_CONTACT"
    );
    for (const n of (staleNudges.length > 0 ? staleNudges : allNudges).slice(0, 8)) {
      const narrative = getNudgeNarrative(n.metadata);
      docs.push({
        type: "Nudge",
        content: `${n.contact.name} (${n.contact.company.name}): ${narrative ?? n.reason}`,
        date: formatDateForLLM(new Date(n.createdAt)),
        id: n.id,
        contactId: n.contact.id,
      });
    }
  }

  // Interactions: fetch recent interactions (use mock data)
  if (isInteractionQuery(query)) {
    const recentInteractions = await interactionRepo.findRecentByPartnerId(partnerId, 10);
    for (const i of recentInteractions) {
      if (docs.some((d) => d.type === "Interaction" && d.id === i.id)) continue;
      docs.push({
        type: "Interaction",
        content: `${i.type} with ${i.contact.name} (${i.contact.company.name}): ${i.summary}${i.nextStep ? ` Next step: ${i.nextStep}` : ""}`,
        date: formatDateForLLM(new Date(i.date)),
        id: i.id,
      });
    }
  }

  // Search interactions and signals in parallel across all keywords
  const kwSlice = keywords.slice(0, 3);
  const [interactionResults, signalResults] = await Promise.all([
    Promise.all(kwSlice.map((kw) => interactionRepo.searchByContent(kw, partnerId, 5))),
    Promise.all(kwSlice.map((kw) => signalRepo.searchByContent(kw, partnerId, 5))),
  ]);

  for (const interactions of interactionResults) {
    for (const i of interactions) {
      if (docs.some((d) => d.id === i.id)) continue;
      docs.push({
        type: "Interaction",
        content: `${i.type} with ${i.contact.name} (${i.contact.company.name}): ${i.summary}${i.nextStep ? ` Next step: ${i.nextStep}` : ""}`,
        date: formatDateForLLM(new Date(i.date)),
        id: i.id,
      });
    }
  }

  for (const signals of signalResults) {
    for (const s of signals) {
      if (docs.some((d) => d.id === s.id)) continue;
      const entity = s.contact
        ? `${s.contact.name} (${s.contact.company.name})`
        : s.company?.name || "Unknown";
      docs.push({
        type: `Signal (${s.type})`,
        content: `${entity}: ${s.content}`,
        date: formatDateForLLM(new Date(s.date)),
        id: s.id,
      });
    }
  }

  // Search nudges (skip if we already added from stale/follow-up intent)
  if (!isStaleFollowUpQuery(query)) {
    const nudges = await nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" });
    const relevantNudges = nudges.filter((n) =>
      keywords.some(
        (kw) =>
          n.reason.toLowerCase().includes(kw.toLowerCase()) ||
          n.contact.name.toLowerCase().includes(kw.toLowerCase()) ||
          n.contact.company.name.toLowerCase().includes(kw.toLowerCase())
      )
    );
    for (const n of relevantNudges.slice(0, 3)) {
      const narrative = getNudgeNarrative(n.metadata);
      docs.push({
        type: "Nudge",
        content: `${n.contact.name} (${n.contact.company.name}): ${narrative ?? n.reason}`,
        date: formatDateForLLM(new Date(n.createdAt)),
        id: n.id,
        contactId: n.contact.id,
      });
    }
  }

  // Search meetings
  const meetings = await meetingRepo.findByPartnerId(partnerId);
  const relevantMeetings = meetings.filter((m) =>
    keywords.some(
      (kw) =>
        m.title.toLowerCase().includes(kw.toLowerCase()) ||
        m.attendees.some(
          (a) =>
            a.contact.name.toLowerCase().includes(kw.toLowerCase()) ||
            a.contact.company.name.toLowerCase().includes(kw.toLowerCase())
        )
    )
  );
  for (const m of relevantMeetings.slice(0, 3)) {
    const attendeeNames = m.attendees.map((a) => a.contact.name).join(", ");
    docs.push({
      type: "Meeting",
      content: `"${m.title}" with ${attendeeNames}. ${m.purpose || ""} ${m.notes || ""}`,
      date: formatDateForLLM(new Date(m.startTime)),
      id: m.id,
    });
  }

  // Batch-load engagement data for all matched contacts
  const engagementContacts = contacts.slice(0, 5);
  const engagementContactIds = engagementContacts.map((c) => c.id);
  const contactById = new Map(engagementContacts.map((c) => [c.id, c]));

  const [allEvents, allArticles] = await Promise.all([
    Promise.all(engagementContactIds.map((cid) => engagementRepo.findEventsByContactId(cid))),
    Promise.all(engagementContactIds.map((cid) => engagementRepo.findArticlesByContactId(cid))),
  ]);

  for (let idx = 0; idx < engagementContactIds.length; idx++) {
    const c = contactById.get(engagementContactIds[idx])!;
    const relevantEvents = allEvents[idx].filter((e) =>
      keywords.some(
        (kw) =>
          e.name.toLowerCase().includes(kw.toLowerCase()) ||
          e.practice.toLowerCase().includes(kw.toLowerCase()) ||
          e.status.toLowerCase().includes(kw.toLowerCase())
      )
    );
    for (const e of relevantEvents.slice(0, 2)) {
      docs.push({
        type: "Event",
        content: `${c.name} (${c.company.name}): ${e.status} for "${e.name}" — ${e.practice}, ${e.type} in ${e.location || "TBD"}`,
        date: formatDateForLLM(new Date(e.eventDate)),
        id: e.id,
      });
    }

    const relevantArticles = allArticles[idx].filter((a) =>
      keywords.some((kw) => a.name.toLowerCase().includes(kw.toLowerCase()))
    );
    for (const a of relevantArticles.slice(0, 2)) {
      docs.push({
        type: "Article",
        content: `${c.name} (${c.company.name}): ${a.articleSent === "Y" ? "Sent" : "Not sent"} "${a.name}" — ${a.views} view${a.views !== 1 ? "s" : ""}${a.sentFrom ? `, sent by ${a.sentFrom}` : ""}`,
        date: a.lastViewDate
          ? formatDateForLLM(new Date(a.lastViewDate))
          : undefined,
        id: a.id,
      });
    }
  }

  return docs.slice(0, limit);
}

async function searchContactsWithFallback(
  query: string,
  partnerId: string,
  keywords: string[]
): Promise<Awaited<ReturnType<typeof contactRepo.search>>> {
  const primary = await contactRepo.search(query, partnerId);
  if (primary.length > 0) return primary;

  for (const keyword of keywords) {
    const results = await contactRepo.search(keyword, partnerId);
    if (results.length > 0) return results;
  }

  return contactRepo.findByPartnerId(partnerId);
}

function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "just",
    "don", "now", "and", "but", "or", "if", "while", "about", "what",
    "which", "who", "whom", "this", "that", "these", "those", "am", "it",
    "its", "my", "me", "we", "our", "your", "his", "her", "their", "them",
    "i", "you", "he", "she", "they", "tell", "give", "show", "find",
    "get", "know", "think", "say", "make", "go", "see", "come", "take",
    "want", "look", "use", "work", "call", "try", "ask", "let", "keep",
    "help", "talk", "turn", "start", "anything", "everything", "something",
    "latest", "recent", "recently", "last", "new", "any",
  ]);

  const words = query
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()));

  // Also try multi-word company names
  const companyNames = [
    "Microsoft", "Apple", "Amazon", "JPMorgan", "Google", "Alphabet",
    "Meta", "Nvidia", "Salesforce", "Adobe", "Netflix", "Nike", "PepsiCo",
  ];
  for (const name of companyNames) {
    if (query.toLowerCase().includes(name.toLowerCase())) {
      words.unshift(name);
    }
  }

  return [...new Set(words)];
}

/**
 * Search the web using Tavily for real-time information.
 * Returns results as RetrievedDoc[] so they can be mixed with CRM data.
 */
export async function searchWeb(
  query: string,
  maxResults = 5
): Promise<RetrievedDoc[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const client = tavily({ apiKey });
    const response = await client.search(query, {
      maxResults,
      searchDepth: "basic",
      includeAnswer: true,
    });

    const docs: RetrievedDoc[] = [];

    if (response.answer) {
      docs.push({
        type: "Web Summary",
        content: response.answer,
      });
    }

    for (const result of response.results ?? []) {
      docs.push({
        type: "Web Result",
        content: `${result.title}: ${result.content}`,
        url: result.url,
      });
    }

    return docs;
  } catch (err) {
    console.error("[web-search] Tavily search failed:", err);
    return [];
  }
}

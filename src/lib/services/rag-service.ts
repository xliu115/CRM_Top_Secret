import {
  contactRepo,
  interactionRepo,
  signalRepo,
  nudgeRepo,
  meetingRepo,
  engagementRepo,
} from "@/lib/repositories";
import { tavily } from "@tavily/core";

export interface RetrievedDoc {
  type: string;
  content: string;
  date?: string;
  id?: string;
  url?: string;
}

/**
 * Simple keyword-based retrieval for MVP.
 * Searches across contacts, interactions, signals, nudges, and meetings.
 * In production, this would use pgvector embeddings for semantic search.
 */
export async function retrieveContext(
  query: string,
  partnerId: string,
  limit = 15
): Promise<RetrievedDoc[]> {
  const docs: RetrievedDoc[] = [];
  const keywords = extractKeywords(query);

  // Search contacts
  const contacts = await contactRepo.search(
    keywords[0] || query,
    partnerId
  );
  for (const c of contacts.slice(0, 5)) {
    docs.push({
      type: "Contact",
      content: `${c.name} – ${c.title} at ${c.company.name}. Importance: ${c.importance}. ${c.notes || ""}`,
      id: c.id,
    });
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
        date: new Date(i.date).toISOString().split("T")[0],
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
        date: new Date(s.date).toISOString().split("T")[0],
        id: s.id,
      });
    }
  }

  // Search nudges
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
    docs.push({
      type: "Nudge",
      content: `${n.contact.name} (${n.contact.company.name}): ${n.reason}`,
      date: new Date(n.createdAt).toISOString().split("T")[0],
      id: n.id,
    });
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
      date: new Date(m.startTime).toISOString().split("T")[0],
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
        date: new Date(e.eventDate).toISOString().split("T")[0],
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
          ? new Date(a.lastViewDate).toISOString().split("T")[0]
          : undefined,
        id: a.id,
      });
    }
  }

  return docs.slice(0, limit);
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

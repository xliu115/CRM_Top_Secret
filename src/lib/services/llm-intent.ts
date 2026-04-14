import { callLLMJson } from "./llm-core";

export type IntentType =
  | "quick_360"
  | "full_360"
  | "company_360"
  | "draft_email"
  | "draft_note"
  | "meeting_prep"
  | "meetings_today"
  | "daily_priorities"
  | "needs_attention"
  | "nudge_summary"
  | "share_dossier"
  | "firm_relationships"
  | "client_updates"
  | "weekly_summary"
  | "general_question";

export type IntentResult = {
  intent: IntentType;
  entity: string | null;
  confidence: number;
};

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a CRM assistant called Activate. Given a user message (and optional conversation history), classify the intent and extract the relevant entity (person name, company name, or meeting title).

Return JSON with exactly these keys:
- "intent": one of the values below
- "entity": the person/company/meeting name mentioned, or null if none
- "confidence": 0.0 to 1.0

Intents:
- "quick_360": User wants a brief overview/recap of a contact. Examples: "tell me about Brad Smith", "what do we know about Beth?", "brief me on Andrew Bosworth", "quick 360 for Chris Cox", "recap on Brian"
- "full_360": User wants a comprehensive deep-dive on a contact. Examples: "full contact 360 for Brad Smith", "give me everything on Beth Galetti", "complete dossier on Andrew"
- "company_360": User wants intel on a company (account-level, not individual). May reference by company name OR by a contact's name at that company. Examples: "company 360 for Microsoft", "tell me about Amazon as a company", "company dossier on Meta", "Company 360 for Marc Benioff" (means the company where Marc works)
- "draft_email": User wants to draft/write/compose an email. Examples: "draft an email to Brad", "write an email to Beth", "compose a message to Andrew", "email Brad Smith"
- "draft_note": User wants a shorter, informal note/message (not a full email). Examples: "draft me a note", "write a quick note to Beth", "jot down a message for Brad", "draft a note for Chris"
- "meeting_prep": User wants to prepare for a specific meeting. Examples: "prep me for the Q4 review", "meeting brief for the Amazon sync", "help me prepare for my next meeting"
- "meetings_today": User wants to see their calendar/meetings. Examples: "show my meetings today", "what meetings do I have?", "my calendar this week", "upcoming meetings"
- "daily_priorities": User wants a summary of their day/priorities. Examples: "what should I focus on today?", "my priorities", "plan my day", "what's on my agenda?"
- "needs_attention": User asks about at-risk contacts or who needs follow-up. Examples: "who needs attention?", "which contacts are stale?", "who haven't I spoken to?", "at-risk relationships"
- "nudge_summary": User wants to see the AI evidence/summary for why they should reach out to a contact (from their nudge cards). Examples: "nudge summary for Brad", "show me the evidence for Beth", "why should I reach out to Andrew?", "outreach summary for Chris", "show the summary for Marc Benioff"
- "share_dossier": User wants to share a contact's dossier. Examples: "share the dossier for Brad", "send the 360 for Beth", "share dossier"
- "firm_relationships": User asks who else at the firm knows their contacts, or wants to see cross-coverage / shared relationships. May mention a specific contact or ask broadly. Examples: "who knows my contacts?", "who else knows Andy Jassy?", "firm relationships for Microsoft", "who has a relationship with Amy Hood?", "who covers Amazon?", "introductions to Brad Smith", "other partners at Google"
- "client_updates": User wants a summary of recent activity, news, or signals for their top contacts/clients. Examples: "what's the latest with my top clients?", "any updates on my contacts?", "recent news about my clients", "what's new with my key accounts?", "client activity this week"
- "weekly_summary": User wants a summary of their week — meetings attended, emails sent, interactions, follow-ups. Examples: "summarize my week", "weekly recap", "what happened this week?", "my week in review", "recap of the past week"
- "general_question": Any other question that doesn't fit the above. Examples: "how is Nvidia doing?", "who changed jobs recently?"

Entity extraction rules:
- For contact intents, extract the person's name (e.g. "Brad Smith", "Beth")
- For company intents, extract the company name OR person name as given (e.g. "Microsoft", "Amazon", "Marc Benioff")
- For meeting prep, extract the meeting title or keyword (e.g. "Q4 review", "Amazon sync")
- If the user says "him", "her", "them", or "that person", look at the conversation history to resolve the reference
- If no entity is mentioned and one is needed, set entity to null`;

export async function classifyIntent(
  message: string,
  history?: { role: "user" | "assistant"; content: string }[],
): Promise<IntentResult | null> {
  const recentHistory = (history ?? []).slice(-4);
  const historyContext = recentHistory.length > 0
    ? `\nRecent conversation:\n${recentHistory.map((m) => `${m.role}: ${m.content.slice(0, 200)}`).join("\n")}\n`
    : "";

  const userPrompt = `${historyContext}User message: "${message}"`;

  const result = await callLLMJson<IntentResult>(INTENT_SYSTEM_PROMPT, userPrompt);
  if (!result || !result.intent) return null;

  if (typeof result.confidence === "number" && result.confidence < 0.4) {
    return { intent: "general_question", entity: result.entity ?? null, confidence: result.confidence };
  }

  return {
    intent: result.intent,
    entity: result.entity ?? null,
    confidence: result.confidence ?? 0.8,
  };
}

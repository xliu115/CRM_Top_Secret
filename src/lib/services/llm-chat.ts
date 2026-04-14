import { callLLMWithHistory, type ChatMessage } from "./llm-core";

// ── Chat / RAG ──────────────────────────────────────────────────────

export interface ChatContext {
  question: string;
  retrievedDocs: { type: string; content: string; date?: string; id?: string }[];
  partnerName: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

const CHAT_SYSTEM_PROMPT = `You are Activate, an AI assistant for a client relationship management platform. You help Partners (senior professionals) manage their client relationships.

Your capabilities:
- Answer questions about contacts, companies, interactions, meetings, signals, nudges, events, articles, and campaigns from the CRM
- Search the live web for real-time news, company updates, industry trends, and any external information
- Provide relationship insights and recommendations
- Summarize interaction history and engagement patterns
- Identify risks (stale relationships, missed follow-ups)
- Suggest next steps for outreach

You have access to two types of context:
1. **CRM Data** — internal contacts, interactions, signals, meetings, nudges, events, articles, firm relationships (sources labeled Contact, Interaction, Signal, Nudge, Meeting, Event, Article, Firm Relationship). Use this for questions about interactions, who knows contacts, firm relationships, follow-ups, and stale contacts.
2. **Live Web Results** — real-time search results from the internet (sources labeled "Web Summary" or "Web Result")

Rules:
- Use the provided context documents to answer. Do not make up information.
- Cite sources using [Source N] notation when referencing specific data.
- When citing web results that have URLs, mention the source so the user can click through.
- Be conversational, concise, and actionable.
- If you don't have enough information, say so and suggest what the user could ask instead.
- Remember the conversation history — the user may ask follow-up questions referring to previous answers.
- When listing contacts or data, format it clearly with names, titles, and companies.
- Prefer CRM data for internal questions about contacts, interactions, firm relationships, stale follow-ups, nudges, meetings, events, and article engagement.
- For questions like "who knows my contacts", "who needs follow-up", "which contacts are stale", "recent interactions", or "firm relationship", answer from CRM context first and ignore web results unless the user explicitly asks for live external info.
- If CRM data is sparse, say that clearly and return the best available CRM context rather than filling with generic web content.
- Blend CRM insights with web data naturally only when the user asks about a company, market, or live news.`;

export async function generateChatAnswer(ctx: ChatContext): Promise<string> {
  const docsText = ctx.retrievedDocs
    .map(
      (d, i) =>
        `[Source ${i + 1} – ${d.type}${d.date ? ` (${d.date})` : ""}${d.id ? ` #${d.id}` : ""}]: ${d.content}`
    )
    .join("\n\n");

  const contextMessage = docsText
    ? `Here is the relevant context from ${ctx.partnerName}'s CRM data:\n\n${docsText}`
    : `No relevant context was found in ${ctx.partnerName}'s CRM data for this query.`;

  const messages: ChatMessage[] = [];

  const recentHistory = (ctx.history ?? []).slice(-10);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({
    role: "user",
    content: `${contextMessage}\n\n${ctx.partnerName}'s question: ${ctx.question}`,
  });

  const result = await callLLMWithHistory(CHAT_SYSTEM_PROMPT, messages);
  return result ?? generateChatTemplate(ctx);
}

function generateChatTemplate(ctx: ChatContext): string {
  if (ctx.retrievedDocs.length === 0) {
    return `I don't have enough information to answer that question right now. Here are some things I can help with:\n\n- **"What should I focus on today?"** — daily priorities\n- **"Which contacts need attention?"** — stale relationships\n- **"Quick 360 for [name]"** — contact overview\n- **"Draft an email to [name]"** — email drafting\n- **"Summarize my week"** — weekly recap`;
  }

  const crmDocs = ctx.retrievedDocs.filter(
    (d) => d.type !== "Web Summary" && d.type !== "Web Result"
  );
  const webDocs = ctx.retrievedDocs.filter(
    (d) => d.type === "Web Summary" || d.type === "Web Result"
  );

  const contactNames = crmDocs
    .filter((d) => d.type === "Contact")
    .slice(0, 3)
    .map((d) => d.content.split(" – ")[0]?.trim())
    .filter(Boolean);

  const parts: string[] = [];

  parts.push("I'm having trouble generating a full analysis right now, but I found some relevant data. Try one of these more specific queries:");
  parts.push("");

  if (contactNames.length > 0) {
    parts.push("**Quick actions:**");
    for (const name of contactNames) {
      parts.push(`- "Quick 360 for ${name}"`);
    }
    parts.push(`- "Which contacts need attention?"`);
    parts.push(`- "What should I focus on today?"`);
  } else {
    parts.push("**Try asking:**");
    parts.push(`- "What should I focus on today?"`);
    parts.push(`- "Which contacts need attention?"`);
    parts.push(`- "Show my meetings today"`);
    parts.push(`- "Summarize my week"`);
  }

  if (webDocs.length > 0) {
    parts.push("");
    parts.push("**From the web:**");
    const webLines = webDocs
      .slice(0, 3)
      .map((d) => {
        const url = (d as { url?: string }).url;
        const snippet = d.content.slice(0, 150) + (d.content.length > 150 ? "..." : "");
        return url ? `- ${snippet} ([source](${url}))` : `- ${snippet}`;
      });
    parts.push(...webLines);
  }

  return parts.join("\n");
}

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
    return `I don't have enough information to answer that question. Try asking about specific contacts, companies, or recent interactions.`;
  }

  const crmDocs = ctx.retrievedDocs.filter(
    (d) => d.type !== "Web Summary" && d.type !== "Web Result"
  );
  const webDocs = ctx.retrievedDocs.filter(
    (d) => d.type === "Web Summary" || d.type === "Web Result"
  );

  const parts: string[] = [];

  if (crmDocs.length > 0) {
    const crmLines = crmDocs
      .slice(0, 5)
      .map(
        (d, i) =>
          `- **[Source ${i + 1}]** (${d.type}${d.date ? `, ${d.date}` : ""}): ${d.content.slice(0, 200)}${d.content.length > 200 ? "..." : ""}`
      )
      .join("\n");
    parts.push(`**From your CRM:**\n${crmLines}`);
  }

  if (webDocs.length > 0) {
    const webLines = webDocs
      .slice(0, 5)
      .map((d) => {
        const url = (d as { url?: string }).url;
        const snippet = d.content.slice(0, 250) + (d.content.length > 250 ? "..." : "");
        return url ? `- ${snippet} ([source](${url}))` : `- ${snippet}`;
      })
      .join("\n");
    parts.push(`**From the web:**\n${webLines}`);
  }

  return `Here's what I found:\n\n${parts.join("\n\n")}\n\n*Note: Add credits to your OpenAI account for full AI-powered answers.*`;
}

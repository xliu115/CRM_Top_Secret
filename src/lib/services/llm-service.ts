import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function callLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (openai) {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });
    return res.choices[0]?.message?.content ?? "";
  }
  return "";
}

async function callLLMWithHistory(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  if (openai) {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 2000,
    });
    return res.choices[0]?.message?.content ?? "";
  }
  return "";
}

// ── Email Drafting ──────────────────────────────────────────────────

export interface EmailContext {
  partnerName: string;
  contactName: string;
  contactTitle: string;
  companyName: string;
  nudgeReason: string;
  recentInteractions: string[];
  signals: string[];
}

export async function generateEmail(ctx: EmailContext): Promise<{
  subject: string;
  body: string;
}> {
  const interactionContext = ctx.recentInteractions.length
    ? `Recent interactions:\n${ctx.recentInteractions.map((i) => `- ${i}`).join("\n")}`
    : "No recent interactions.";

  const signalContext = ctx.signals.length
    ? `Relevant signals:\n${ctx.signals.map((s) => `- ${s}`).join("\n")}`
    : "";

  if (openai) {
    const result = await callLLM(
      `You are an expert relationship manager drafting outreach emails. Write professional, warm, concise emails. Return JSON with "subject" and "body" keys only.`,
      `Draft an outreach email from ${ctx.partnerName} to ${ctx.contactName} (${ctx.contactTitle} at ${ctx.companyName}).

Reason for outreach: ${ctx.nudgeReason}

${interactionContext}

${signalContext}

Write a personalized email that references the reason and past context naturally. Keep it under 200 words. Return valid JSON: {"subject": "...", "body": "..."}`
    );
    try {
      const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return generateEmailTemplate(ctx);
    }
  }

  return generateEmailTemplate(ctx);
}

function generateEmailTemplate(ctx: EmailContext): {
  subject: string;
  body: string;
} {
  const firstName = ctx.contactName.split(" ")[0];
  const partnerFirst = ctx.partnerName.split(" ")[0];

  let subject = `Checking in – ${ctx.companyName}`;
  let opening = `I hope this message finds you well.`;

  if (ctx.nudgeReason.includes("role change") || ctx.nudgeReason.includes("promoted")) {
    subject = `Congratulations on the new role!`;
    opening = `I saw the news about your recent role change – congratulations! That's a well-deserved move.`;
  } else if (ctx.nudgeReason.includes("news") || ctx.nudgeReason.includes("in the news")) {
    subject = `Thoughts on ${ctx.companyName}'s recent announcement`;
    opening = `I noticed the recent news about ${ctx.companyName} and wanted to share some thoughts that might be relevant to your work.`;
  } else if (ctx.nudgeReason.includes("event") || ctx.nudgeReason.includes("conference")) {
    subject = `See you at the upcoming event?`;
    opening = `I saw you'll be at an upcoming event and wanted to reach out about connecting there.`;
  } else if (ctx.nudgeReason.includes("days since")) {
    subject = `Quick check-in – ${ctx.companyName}`;
    opening = `It's been a while since we last connected, and I wanted to check in on how things are going.`;
  }

  const lastInteraction = ctx.recentInteractions[0]
    ? `\n\nLast time we spoke, ${ctx.recentInteractions[0].toLowerCase()}`
    : "";

  const body = `Hi ${firstName},

${opening}${lastInteraction}

I'd love to find some time to catch up and hear about what's top of mind for you and the team at ${ctx.companyName}. Would you have 30 minutes in the next couple of weeks?

Looking forward to reconnecting.

Best regards,
${partnerFirst}`;

  return { subject, body };
}

// ── Meeting Brief ───────────────────────────────────────────────────

export interface MeetingBriefContext {
  meetingTitle: string;
  meetingPurpose: string;
  attendees: {
    name: string;
    title: string;
    company: string;
    recentInteractions: string[];
    signals: string[];
  }[];
}

export async function generateMeetingBrief(
  ctx: MeetingBriefContext
): Promise<string> {
  if (openai) {
    const attendeeDetails = ctx.attendees
      .map(
        (a) =>
          `## ${a.name} – ${a.title}, ${a.company}\nRecent interactions: ${a.recentInteractions.join("; ") || "None"}\nSignals: ${a.signals.join("; ") || "None"}`
      )
      .join("\n\n");

    return callLLM(
      `You are an expert meeting preparation assistant. Generate structured, actionable meeting briefs.`,
      `Generate a meeting brief for: "${ctx.meetingTitle}"

Purpose: ${ctx.meetingPurpose}

Attendees:
${attendeeDetails}

Structure the brief with these sections:
1. **Meeting Context** – Why this meeting matters
2. **Attendee Insights** – Key facts about each person
3. **Recommended Agenda** – 3-5 agenda items
4. **Suggested Questions** – 3-5 strategic questions to ask
5. **Risks & Watch-outs** – Potential concerns to be aware of
6. **Preparation Checklist** – 2-3 things to prepare before the meeting`
    );
  }

  return generateBriefTemplate(ctx);
}

function generateBriefTemplate(ctx: MeetingBriefContext): string {
  const attendeeSection = ctx.attendees
    .map((a) => {
      const interactions = a.recentInteractions.length
        ? a.recentInteractions.slice(0, 2).map((i) => `  - ${i}`).join("\n")
        : "  - No recent interactions";
      const signals = a.signals.length
        ? a.signals.slice(0, 2).map((s) => `  - ${s}`).join("\n")
        : "  - No recent signals";
      return `### ${a.name} – ${a.title}, ${a.company}\n**Recent Interactions:**\n${interactions}\n**Signals:**\n${signals}`;
    })
    .join("\n\n");

  return `# Meeting Brief: ${ctx.meetingTitle}

## Meeting Context
${ctx.meetingPurpose || "General relationship meeting."}

## Attendee Insights
${attendeeSection}

## Recommended Agenda
1. Open with relationship check-in and recent developments
2. Discuss strategic priorities and how we can add value
3. Review any open action items from previous meetings
4. Explore new collaboration opportunities
5. Agree on next steps and follow-up timeline

## Suggested Questions
1. What are your top strategic priorities for the next quarter?
2. How is the team adapting to recent organizational changes?
3. Where do you see the biggest opportunities for us to partner?
4. Are there any challenges where we could provide additional support?
5. What would make this relationship even more valuable to you?

## Risks & Watch-outs
- Be mindful of any recent negative sentiment in past interactions
- Watch for signs of competitive pressure or budget constraints
- Note any organizational changes that may affect decision-making

## Preparation Checklist
- [ ] Review all attendee profiles and recent interactions
- [ ] Prepare 1-2 relevant insights or case studies to share
- [ ] Have follow-up materials ready to send post-meeting`;
}

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
1. **CRM Data** — internal contacts, interactions, signals, meetings, nudges, events, articles (sources labeled Contact, Interaction, Signal, Nudge, Meeting, Event, Article)
2. **Live Web Results** — real-time search results from the internet (sources labeled "Web Summary" or "Web Result")

Rules:
- Use the provided context documents to answer. Do not make up information.
- Cite sources using [Source N] notation when referencing specific data.
- When citing web results that have URLs, mention the source so the user can click through.
- Be conversational, concise, and actionable.
- If you don't have enough information, say so and suggest what the user could ask instead.
- Remember the conversation history — the user may ask follow-up questions referring to previous answers.
- When listing contacts or data, format it clearly with names, titles, and companies.
- Blend CRM insights with web data naturally — e.g. if asked about a company, combine what you know from CRM contacts with the latest news.`;

export async function generateChatAnswer(ctx: ChatContext): Promise<string> {
  const docsText = ctx.retrievedDocs
    .map(
      (d, i) =>
        `[Source ${i + 1} – ${d.type}${d.date ? ` (${d.date})` : ""}${d.id ? ` #${d.id}` : ""}]: ${d.content}`
    )
    .join("\n\n");

  if (openai) {
    try {
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

      return await callLLMWithHistory(CHAT_SYSTEM_PROMPT, messages);
    } catch (err) {
      console.error("[llm] OpenAI call failed, falling back to template:", err);
    }
  }

  return generateChatTemplate(ctx);
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

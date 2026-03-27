import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function callLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  if (!openai) return null;
  try {
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
  } catch (err) {
    console.error("[llm-service] OpenAI call failed, falling back to template:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function callLLMWithHistory(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string | null> {
  if (!openai) return null;
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 2000,
    });
    return res.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[llm-service] OpenAI call failed, falling back to template:", err instanceof Error ? err.message : err);
    return null;
  }
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

  const result = await callLLM(
    `You are an expert relationship manager drafting outreach emails. Write professional, warm, concise emails. Return JSON with "subject" and "body" keys only.`,
    `Draft an outreach email from ${ctx.partnerName} to ${ctx.contactName} (${ctx.contactTitle} at ${ctx.companyName}).

Reason for outreach: ${ctx.nudgeReason}

${interactionContext}

${signalContext}

Write a personalized email that references the reason and past context naturally. Keep it under 200 words. Return valid JSON: {"subject": "...", "body": "..."}`
  );
  if (result) {
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
  const attendeeDetails = ctx.attendees
    .map(
      (a) =>
        `## ${a.name} – ${a.title}, ${a.company}\nRecent interactions: ${a.recentInteractions.join("; ") || "None"}\nSignals: ${a.signals.join("; ") || "None"}`
    )
    .join("\n\n");

  const result = await callLLM(
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

  return result ?? generateBriefTemplate(ctx);
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

// ── Dashboard Briefing ──────────────────────────────────────────────

export interface DashboardBriefingContext {
  partnerName: string;
  nudges: { contactName: string; company: string; reason: string; priority: string }[];
  meetings: { title: string; startTime: string; attendeeNames: string[] }[];
  clientNews: { content: string; contactName?: string; company?: string }[];
}

export async function generateDashboardBriefing(
  ctx: DashboardBriefingContext
): Promise<string> {
  const nudgeBlock = ctx.nudges.length
    ? `Open nudges (${ctx.nudges.length}):\n${ctx.nudges.map((n) => `- [${n.priority}] ${n.contactName} (${n.company}): ${n.reason}`).join("\n")}`
    : "No open nudges today.";

  const meetingBlock = ctx.meetings.length
    ? `Upcoming meetings (${ctx.meetings.length}):\n${ctx.meetings.map((m) => `- "${m.title}" at ${m.startTime} with ${m.attendeeNames.join(", ")}`).join("\n")}`
    : "No upcoming meetings.";

  const newsBlock = ctx.clientNews.length
    ? `Recent client news (${ctx.clientNews.length}):\n${ctx.clientNews.slice(0, 5).map((n) => `- ${n.company ? `[${n.company}] ` : ""}${n.content.slice(0, 150)}`).join("\n")}`
    : "No recent client news.";

  const result = await callLLM(
    `You are Activate, an AI assistant for a client relationship management platform. Generate a concise, warm morning briefing for a Partner. Highlight the most important nudges to act on, upcoming meetings to prepare for, and any notable client news. Be conversational and actionable. Keep it to 3-5 sentences. Do not use markdown headers or bullet points — write flowing prose.`,
    `Generate a morning briefing for ${ctx.partnerName}.\n\n${nudgeBlock}\n\n${meetingBlock}\n\n${newsBlock}`
  );

  return result ?? generateBriefingTemplate(ctx);
}

function generateBriefingTemplate(ctx: DashboardBriefingContext): string {
  const parts: string[] = [];

  if (ctx.nudges.length > 0) {
    const top = ctx.nudges[0];
    parts.push(
      `You have ${ctx.nudges.length} open nudge${ctx.nudges.length === 1 ? "" : "s"} to act on — the highest priority is reaching out to **${top.contactName}** at ${top.company}.`
    );
  }

  if (ctx.meetings.length > 0) {
    const next = ctx.meetings[0];
    const attendees = next.attendeeNames.join(", ");
    parts.push(
      `You have ${ctx.meetings.length === 1 ? "a meeting" : `${ctx.meetings.length} meetings`} coming up — next is **"${next.title}"** with ${attendees}.`
    );
  }

  if (ctx.clientNews.length > 0) {
    const company = ctx.clientNews[0].company;
    parts.push(
      company
        ? `There's fresh news about **${company}** worth a look.`
        : `There are ${ctx.clientNews.length} new client signal${ctx.clientNews.length === 1 ? "" : "s"} to review.`
    );
  }

  if (parts.length === 0) {
    return `Looks like a quiet day — no urgent nudges, upcoming meetings, or client news on your radar. A great time to do some proactive outreach!`;
  }

  return parts.join(" ");
}

// ── Narrative Morning Briefing ──────────────────────────────────────

export interface NarrativeBriefingAction {
  contactName: string;
  company: string;
  actionLabel: string;
  deeplink: string;
  detail: string;
}

export interface NarrativeBriefingResult {
  narrative: string;
  topActions: NarrativeBriefingAction[];
}

export interface NarrativeBriefingContext extends DashboardBriefingContext {
  nudges: (DashboardBriefingContext["nudges"][number] & {
    contactId?: string;
    nudgeId?: string;
    ruleType?: string;
    daysSince?: number;
  })[];
  meetings: (DashboardBriefingContext["meetings"][number] & {
    meetingId?: string;
  })[];
}

const NARRATIVE_SYSTEM_PROMPT = `You are a trusted chief of staff writing a morning briefing for a senior consulting Partner. Your tone is warm, direct, and efficient — like a colleague who knows their priorities.

Rules:
- Write flowing prose, 3-4 short paragraphs. NO bullet points, NO headers, NO markdown.
- Lead with the single most important action — the one that would keep the Partner up at night if missed.
- Reference people by full name on first mention, first name only after.
- Weave nudges, meetings, and news into a coherent narrative — don't list them separately.
- End with a brief "on the radar" note for lower-priority signals worth noting.
- Keep it under 250 words — this is a 2-minute read over coffee.
- Be specific: use actual names, companies, days-since numbers, meeting times.

After the narrative, output a JSON block with exactly 3 top actions in this format:
---ACTIONS---
[{"contactName":"...","company":"...","actionLabel":"...","detail":"..."}]

actionLabel should be a short CTA like "Draft check-in email", "Review meeting brief", or "View company news".
detail should be a brief reason like "94 days since last contact" or "Meeting tomorrow at 10am".`;

export async function generateNarrativeBriefing(
  ctx: NarrativeBriefingContext
): Promise<NarrativeBriefingResult> {
  const nudgeBlock = ctx.nudges.length
    ? `Open nudges (${ctx.nudges.length}):\n${ctx.nudges.map((n) => `- [${n.priority}] ${n.contactName} (${n.company}): ${n.reason}${n.daysSince ? ` [${n.daysSince} days since last contact]` : ""}${n.ruleType ? ` [type: ${n.ruleType}]` : ""}`).join("\n")}`
    : "No open nudges today.";

  const meetingBlock = ctx.meetings.length
    ? `Upcoming meetings (${ctx.meetings.length}):\n${ctx.meetings.map((m) => `- "${m.title}" at ${m.startTime} with ${m.attendeeNames.join(", ")}`).join("\n")}`
    : "No upcoming meetings.";

  const newsBlock = ctx.clientNews.length
    ? `Recent client news (${ctx.clientNews.length}):\n${ctx.clientNews.slice(0, 5).map((n) => `- ${n.company ? `[${n.company}] ` : ""}${n.content.slice(0, 150)}`).join("\n")}`
    : "No recent client news.";

  const result = await callLLM(
    NARRATIVE_SYSTEM_PROMPT,
    `Generate a morning briefing for ${ctx.partnerName}.\n\n${nudgeBlock}\n\n${meetingBlock}\n\n${newsBlock}`
  );

  if (result) {
    const parsed = parseNarrativeResponse(result, ctx);
    if (parsed) return parsed;
  }

  return generateNarrativeTemplate(ctx);
}

function parseNarrativeResponse(
  raw: string,
  ctx: NarrativeBriefingContext
): NarrativeBriefingResult | null {
  try {
    const actionSplit = raw.split("---ACTIONS---");
    const narrative = actionSplit[0].trim();
    if (!narrative) return null;

    let topActions: NarrativeBriefingAction[] = [];

    if (actionSplit[1]) {
      const jsonStr = actionSplit[1].trim().replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        topActions = parsed.slice(0, 3).map((a: Record<string, string>) => ({
          contactName: a.contactName ?? "",
          company: a.company ?? "",
          actionLabel: a.actionLabel ?? "Take action",
          detail: a.detail ?? "",
          deeplink: resolveDeeplink(a.contactName, a.company, ctx),
        }));
      }
    }

    if (topActions.length === 0) {
      topActions = buildFallbackActions(ctx);
    }

    return { narrative, topActions };
  } catch {
    return null;
  }
}

function resolveDeeplink(
  contactName: string,
  _company: string,
  ctx: NarrativeBriefingContext
): string {
  const nudge = ctx.nudges.find(
    (n) => n.contactName.toLowerCase() === contactName.toLowerCase()
  );
  if (nudge?.contactId && nudge?.nudgeId) {
    return `/contacts/${nudge.contactId}?nudge=${nudge.nudgeId}`;
  }
  if (nudge?.contactId) {
    return `/contacts/${nudge.contactId}`;
  }

  const meeting = ctx.meetings.find((m) =>
    m.attendeeNames.some((a) => a.toLowerCase() === contactName.toLowerCase())
  );
  if (meeting?.meetingId) {
    return `/meetings/${meeting.meetingId}`;
  }

  return "/nudges";
}

function buildFallbackActions(ctx: NarrativeBriefingContext): NarrativeBriefingAction[] {
  const actions: NarrativeBriefingAction[] = [];

  for (const n of ctx.nudges.slice(0, 2)) {
    const ruleLabels: Record<string, string> = {
      STALE_CONTACT: "Draft check-in email",
      JOB_CHANGE: "Draft congratulations",
      COMPANY_NEWS: "Draft news email",
      UPCOMING_EVENT: "Draft pre-event email",
      MEETING_PREP: "Review meeting brief",
    };
    actions.push({
      contactName: n.contactName,
      company: n.company,
      actionLabel: ruleLabels[n.ruleType ?? ""] ?? "Take action",
      detail: n.daysSince ? `${n.daysSince} days since last contact` : n.reason.slice(0, 60),
      deeplink: n.contactId ? `/contacts/${n.contactId}${n.nudgeId ? `?nudge=${n.nudgeId}` : ""}` : "/nudges",
    });
  }

  if (actions.length < 3 && ctx.meetings.length > 0) {
    const m = ctx.meetings[0];
    actions.push({
      contactName: m.attendeeNames[0] ?? "Team",
      company: "",
      actionLabel: "Review meeting brief",
      detail: `Meeting at ${m.startTime}`,
      deeplink: m.meetingId ? `/meetings/${m.meetingId}` : "/meetings",
    });
  }

  return actions.slice(0, 3);
}

function generateNarrativeTemplate(ctx: NarrativeBriefingContext): NarrativeBriefingResult {
  const paragraphs: string[] = [];
  const firstName = ctx.partnerName.split(" ")[0];

  if (ctx.nudges.length > 0) {
    const top = ctx.nudges[0];
    const daysPart = top.daysSince ? ` — it's been ${top.daysSince} days since your last conversation` : "";
    paragraphs.push(
      `${firstName}, your most important move today is reaching out to ${top.contactName} at ${top.company}${daysPart}. ${top.reason}`
    );

    if (ctx.nudges.length > 1) {
      const others = ctx.nudges.slice(1, 3).map((n) => `${n.contactName} at ${n.company}`).join(" and ");
      paragraphs.push(
        `You also have ${others} on your radar. ${ctx.nudges.length > 3 ? `That's ${ctx.nudges.length} total nudges to work through today.` : ""}`
      );
    }
  }

  if (ctx.meetings.length > 0) {
    const m = ctx.meetings[0];
    const attendees = m.attendeeNames.join(", ");
    paragraphs.push(
      `Coming up: "${m.title}" at ${m.startTime} with ${attendees}.${ctx.meetings.length > 1 ? ` Plus ${ctx.meetings.length - 1} more meeting${ctx.meetings.length > 2 ? "s" : ""} this week.` : ""}`
    );
  }

  if (ctx.clientNews.length > 0) {
    const news = ctx.clientNews[0];
    paragraphs.push(
      `On the radar: ${news.company ? `${news.company} is in the news — ` : ""}${news.content.slice(0, 120)}${news.content.length > 120 ? "..." : ""}`
    );
  }

  if (paragraphs.length === 0) {
    paragraphs.push(
      `${firstName}, it's a quiet day — no urgent nudges, upcoming meetings, or client news on your radar. A great time for proactive outreach to strengthen your key relationships.`
    );
  }

  return {
    narrative: paragraphs.join("\n\n"),
    topActions: buildFallbackActions(ctx),
  };
}

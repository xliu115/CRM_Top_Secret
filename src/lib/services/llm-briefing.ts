import { callLLM } from "./llm-core";

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
- Write flowing prose, 3-4 short paragraphs. NO bullet points, NO headers.
- Lead with the single most important action — the one that would keep the Partner up at night if missed.
- Reference people by full name on first mention, first name only after.
- Weave nudges, meetings, and news into a coherent narrative — don't list them separately.
- End with a brief "on the radar" note for lower-priority signals worth noting.
- Keep it under 250 words — this is a 2-minute read over coffee.
- Be specific: use actual names, companies, days-since numbers, meeting times.
- Use **bold** (markdown) to highlight key information that should catch the reader's eye: contact full names on first mention, company names, days-since numbers, meeting titles, and key news headlines. Do NOT bold generic phrases — only specific names, numbers, and facts.

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
      CAMPAIGN_APPROVAL: "Review campaign",
    };
    const deeplink = n.ruleType === "CAMPAIGN_APPROVAL"
      ? "/campaigns"
      : n.contactId
        ? `/contacts/${n.contactId}${n.nudgeId ? `?nudge=${n.nudgeId}` : ""}`
        : "/nudges";
    actions.push({
      contactName: n.contactName,
      company: n.company,
      actionLabel: ruleLabels[n.ruleType ?? ""] ?? "Take action",
      detail: n.daysSince ? `${n.daysSince} days since last contact` : n.reason.slice(0, 60),
      deeplink,
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
    const daysPart = top.daysSince
      ? ` — it's been **${top.daysSince} days** since your last conversation`
      : "";
    paragraphs.push(
      `${firstName}, your most important move today is reaching out to **${top.contactName}** at **${top.company}**${daysPart}. ${top.reason}`
    );

    if (ctx.nudges.length > 1) {
      const others = ctx.nudges
        .slice(1, 3)
        .map((n) => `**${n.contactName}** at **${n.company}**`)
        .join(" and ");
      paragraphs.push(
        `You also have ${others} on your radar. ${ctx.nudges.length > 3 ? `That's **${ctx.nudges.length} total nudges** to work through today.` : ""}`
      );
    }
  }

  if (ctx.meetings.length > 0) {
    const m = ctx.meetings[0];
    const attendees = m.attendeeNames.map((n) => `**${n}**`).join(", ");
    paragraphs.push(
      `Coming up: **"${m.title}"** at **${m.startTime}** with ${attendees}.${ctx.meetings.length > 1 ? ` Plus ${ctx.meetings.length - 1} more meeting${ctx.meetings.length > 2 ? "s" : ""} this week.` : ""}`
    );
  }

  if (ctx.clientNews.length > 0) {
    const news = ctx.clientNews[0];
    const headline = news.content.slice(0, 120) + (news.content.length > 120 ? "..." : "");
    paragraphs.push(
      `On the radar: ${news.company ? `**${news.company}** is in the news — ` : ""}${headline}`
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

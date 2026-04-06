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
    metadata?: string;
  })[];
  meetings: (DashboardBriefingContext["meetings"][number] & {
    meetingId?: string;
  })[];
}

const NARRATIVE_SYSTEM_PROMPT = `You are a trusted chief of staff writing a morning briefing for a senior consulting Partner. Your tone is warm, direct, and efficient — like a colleague who knows their priorities.

Format:
- Open with ONE bold headline sentence that names the single most important action today and why. If a campaign approval exists, lead with that; otherwise lead with the top-priority contact.
- Below the headline, use SHORT BULLET SECTIONS grouped by category. Each section has a bold label on its own line, then 1-3 markdown bullet points. Only include sections that have data:
  - **Campaign approvals** — campaign name, pending count, deadline. List first when present.
  - **Priority contacts** — who to reach out to, company, days-since, why.
  - **Meetings** — title, time, key attendees, optional prep note.
  - **On the radar** — notable client news worth knowing.
- Write each bullet as a short, natural sentence — like a colleague briefing you verbally. Use "you/your" voice (e.g. "hasn't heard from you in 94 days", not "94 days since last contact"). NOT a data dump.
- Use **bold** for: contact full names (first mention), company names, days-since numbers, meeting titles, campaign names, and deadlines. Do NOT bold generic phrases.
- Reference people by full name on first mention, first name only after.
- Total length: 100-150 words. This is a 60-second glance, not a 2-minute read.
- Do NOT write flowing paragraphs. Use the bullet format described above.

After the briefing, output a JSON block with exactly 3 top actions in this format:
---ACTIONS---
[{"contactName":"...","company":"...","actionLabel":"...","detail":"..."}]

actionLabel should be a short CTA like "Draft check-in email", "Review meeting brief", "View company news", or "Review campaign" (for CAMPAIGN_APPROVAL nudges).
detail should be a brief reason like "94 days since last contact", "Meeting tomorrow at 10am", or "5 contacts pending approval, due Apr 10".
For CAMPAIGN_APPROVAL actions, use the campaign name as "contactName" and set "company" to "Campaign".`;

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
  company: string,
  ctx: NarrativeBriefingContext
): string {
  if (company === "Campaign") {
    const campNudge = ctx.nudges.find(
      (n) => n.ruleType === "CAMPAIGN_APPROVAL"
    );
    if (campNudge?.metadata) {
      try {
        const meta = JSON.parse(campNudge.metadata);
        if (meta.campaignId) return `/campaigns/${meta.campaignId}`;
      } catch { /* fallback */ }
    }
    return "/campaigns";
  }

  const nudge = ctx.nudges.find(
    (n) => n.contactName.toLowerCase() === contactName.toLowerCase()
  );
  if (nudge?.ruleType === "CAMPAIGN_APPROVAL") {
    if (nudge.metadata) {
      try {
        const meta = JSON.parse(nudge.metadata);
        if (meta.campaignId) return `/campaigns/${meta.campaignId}`;
      } catch { /* fallback */ }
    }
    return "/campaigns";
  }
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
  const lines: string[] = [];
  const firstName = ctx.partnerName.split(" ")[0];

  const campaignNudges = ctx.nudges.filter((n) => n.ruleType === "CAMPAIGN_APPROVAL");
  const contactNudges = ctx.nudges.filter((n) => n.ruleType !== "CAMPAIGN_APPROVAL");

  // Bold headline — campaign approval takes priority, then top contact nudge
  if (campaignNudges.length > 0) {
    const nameMatch = campaignNudges[0].reason.match(/Campaign "([^"]+)"/);
    const campName = nameMatch?.[1] ?? "a campaign";
    lines.push(
      `**${firstName}, approve **${campName}** today — ${campaignNudges.length === 1 ? "it needs" : "they need"} your sign-off before going out.**`
    );
  } else if (contactNudges.length > 0) {
    const top = contactNudges[0];
    const daysPart = top.daysSince ? ` — it's been **${top.daysSince} days**` : "";
    lines.push(
      `**Reach out to ${top.contactName} at ${top.company} today${daysPart}.**`
    );
  }

  // Campaign approvals section
  if (campaignNudges.length > 0) {
    lines.push("");
    lines.push("**Campaign approvals**");
    for (const n of campaignNudges) {
      const nameMatch = n.reason.match(/Campaign "([^"]+)"/);
      const campName = nameMatch?.[1] ?? "A campaign";
      lines.push(`- **${campName}** needs your approval — review and approve so it can go out on your behalf.`);
    }
  }

  // Priority contacts section
  if (contactNudges.length > 0) {
    lines.push("");
    lines.push("**Priority contacts**");
    for (const n of contactNudges.slice(0, 3)) {
      const daysPart = n.daysSince
        ? ` hasn't heard from you in **${n.daysSince} days**.`
        : ".";
      const reasonSnippet = n.reason.length > 80
        ? n.reason.slice(0, 77) + "..."
        : n.reason;
      lines.push(
        `- **${n.contactName}** at **${n.company}**${daysPart} ${reasonSnippet}`
      );
    }
  }

  // Meetings section
  if (ctx.meetings.length > 0) {
    lines.push("");
    lines.push("**Meetings**");
    for (const m of ctx.meetings.slice(0, 2)) {
      const attendees = m.attendeeNames.map((a) => `**${a}**`).join(", ");
      lines.push(
        `- You've got **"${m.title}"** at **${m.startTime}** with ${attendees}.`
      );
    }
    if (ctx.meetings.length > 2) {
      lines.push(`- Plus **${ctx.meetings.length - 2}** more this week.`);
    }
  }

  // On the radar section
  if (ctx.clientNews.length > 0) {
    lines.push("");
    lines.push("**On the radar**");
    for (const news of ctx.clientNews.slice(0, 2)) {
      const headline = news.content.slice(0, 120) + (news.content.length > 120 ? "..." : "");
      lines.push(
        news.company
          ? `- **${news.company}** is in the news — ${headline}`
          : `- ${headline}`
      );
    }
  }

  if (lines.length === 0) {
    lines.push(
      `**${firstName}, it's a quiet day — a great time for proactive outreach to strengthen your key relationships.**`
    );
  }

  return {
    narrative: lines.join("\n"),
    topActions: buildFallbackActions(ctx),
  };
}

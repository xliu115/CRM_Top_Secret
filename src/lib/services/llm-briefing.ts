import { callLLM, callLLMJson } from "./llm-core";
import { stripMarkdown } from "@/lib/utils/nudge-summary";

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
    ? `Recent client news (${ctx.clientNews.length}):\n${ctx.clientNews.slice(0, 5).map((n) => `- ${n.company ? `[${n.company}] ` : ""}${stripMarkdown(n.content).slice(0, 150)}`).join("\n")}`
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
    lastContactedAt?: string;
    lastContactedLabel?: string;
    lastInteractionSummary?: string | null;
  })[];
  meetings: (DashboardBriefingContext["meetings"][number] & {
    meetingId?: string;
  })[];
}

const NARRATIVE_SYSTEM_PROMPT = `You are a trusted chief of staff recording the morning briefing for a senior consulting Partner who often listens to it on the go. Write for the ear first, the eye second: natural conversational prose that still scans well.

Principles:
- **Insights over data.** Lead with WHY a person or moment matters right now — pull from the strategic insight (oneLiner first, then narrative) when the nudge has one. Facts (days since, last note) come second, woven into the sentence.
- **Speakable, not scannable.** Never drop clipped data labels like "94 days since last contact" or "Priority: HIGH". Convert days-since into natural phrases — use the "(~…)" humanized form provided in the data (e.g. "it's been close to three months"). Use "you/your" and natural contractions.
- **One breath per bullet.** Each bullet is ONE natural sentence (occasionally two). No fragments, bracketed data, or sub-bullets.
- **Bold sparingly.** At most one or two anchors per bullet — usually the person's full name or the campaign/article title. Do NOT bold days-since phrases, dates, times, or generic words.

Structure (markdown for mobile — must scan visually AND sound good read aloud):
- Open with ONE plain-text headline sentence (no bold) that names the single most important thing to do today and why it matters. If a campaign approval is pending, lead with that; otherwise lead with the highest-priority contact or insight.
- Below, group into sections. Each section starts with a bold heading on its own line (e.g. "**Priority contacts**"). Under each heading, use markdown bullet points ("- ") — one bullet per person, meeting, or signal. Each bullet is ONE natural sentence (two max). NEVER write a paragraph of prose under a heading — always use "- " bullet syntax.
  - **Priority contacts** — one bullet per contact: lead with the strategic reason it matters now; the days-since humanized phrase comes second.
  - **Meetings** — one bullet per meeting: what's on the calendar and a one-line prep angle.
  - **Campaign approvals** — one bullet per campaign: name, pending count, deadline.
  - **Article campaigns** — one bullet per article: title and how many contacts are matched.
  - **On the radar** — one bullet per signal worth knowing today.
- Reference people by full name on first mention, first name after.
- Total length: 90-160 words. Aim shorter if the signal is thin. This is a 45-second listen, not a dashboard.
- CRITICAL: Every item under a section heading MUST be a markdown bullet ("- "). No free-flowing paragraphs.

After the briefing, output a JSON block with exactly 3 top actions in this format:
---ACTIONS---
[{"contactName":"...","company":"...","actionLabel":"...","detail":"..."}]

actionLabel: a short CTA like "Draft check-in email", "Review meeting brief", "View company news", "Review campaign" (for CAMPAIGN_APPROVAL), or "Review article campaign" (for ARTICLE_CAMPAIGN).
detail: a short human reason like "Haven't caught up in about 3 months", "Meeting tomorrow at 10am", "5 contacts pending, due Apr 10", or "8 contacts matched". Prefer humanized time phrases over raw day counts.
For CAMPAIGN_APPROVAL actions, use the campaign name as "contactName" and "Campaign" as "company".
For ARTICLE_CAMPAIGN actions, use the article title as "contactName" and "Article Campaign" as "company".`;

function parseNudgeStrategicInsight(metadata?: string) {
  if (!metadata) return null;
  try {
    const meta = JSON.parse(metadata);
    return meta?.strategicInsight as {
      narrative: string;
      oneLiner?: string;
      suggestedAction?: { label: string };
    } | undefined ?? null;
  } catch { return null; }
}

function humanizeDaysSince(days?: number): string | null {
  if (days == null || days < 1) return null;
  if (days < 3) return "only a couple of days";
  if (days < 10) return "about a week";
  if (days < 21) return "a couple of weeks";
  if (days < 45) return "about a month";
  if (days < 80) return "a couple of months";
  if (days < 120) return "close to three months";
  if (days < 200) return "several months";
  return "well over half a year";
}

function formatNudgeBlockForPrompt(ctx: NarrativeBriefingContext): string {
  if (!ctx.nudges.length) return "No open nudges today.";
  return `Open nudges (${ctx.nudges.length}):\n${ctx.nudges
    .map((n) => {
      const humanDays = humanizeDaysSince(n.daysSince);
      const touch = n.lastContactedLabel
        ? ` [last touch: ${n.lastContactedLabel}${n.daysSince != null ? `, ${n.daysSince} days ago (~${humanDays})` : ""}]`
        : n.daysSince != null
          ? ` [${n.daysSince} days since last contact (~${humanDays})]`
          : "";
      const note =
        n.lastInteractionSummary && n.lastInteractionSummary.trim()
          ? ` [last interaction note: ${n.lastInteractionSummary.slice(0, 200)}]`
          : "";
      const strategic = parseNudgeStrategicInsight(n.metadata);
      const insightLead = strategic?.oneLiner
        ? ` [insight oneLiner: ${strategic.oneLiner}]`
        : "";
      const reasonText = strategic?.narrative
        ? strategic.narrative.slice(0, 300)
        : n.reason;
      const suggested = strategic?.suggestedAction?.label
        ? ` [suggested: ${strategic.suggestedAction.label}]`
        : "";
      return `- [${n.priority}] ${n.contactName} (${n.company}): ${reasonText}${insightLead}${touch}${note}${suggested}${n.ruleType ? ` [type: ${n.ruleType}]` : ""}`;
    })
    .join("\n")}`;
}

export async function generateNarrativeBriefing(
  ctx: NarrativeBriefingContext
): Promise<NarrativeBriefingResult> {
  const nudgeBlock = formatNudgeBlockForPrompt(ctx);

  const meetingBlock = ctx.meetings.length
    ? `Upcoming meetings (${ctx.meetings.length}):\n${ctx.meetings.map((m) => `- "${m.title}" at ${m.startTime} with ${m.attendeeNames.join(", ")}`).join("\n")}`
    : "No upcoming meetings.";

  const newsBlock = ctx.clientNews.length
    ? `Recent client news (${ctx.clientNews.length}):\n${ctx.clientNews.slice(0, 5).map((n) => `- ${n.company ? `[${n.company}] ` : ""}${stripMarkdown(n.content).slice(0, 150)}`).join("\n")}`
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

export function resolveDeeplink(
  contactName: string,
  company: string,
  ctx: NarrativeBriefingContext
): string {
  if (company === "Article Campaign") {
    const artNudge = ctx.nudges.find(
      (n) => n.ruleType === "ARTICLE_CAMPAIGN" &&
        n.contactName.toLowerCase() === contactName.toLowerCase()
    ) ?? ctx.nudges.find((n) => n.ruleType === "ARTICLE_CAMPAIGN");
    if (artNudge?.metadata) {
      try {
        const meta = JSON.parse(artNudge.metadata);
        if (meta.contentItemId) return `/campaigns/draft?contentItemId=${meta.contentItemId}`;
      } catch { /* fallback */ }
    }
    return "/campaigns";
  }

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
  if (nudge?.ruleType === "ARTICLE_CAMPAIGN") {
    if (nudge.metadata) {
      try {
        const meta = JSON.parse(nudge.metadata);
        if (meta.contentItemId) return `/campaigns/draft?contentItemId=${meta.contentItemId}`;
      } catch { /* fallback */ }
    }
    return "/campaigns";
  }
  if (nudge?.contactId && nudge?.ruleType !== "MEETING_PREP") {
    const actionLabel = (() => {
      try {
        const meta = JSON.parse(nudge.metadata ?? "{}");
        return meta?.strategicInsight?.suggestedAction?.label;
      } catch { return undefined; }
    })();
    const sp = new URLSearchParams({
      q: actionLabel ?? "Draft outreach",
      ...(nudge.nudgeId && { nudgeId: nudge.nudgeId }),
      contactId: nudge.contactId,
    });
    return `/chat?${sp.toString()}`;
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
      ARTICLE_CAMPAIGN: "Review article campaign",
      FOLLOW_UP: "Draft follow-up email",
      REPLY_NEEDED: "Draft reply",
    };

    let deeplink: string;
    if (n.ruleType === "CAMPAIGN_APPROVAL") {
      deeplink = "/campaigns";
      if (n.metadata) {
        try {
          const meta = JSON.parse(n.metadata);
          if (meta.campaignId) deeplink = `/campaigns/${meta.campaignId}`;
        } catch { /* fallback to /campaigns */ }
      }
    } else if (n.ruleType === "ARTICLE_CAMPAIGN") {
      try {
        const meta = JSON.parse(n.metadata ?? "{}");
        deeplink = meta.contentItemId
          ? `/campaigns/draft?contentItemId=${meta.contentItemId}`
          : "/campaigns";
      } catch {
        deeplink = "/campaigns";
      }
    } else if (n.contactId && n.ruleType !== "MEETING_PREP") {
      const actionLabel = (() => {
        try {
          const meta = JSON.parse(n.metadata ?? "{}");
          return meta?.strategicInsight?.suggestedAction?.label;
        } catch { return undefined; }
      })();
      const sp = new URLSearchParams({
        q: actionLabel ?? ruleLabels[n.ruleType ?? ""] ?? "Take action",
        ...(n.nudgeId && { nudgeId: n.nudgeId }),
        contactId: n.contactId,
      });
      deeplink = `/chat?${sp.toString()}`;
    } else if (n.contactId) {
      deeplink = `/contacts/${n.contactId}`;
    } else {
      deeplink = "/nudges";
    }
    const isCampaign = n.ruleType === "CAMPAIGN_APPROVAL";
    const isArticleCampaign = n.ruleType === "ARTICLE_CAMPAIGN";
    let displayName = n.contactName;
    let displayCompany = n.company;
    if (isCampaign) {
      const nameMatch = n.reason.match(/Campaign "([^"]+)"/);
      displayName = nameMatch?.[1] ?? n.contactName;
      displayCompany = "Campaign";
    } else if (isArticleCampaign) {
      try {
        const meta = JSON.parse(n.metadata ?? "{}");
        if (meta.articleTitle) displayName = meta.articleTitle;
      } catch { /* ignore */ }
      displayCompany = "Article Campaign";
    }

    actions.push({
      contactName: displayName,
      company: displayCompany,
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

function firstSentence(text: string | undefined, max = 160): string | null {
  if (!text) return null;
  const cleaned = stripMarkdown(text).trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^(.+?[.!?])(\s|$)/);
  const sentence = match ? match[1] : cleaned;
  const trimmed = sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
  return trimmed;
}

function strategicLead(n: NarrativeBriefingContext["nudges"][number]): string | null {
  const strategic = parseNudgeStrategicInsight(n.metadata);
  if (strategic?.oneLiner) {
    const trimmed = strategic.oneLiner.trim();
    return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  }
  const fromNarrative = firstSentence(strategic?.narrative);
  if (fromNarrative) return fromNarrative;
  return firstSentence(n.reason);
}

function generateNarrativeTemplate(ctx: NarrativeBriefingContext): NarrativeBriefingResult {
  const lines: string[] = [];
  const firstName = ctx.partnerName.split(" ")[0];

  const campaignNudges = ctx.nudges.filter((n) => n.ruleType === "CAMPAIGN_APPROVAL");
  const articleCampaignNudges = ctx.nudges.filter((n) => n.ruleType === "ARTICLE_CAMPAIGN");
  const followUpNudges = ctx.nudges.filter((n) => n.ruleType === "FOLLOW_UP");
  const contactNudges = ctx.nudges.filter((n) =>
    n.ruleType !== "CAMPAIGN_APPROVAL" && n.ruleType !== "ARTICLE_CAMPAIGN" && n.ruleType !== "FOLLOW_UP"
  );

  // Plain-text headline (no bold) — insight-led, listenable.
  if (campaignNudges.length > 0) {
    const nameMatch = campaignNudges[0].reason.match(/Campaign "([^"]+)"/);
    const campName = nameMatch?.[1] ?? "a campaign";
    lines.push(
      `${firstName}, the one thing that needs you first today is approving **${campName}** so it can go out.`
    );
  } else if (articleCampaignNudges.length > 0) {
    const artTitle = articleCampaignNudges[0].reason.match(/article "([^"]+)"/)?.[1] ?? "a new article";
    lines.push(
      `${firstName}, there's a timely article — **"${artTitle}"** — worth sharing with the contacts we've matched for you.`
    );
  } else if (followUpNudges.length > 0) {
    const top = followUpNudges[0];
    lines.push(
      `${firstName}, circle back with **${top.contactName}** at ${top.company} — your last note is still sitting without a reply.`
    );
  } else if (contactNudges.length > 0) {
    const top = contactNudges[0];
    const lead = strategicLead(top);
    const human = humanizeDaysSince(top.daysSince);
    const opener = lead
      ? `Top of the list today is **${top.contactName}** at ${top.company} — ${lead.replace(/^./, (c) => c.toLowerCase())}`
      : `Top of the list today is **${top.contactName}** at ${top.company}.`;
    const tail = human ? ` You haven't been in touch in ${human}.` : "";
    lines.push(`${opener}${tail}`);
  }

  // Active follow-ups
  if (followUpNudges.length > 0) {
    lines.push("");
    lines.push("**Active follow-ups**");
    for (const n of followUpNudges.slice(0, 2)) {
      let waitDays = 0;
      try {
        const meta = JSON.parse(n.metadata ?? "{}");
        const fuInsight = meta.insights?.find((i: { type: string }) => i.type === "FOLLOW_UP");
        waitDays = fuInsight?.waitingDays ?? 0;
      } catch { /* ignore */ }
      const waitPhrase = humanizeDaysSince(waitDays);
      const waitPart = waitPhrase ? `it's been ${waitPhrase} with no reply` : "they still haven't replied";
      lines.push(
        `- **${n.contactName}** at ${n.company} — ${waitPart}, so a short nudge makes sense today.`
      );
    }
  }

  // Priority contacts — insight-led
  if (contactNudges.length > 0) {
    lines.push("");
    lines.push("**Priority contacts**");
    for (const n of contactNudges.slice(0, 3)) {
      const lead = strategicLead(n);
      const human = humanizeDaysSince(n.daysSince);
      const pieces: string[] = [];
      pieces.push(`**${n.contactName}** at ${n.company}`);
      if (lead) {
        pieces.push(lead.replace(/^./, (c) => c.toLowerCase()));
      }
      if (human) {
        pieces.push(`you haven't spoken in ${human}`);
      }
      let sentence = pieces.join(" — ");
      if (!/[.!?]$/.test(sentence)) sentence = `${sentence}.`;
      lines.push(`- ${sentence}`);
    }
  }

  // Meetings
  if (ctx.meetings.length > 0) {
    lines.push("");
    lines.push("**Meetings**");
    for (const m of ctx.meetings.slice(0, 2)) {
      const attendees = m.attendeeNames.length > 0
        ? ` with ${m.attendeeNames.slice(0, 2).join(" and ")}${m.attendeeNames.length > 2 ? ` and ${m.attendeeNames.length - 2} more` : ""}`
        : "";
      lines.push(
        `- **${m.title}** ${m.startTime}${attendees} — worth a quick prep pass before you walk in.`
      );
    }
    if (ctx.meetings.length > 2) {
      lines.push(`- Plus ${ctx.meetings.length - 2} more on the calendar this week.`);
    }
  }

  // Campaign approvals
  if (campaignNudges.length > 0) {
    lines.push("");
    lines.push("**Campaign approvals**");
    for (const n of campaignNudges) {
      const nameMatch = n.reason.match(/Campaign "([^"]+)"/);
      const campName = nameMatch?.[1] ?? "A campaign";
      lines.push(
        `- **${campName}** is waiting on your sign-off before it can go out on your behalf.`
      );
    }
  }

  // Article campaigns
  if (articleCampaignNudges.length > 0) {
    lines.push("");
    lines.push("**Article campaigns**");
    for (const n of articleCampaignNudges) {
      const titleMatch = n.reason.match(/article "([^"]+)"/);
      const artTitle = titleMatch?.[1] ?? "New article";
      let matchCount = 0;
      try {
        const meta = JSON.parse(n.metadata ?? "{}");
        matchCount = meta.matchCount ?? 0;
      } catch { /* ignore */ }
      const who = matchCount > 0
        ? `${matchCount} contact${matchCount === 1 ? "" : "s"} we've flagged as a good fit`
        : "a handful of contacts we think are a good fit";
      lines.push(
        `- **"${artTitle}"** is ready to share with ${who} — give it a quick review and send.`
      );
    }
  }

  // On the radar
  if (ctx.clientNews.length > 0) {
    lines.push("");
    lines.push("**On the radar**");
    for (const news of ctx.clientNews.slice(0, 2)) {
      const cleaned = stripMarkdown(news.content);
      const headline = firstSentence(cleaned, 130) ?? cleaned.slice(0, 130);
      lines.push(
        news.company
          ? `- **${news.company}** is in the news — ${headline}`
          : `- ${headline}`
      );
    }
  }

  if (lines.length === 0) {
    lines.push(
      `${firstName}, it's a quiet one today — no urgent asks, no meetings pushing. Good window to reach out before something else fills it.`
    );
  }

  return {
    narrative: lines.join("\n"),
    topActions: buildFallbackActions(ctx),
  };
}

// ── Voice memo script (structured segments for TTS) ─────────────────

export interface VoiceMemoSegmentScript {
  id: string;
  headline: string;
  script: string;
  deeplink?: string;
}

const VOICE_MEMO_JSON_SYSTEM = `You are recording a short voice memo for a senior Partner — not reading a report aloud. Output a single JSON object only, no markdown.

The JSON must match this shape:
{
  "segments": [
    {
      "id": "stable id string",
      "headline": "Very short UI bullet, max 10 words",
      "script": "Plain text only. 2-4 sentences. Spoken like a colleague talking to them in person.",
      "contactName": "optional exact name from the data below for app linking",
      "company": "optional company from the data for disambiguation"
    }
  ]
}

Tone and content (scripts only — this is what they HEAR):
- Use second person ("you") and natural contractions. Sound like one person talking: warm, direct, conversational.
- Full name on first mention of a contact, then first name after. Example style: "You can reach out to Riley Chen at Meridian Group — your last touch with Riley was 61 days ago, back on February second."
- Weave facts into full sentences. Do NOT use report labels or section headers in speech: never say things like "Why this surfaced:", "Latest note:", "Last touch logged as:", "Priority:", or "Next:" as labels.
- Do NOT parrot a written briefing or bullet list. Do NOT read field names from the CRM. Turn facts into natural sentences.
- Use short bridges when changing topic: "When you get a minute…", "Also on your plate…", "One more thing…"
- headline stays scannable for the app UI (short label); script carries the full conversational wording.

Rules:
- Exactly 5 to 7 segments (fewer only if the context has almost nothing to cover).
- Order: greet the partner by first name in segment 1, then highest-priority contact nudges, then meetings, then campaign approvals and article campaigns, then client news/signals.
- headline: tap list (who to contact, meeting prep, news).
- script: TTS only; be specific with names, times, days-since, and dates when the data provides them.
- contactName/company: include when the segment is about a specific person so the app can deep-link; omit for general segments.
- Do not invent people, companies, or meetings not in the context.`;

function buildVoiceMemoUserPrompt(ctx: NarrativeBriefingContext): string {
  const nudgeBlock = formatNudgeBlockForPrompt(ctx);

  const meetingBlock = ctx.meetings.length
    ? `Upcoming meetings (${ctx.meetings.length}):\n${ctx.meetings.map((m) => `- "${m.title}" at ${m.startTime} with ${m.attendeeNames.join(", ")}`).join("\n")}`
    : "No upcoming meetings.";

  const newsBlock = ctx.clientNews.length
    ? `Recent client news (${ctx.clientNews.length}):\n${ctx.clientNews.slice(0, 5).map((n) => `- ${n.company ? `[${n.company}] ` : ""}${(n.content ?? "").slice(0, 150)}`).join("\n")}`
    : "No recent client news.";

  return `Partner display name: ${ctx.partnerName}

The Partner will see a separate short written summary on screen. Your job is ONLY the spoken voice memo below — conversational, as if you are next to them, not reading that summary.

CRM facts (only use what is here):
${nudgeBlock}

${meetingBlock}

${newsBlock}

Generate the voice memo JSON: segments with conversational scripts as specified.`;
}

function parseVoiceMemoSegments(
  raw: unknown[],
  ctx: NarrativeBriefingContext
): VoiceMemoSegmentScript[] {
  const out: VoiceMemoSegmentScript[] = [];
  for (let i = 0; i < raw.length && out.length < 7; i++) {
    const seg = raw[i] as Record<string, unknown>;
    const id = typeof seg.id === "string" ? seg.id : `s${i}`;
    const headline = typeof seg.headline === "string" ? seg.headline.trim() : "";
    const script = typeof seg.script === "string" ? seg.script.trim() : "";
    if (!headline || !script) continue;
    const contactName =
      typeof seg.contactName === "string" ? seg.contactName.trim() : "";
    const company = typeof seg.company === "string" ? seg.company.trim() : "";
    const deeplink = contactName
      ? resolveDeeplink(contactName, company, ctx)
      : undefined;
    out.push({ id, headline, script, deeplink });
  }
  return out;
}

function voiceNudgeFactSentence(n: NarrativeBriefingContext["nudges"][number]): string {
  const first = n.contactName.split(/\s+/)[0] ?? n.contactName;
  const sentences: string[] = [];

  if (n.lastContactedLabel && n.lastContactedLabel !== "No logged touch") {
    const daysBit = n.daysSince != null ? `, about ${n.daysSince} days ago` : "";
    sentences.push(`Your last touch with ${first} was ${n.lastContactedLabel}${daysBit}.`);
  } else if (n.daysSince != null) {
    sentences.push(`It's been about ${n.daysSince} days since you last connected with ${first}.`);
  }

  if (n.lastInteractionSummary?.trim()) {
    const s = n.lastInteractionSummary.trim();
    const t = s.length > 200 ? `${s.slice(0, 197)}...` : s;
    sentences.push(`You noted in the CRM: ${t}`);
  }

  const signal = n.reason?.trim();
  if (signal) {
    const shortReason = signal.length > 140 ? `${signal.slice(0, 137)}...` : signal;
    sentences.push(`This came up because ${shortReason}`);
  }

  return sentences.join(" ");
}

export function generateVoiceMemoScriptFallback(
  ctx: NarrativeBriefingContext
): VoiceMemoSegmentScript[] {
  const firstName = ctx.partnerName.split(" ")[0];
  const segments: VoiceMemoSegmentScript[] = [];

  if (ctx.nudges.length > 0) {
    const top = ctx.nudges[0];
    segments.push({
      id: "nudge-0",
      headline: `Reach out: ${top.contactName}`,
      script: `Hi ${firstName}. If you only do one thing today, make it ${top.contactName} at ${top.company}. ${voiceNudgeFactSentence(top)}`,
      deeplink: resolveDeeplink(top.contactName, top.company, ctx),
    });
  }

  for (let i = 1; i < Math.min(ctx.nudges.length, 3); i++) {
    const n = ctx.nudges[i];
    segments.push({
      id: `nudge-${i}`,
      headline: `Follow up: ${n.contactName}`,
      script: `I'd also carve out time for ${n.contactName} at ${n.company}. ${voiceNudgeFactSentence(n)}`,
      deeplink: resolveDeeplink(n.contactName, n.company, ctx),
    });
  }

  if (ctx.meetings.length > 0) {
    const m = ctx.meetings[0];
    segments.push({
      id: "meeting-0",
      headline: `Prep: ${m.title}`,
      script: `You have ${m.title} at ${m.startTime} with ${m.attendeeNames.join(" and ")} — worth a quick prep pass before you walk in.`,
      deeplink: m.meetingId ? `/meetings/${m.meetingId}` : "/meetings",
    });
  }

  if (ctx.clientNews.length > 0) {
    const n = ctx.clientNews[0];
    const body = (n.content ?? "").slice(0, 220) + ((n.content ?? "").length > 220 ? "..." : "");
    segments.push({
      id: "news-0",
      headline: n.company ? `News: ${n.company}` : "Client signals",
      script: n.company
        ? `Here's something making the rounds on ${n.company}: ${body}`
        : `Here's a signal worth skimming: ${body}`,
      deeplink: "/nudges",
    });
  }

  if (segments.length === 0) {
    segments.push({
      id: "quiet",
      headline: "Quiet day",
      script: `Hi ${firstName}. It's pretty quiet — no urgent nudges, meetings, or news right now. That usually means a good window to reach out before something else fills the calendar.`,
      deeplink: "/contacts",
    });
  }

  return segments.slice(0, 7);
}

export async function generateVoiceMemoScript(
  ctx: NarrativeBriefingContext
): Promise<VoiceMemoSegmentScript[]> {
  const result = await callLLMJson<{ segments?: unknown[] }>(
    VOICE_MEMO_JSON_SYSTEM,
    buildVoiceMemoUserPrompt(ctx),
    { maxTokens: 3000 }
  );

  if (result?.segments && Array.isArray(result.segments)) {
    const parsed = parseVoiceMemoSegments(result.segments, ctx);
    if (parsed.length > 0) return parsed;
  }

  return generateVoiceMemoScriptFallback(ctx);
}

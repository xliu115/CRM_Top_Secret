import { callLLM, callLLMJson } from "./llm-core";

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
    ? `Recent client news (${ctx.clientNews.length}):\n${ctx.clientNews.slice(0, 5).map((n) => `- ${n.company ? `[${n.company}] ` : ""}${(n.content ?? "").slice(0, 150)}`).join("\n")}`
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
    /** ISO 8601 when last touch is known */
    lastContactedAt?: string;
    /** e.g. "Mar 12, 2026" or "No logged touch" */
    lastContactedLabel?: string;
    /** Most recent interaction summary for this contact */
    lastInteractionSummary?: string | null;
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

function formatNudgeBlockForPrompt(ctx: NarrativeBriefingContext): string {
  if (!ctx.nudges.length) return "No open nudges today.";
  return `Open nudges (${ctx.nudges.length}):\n${ctx.nudges
    .map((n) => {
      const touch = n.lastContactedLabel
        ? ` [last touch: ${n.lastContactedLabel}${n.daysSince != null ? `, ${n.daysSince} days ago` : ""}]`
        : n.daysSince != null
          ? ` [${n.daysSince} days since last contact]`
          : "";
      const note =
        n.lastInteractionSummary && n.lastInteractionSummary.trim()
          ? ` [last interaction note: ${n.lastInteractionSummary.slice(0, 200)}]`
          : "";
      return `- [${n.priority}] ${n.contactName} (${n.company}): ${n.reason}${touch}${note}${n.ruleType ? ` [type: ${n.ruleType}]` : ""}`;
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
    ? `Recent client news (${ctx.clientNews.length}):\n${ctx.clientNews.slice(0, 5).map((n) => `- ${n.company ? `[${n.company}] ` : ""}${(n.content ?? "").slice(0, 150)}`).join("\n")}`
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
    const nc = news.content ?? "";
    const headline = nc.slice(0, 120) + (nc.length > 120 ? "..." : "");
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
- Order: greet the partner by first name in segment 1, then highest-priority nudges, then meetings, then client news and pipeline-style priorities.
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

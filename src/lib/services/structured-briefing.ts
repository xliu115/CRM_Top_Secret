import type { NarrativeBriefingContext } from "./llm-briefing";

/** Shape returned by GET /api/dashboard/briefing `structured` — safe for client + server */
export type ApiStructuredBriefing = {
  nudges: Array<{
    contactName: string;
    company: string;
    reason: string;
    priority?: string;
    contactId: string;
    nudgeId?: string;
    ruleType?: string;
    daysSince?: number;
    lastContactedAt?: string;
    lastContactedLabel?: string;
    lastInteractionSummary?: string | null;
  }>;
  meetings: Array<{
    title: string;
    startTime: string;
    attendeeNames: string[];
    meetingId: string;
  }>;
  news: Array<{
    content: string;
    contactName?: string | null;
    company?: string | null;
    companyId?: string;
    url?: string | null;
  }>;
};

/** Build the same CRM markdown on the client from `structured` when the API field is missing or stale */
export function buildDataDrivenSummaryFromStructured(
  partnerName: string,
  structured: ApiStructuredBriefing
): string {
  const ctx: NarrativeBriefingContext = {
    partnerName,
    nudges: structured.nudges.map((n) => ({
      contactName: n.contactName,
      company: n.company,
      reason: n.reason ?? "",
      priority: n.priority ?? "MEDIUM",
      contactId: n.contactId,
      nudgeId: n.nudgeId,
      ruleType: n.ruleType,
      daysSince: n.daysSince,
      lastContactedAt: n.lastContactedAt,
      lastContactedLabel: n.lastContactedLabel,
      lastInteractionSummary: n.lastInteractionSummary ?? undefined,
    })),
    meetings: structured.meetings.map((m) => ({
      title: m.title,
      startTime: m.startTime,
      attendeeNames: m.attendeeNames ?? [],
      meetingId: m.meetingId,
    })),
    clientNews: structured.news.map((s) => ({
      content: s.content ?? "",
      contactName: s.contactName ?? undefined,
      company: s.company ?? undefined,
    })),
  };
  return buildDataDrivenSummaryMarkdown(ctx);
}

/**
 * Factual markdown built only from CRM fields (no LLM). Used when narrative is empty
 * or as a reliable fallback on mobile.
 */
export function buildDataDrivenSummaryMarkdown(ctx: NarrativeBriefingContext): string {
  const firstName = ctx.partnerName.split(" ")[0];
  const blocks: string[] = [];

  blocks.push(`Good morning, **${ctx.partnerName}** — here's your snapshot from your CRM.\n`);

  const campaignNudges = ctx.nudges.filter((n) => n.ruleType === "CAMPAIGN_APPROVAL");
  const articleNudges = ctx.nudges.filter((n) => n.ruleType === "ARTICLE_CAMPAIGN");
  const contactNudges = ctx.nudges.filter(
    (n) => n.ruleType !== "CAMPAIGN_APPROVAL" && n.ruleType !== "ARTICLE_CAMPAIGN"
  );

  if (contactNudges.length > 0) {
    const bullets = contactNudges.slice(0, 5).map((n) => {
      const touchPart = (() => {
        if (n.lastContactedLabel && n.lastContactedLabel !== "No logged touch") {
          return `Last touch **${n.lastContactedLabel}**${
            n.daysSince != null ? ` (${n.daysSince} days ago)` : ""
          }`;
        }
        if (n.lastContactedLabel === "No logged touch") {
          return "**No logged touch** in CRM";
        }
        if (n.daysSince != null) {
          return `**${n.daysSince}** days since last outreach`;
        }
        return "Needs attention";
      })();

      const header = `- **${n.contactName}** · **${n.company}** — ${touchPart}.`;

      const noteRaw = (n.lastInteractionSummary ?? "").trim();
      const noteLine =
        noteRaw.length > 0
          ? `\n  - Latest note: ${noteRaw.length > 160 ? `${noteRaw.slice(0, 157)}…` : noteRaw}`
          : "";

      let whyText = "";
      let actionHint = "";
      try {
        const meta = JSON.parse(n.metadata ?? "{}");
        if (meta?.strategicInsight?.oneLiner) {
          whyText = meta.strategicInsight.oneLiner;
        }
        if (meta?.strategicInsight?.suggestedAction?.label) {
          actionHint = meta.strategicInsight.suggestedAction.label;
        }
      } catch { /* ignore */ }
      if (!whyText) {
        const reasonRaw = (n.reason ?? "").trim();
        whyText = reasonRaw.length > 120 ? `${reasonRaw.slice(0, 117)}…` : reasonRaw;
      }
      const whyLine = whyText ? `\n  - Why this surfaced: ${whyText}` : "";
      const actionLine = actionHint ? `\n  - Suggested: ${actionHint}` : "";

      return `${header}${noteLine}${whyLine}${actionLine}`;
    });
    blocks.push("**Who to contact:**\n\n" + bullets.join("\n\n"));
  }

  if (ctx.meetings.length > 0) {
    const lines = ctx.meetings.map(
      (m) =>
        `- **${m.title}** — ${m.startTime} with ${m.attendeeNames.join(", ")}.`
    );
    blocks.push("**Meetings:**\n\n" + lines.join("\n\n"));
  }

  if (campaignNudges.length > 0) {
    const lines = campaignNudges.map((n) => {
      const nameMatch = n.reason.match(/Campaign "([^"]+)"/);
      const campName = nameMatch?.[1] ?? "A campaign";
      return `- **${campName}** — pending your approval.`;
    });
    blocks.push("**Campaign approvals:**\n\n" + lines.join("\n\n"));
  }

  if (articleNudges.length > 0) {
    const lines = articleNudges.map((n) => {
      const titleMatch = n.reason.match(/article "([^"]+)"/);
      const artTitle = titleMatch?.[1] ?? "New article";
      let matchCount = 0;
      try {
        const meta = JSON.parse(n.metadata ?? "{}");
        matchCount = meta.matchCount ?? 0;
      } catch { /* ignore */ }
      const who = matchCount > 0
        ? `${matchCount} contact${matchCount === 1 ? "" : "s"} matched`
        : "contacts matched";
      return `- **"${artTitle}"** — ${who}.`;
    });
    blocks.push("**Articles to share:**\n\n" + lines.join("\n\n"));
  }

  if (ctx.clientNews.length > 0) {
    const lines = ctx.clientNews.slice(0, 4).map((s) => {
      const label = s.company ? `**${s.company}**` : s.contactName ? `**${s.contactName}**` : "Signal";
      const raw = s.content ?? "";
      const body = raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
      return `- ${label}: ${body}`;
    });
    blocks.push("**Signals & news:**\n\n" + lines.join("\n\n"));
  }

  if (ctx.nudges.length === 0 && ctx.meetings.length === 0 && ctx.clientNews.length === 0) {
    blocks.push(
      `Hi ${firstName} — nothing urgent in your nudges, next 48 hours of meetings, or recent signals. Good time for proactive outreach.`
    );
  }

  return blocks.join("\n\n");
}

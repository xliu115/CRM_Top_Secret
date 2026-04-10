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

  if (ctx.nudges.length > 0) {
    const bullets = ctx.nudges.slice(0, 5).map((n) => {
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

      const reasonRaw = (n.reason ?? "").trim();
      const reasonShort =
        reasonRaw.length > 120 ? `${reasonRaw.slice(0, 117)}…` : reasonRaw;
      const whyLine =
        reasonShort.length > 0
          ? `\n  - Why this surfaced: ${reasonShort}`
          : "";

      return `${header}${noteLine}${whyLine}`;
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

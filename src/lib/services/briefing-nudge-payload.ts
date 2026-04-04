import { differenceInDays, format } from "date-fns";
import type { NarrativeBriefingContext } from "./llm-briefing";

/** Open nudge with contact + company — matches Prisma `nudge` include shape used by briefing builders */
export type BriefingNudgeSource = {
  id: string;
  reason: string;
  priority: string;
  ruleType: string;
  contact: {
    id: string;
    name: string;
    lastContacted: Date | null;
    company: { name: string };
  };
};

/** Latest interaction summary per contact (first row wins — callers should pass date-desc order). */
export function mapLatestInteractionSummaryByContact(
  interactions: { contactId: string; summary: string }[]
): Map<string, string> {
  const m = new Map<string, string>();
  for (const row of interactions) {
    if (!m.has(row.contactId)) {
      m.set(row.contactId, row.summary);
    }
  }
  return m;
}

export function buildTopNudgePayloads(
  sortedNudges: BriefingNudgeSource[],
  now: Date,
  latestSummaryByContact: Map<string, string>
): NarrativeBriefingContext["nudges"] {
  return sortedNudges.slice(0, 5).map((n) => {
    const lc = n.contact.lastContacted;
    const daysSince = lc ? differenceInDays(now, new Date(lc)) : undefined;
    const lastInteractionSummary = latestSummaryByContact.get(n.contact.id) ?? null;

    return {
      contactName: n.contact.name,
      company: n.contact.company.name,
      reason: n.reason,
      priority: n.priority,
      contactId: n.contact.id,
      nudgeId: n.id,
      ruleType: n.ruleType,
      daysSince,
      ...(lc
        ? {
            lastContactedAt: new Date(lc).toISOString(),
            lastContactedLabel: format(new Date(lc), "MMM d, yyyy"),
          }
        : { lastContactedLabel: "No logged touch" }),
      lastInteractionSummary,
    };
  });
}

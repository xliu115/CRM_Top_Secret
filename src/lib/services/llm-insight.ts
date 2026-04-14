import { callLLMJson } from "./llm-core";
import { interactionRepo } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { formatDateForLLM } from "@/lib/utils/format-date";
import { differenceInDays } from "date-fns";
import type { NudgeWithRelations } from "@/lib/repositories/interfaces/nudge-repository";

// ── Types ───────────────────────────────────────────────────────────

export interface StrategicInsight {
  narrative: string;
  oneLiner: string;
  suggestedAction: {
    label: string;
    context: string;
    emailAngle: string;
  };
  evidenceCitations: {
    claim: string;
    insightTypes: string[];
    signalIds: string[];
    sourceUrls: string[];
  }[];
  generatedAt: string;
}

interface InsightForPrompt {
  type: string;
  reason: string;
  priority: string;
  signalId?: string;
  signalContent?: string;
  signalUrl?: string | null;
  personName?: string;
  waitingDays?: number;
  lastInteraction?: { type: string; date: string; summary: string };
}

// ── System Prompt ───────────────────────────────────────────────────

const STRATEGIC_INSIGHT_SYSTEM_PROMPT = `You are a senior strategic advisor briefing a consulting Partner about a key executive in their client portfolio. Synthesize raw CRM signals into a concise narrative about what pressures this person faces and why now is the right moment to engage.

Rules:
- Never list data points. Connect them into a strategic story.
- If multiple signals exist (job change + news + stale relationship), explain what that combination means for the person's priorities.
- Ground every claim in the provided evidence. Do not fabricate.
- End with a natural bridge to why outreach makes sense right now.
- Write in flowing prose, 2-3 sentences maximum. Be concise and scannable.
- Use **bold** ONLY for signal triggers and strategic conclusions — the "what happened" and "what it means" parts. Examples: **leadership reshuffling at Apple**, **balancing AI repositioning with platform stability**, **70-day gap since last contact**.
- Do NOT bold people's names, job titles, or company names on their own. Only bold them when they are part of a signal trigger (e.g., **departure of the AI head** is good, **John Giannandrea** alone is not).
- When the data is thin (e.g. only a stale contact signal), keep it to 1-2 sentences.
- The oneLiner must be 15-20 words summarizing the key insight for compact displays.
- The suggestedAction.label must be under 60 characters — a specific CTA like "Reach out about Apple's AI transformation".
- The suggestedAction.context must be a rich paragraph the email draft system can use as prompt context.
- The suggestedAction.emailAngle must be 2-4 words describing the topic.
- evidenceCitations must map key claims from the narrative back to the signal data provided.

Output valid JSON with this exact structure:
{
  "narrative": "2-3 sentences of concise strategic synthesis...",
  "oneLiner": "15-20 word summary for compact displays...",
  "suggestedAction": {
    "label": "Specific CTA button text (under 60 chars)...",
    "context": "Rich paragraph the email draft system should use as prompt context...",
    "emailAngle": "2-4 word topic..."
  },
  "evidenceCitations": [
    {
      "claim": "key claim from the narrative",
      "insightTypes": ["COMPANY_NEWS", "JOB_CHANGE"],
      "signalIds": ["signal-id-1"],
      "sourceUrls": ["https://..."]
    }
  ]
}`;

// ── Eligible Types ──────────────────────────────────────────────────

export const ELIGIBLE_INSIGHT_TYPES = new Set([
  "STALE_CONTACT",
  "JOB_CHANGE",
  "COMPANY_NEWS",
  "LINKEDIN_ACTIVITY",
  "UPCOMING_EVENT",
  "EVENT_ATTENDED",
  "EVENT_REGISTERED",
  "ARTICLE_READ",
  "MEETING_PREP",
]);

// ── Prompt Builder ──────────────────────────────────────────────────

async function buildInsightUserPrompt(
  nudge: NudgeWithRelations,
  insights: InsightForPrompt[],
  partnerName: string,
): Promise<string> {
  const now = new Date();
  const contact = nudge.contact;
  const company = contact.company;

  const [interactions, contactSignals, companySignals] = await Promise.all([
    interactionRepo.findByContactId(nudge.contactId),
    prisma.externalSignal.findMany({
      where: { contactId: nudge.contactId },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.externalSignal.findMany({
      where: { companyId: contact.companyId },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);

  const recentInteractions = interactions.slice(0, 10);
  const lastInteraction = recentInteractions[0];
  const daysSinceLast = lastInteraction
    ? differenceInDays(now, new Date(lastInteraction.date))
    : null;

  const lines: string[] = [];

  lines.push(`## Briefing for Partner: ${partnerName}`);
  lines.push(`## Contact: ${contact.name}`);
  lines.push(`Title: ${contact.title} | Company: ${company.name} (${company.industry ?? "Unknown industry"})`);
  lines.push(`Importance: ${contact.importance}`);
  if (contact.notes) lines.push(`Notes: ${contact.notes}`);
  if (daysSinceLast !== null) {
    lines.push(`Days since last interaction: ${daysSinceLast}`);
  } else {
    lines.push(`No recorded interactions.`);
  }

  if (recentInteractions.length > 0) {
    lines.push(`\n## Recent Interactions (${recentInteractions.length})`);
    for (const i of recentInteractions) {
      const dir = (i as { direction?: string }).direction ? ` [${(i as { direction?: string }).direction}]` : "";
      lines.push(`- ${formatDateForLLM(new Date(i.date))} | ${i.type}${dir} | ${i.summary ?? "No summary"}`);
    }
  }

  if (insights.length > 0) {
    lines.push(`\n## Nudge Signals (${insights.length})`);
    for (const ins of insights) {
      const signalRef = ins.signalId ? ` [signalId: ${ins.signalId}]` : "";
      const urlRef = ins.signalUrl ? ` [url: ${ins.signalUrl}]` : "";
      lines.push(`- [${ins.type}] ${ins.reason}${signalRef}${urlRef}`);
      if (ins.signalContent) {
        lines.push(`  Content: ${ins.signalContent.slice(0, 300)}`);
      }
    }
  }

  const seenIds = new Set(contactSignals.map((s) => s.id));
  const dedupedCompany = companySignals.filter((s) => !seenIds.has(s.id));
  const allSignals = [...contactSignals, ...dedupedCompany];

  if (allSignals.length > 0) {
    lines.push(`\n## External Signals (${allSignals.length})`);
    for (const s of allSignals.slice(0, 8)) {
      lines.push(`- [${s.type}] ${s.content.slice(0, 300)}${s.url ? ` (${s.url})` : ""} [signalId: ${s.id}]`);
    }
  }

  return lines.join("\n");
}

// ── Generator ───────────────────────────────────────────────────────

export async function generateStrategicInsight(
  nudge: NudgeWithRelations,
  insights: InsightForPrompt[],
  partnerName: string,
): Promise<StrategicInsight | null> {
  try {
    const userPrompt = await buildInsightUserPrompt(nudge, insights, partnerName);

    const result = await callLLMJson<Omit<StrategicInsight, "generatedAt">>(
      STRATEGIC_INSIGHT_SYSTEM_PROMPT,
      userPrompt,
      { maxTokens: 800, temperature: 0.4 },
    );

    if (!result) return null;

    if (
      !result.narrative ||
      !result.suggestedAction?.label ||
      !result.suggestedAction?.context ||
      !result.oneLiner
    ) {
      console.error("[llm-insight] Invalid strategic insight response — missing required fields");
      return null;
    }

    return {
      narrative: result.narrative,
      oneLiner: result.oneLiner,
      suggestedAction: {
        label: result.suggestedAction.label.slice(0, 60),
        context: result.suggestedAction.context,
        emailAngle: result.suggestedAction.emailAngle ?? "",
      },
      evidenceCitations: Array.isArray(result.evidenceCitations)
        ? result.evidenceCitations
        : [],
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(
      "[llm-insight] Failed to generate strategic insight:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

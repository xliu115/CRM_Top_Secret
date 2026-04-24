import type { StructuredBrief } from "@/lib/types/structured-brief";

/**
 * Build a 2-3 sentence synthesis of a structured meeting brief for the chat
 * channel. The full brief stays available behind a "View full brief" pill so
 * partners aren't forced to scroll a wall of text on mobile.
 *
 * The synthesis always tries to cover, in this order:
 *   1. The meeting's goal (what we're trying to accomplish)
 *   2. The sharpest conversation starter or top-of-mind signal
 *   3. The relationship temperature (if COOL/COLD or if recently active)
 */
export function synthesizeBrief(brief: StructuredBrief): string {
  const parts: string[] = [];

  const goal = brief.meetingGoal?.statement?.trim();
  if (goal) parts.push(goal);

  const topStarter = brief.conversationStarters?.[0]?.question?.trim();
  const topOfMind = brief.executiveProfile?.topOfMind?.trim();
  const newsHeadline = brief.newsInsights?.[0]?.headline?.trim();

  if (topStarter) {
    parts.push(`Open with: "${topStarter}"`);
  } else if (topOfMind) {
    parts.push(`Top-of-mind: ${topOfMind}`);
  } else if (newsHeadline) {
    parts.push(`Thread to pull: ${newsHeadline}`);
  }

  const temp = brief.relationshipHistory?.temperature;
  const relSummary = brief.relationshipHistory?.summary?.trim();
  if (temp && relSummary) {
    const tempLabel = {
      HOT: "Hot relationship",
      WARM: "Warm relationship",
      COOL: "Cool relationship — worth rewarming",
      COLD: "Cold relationship — treat as first real touch",
    }[temp];
    parts.push(`${tempLabel}: ${relSummary}`);
  }

  return parts.join("\n\n");
}

/**
 * Fallback synthesis from raw markdown when structured parsing fails. Pulls
 * the first non-heading, non-empty paragraph as the one-line summary.
 */
export function synthesizeFromRaw(raw: string): string {
  const lines = raw.split("\n");
  const firstPara: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (firstPara.length > 0) break;
      continue;
    }
    if (t.startsWith("#") || t.startsWith("---")) continue;
    firstPara.push(t);
    if (firstPara.join(" ").length > 240) break;
  }
  return firstPara.join(" ").slice(0, 320);
}

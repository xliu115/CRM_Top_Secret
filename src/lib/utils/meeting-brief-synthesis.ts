import type { StructuredBrief } from "@/lib/types/structured-brief";

/**
 * Build a 2-3 paragraph synthesis of a structured meeting brief for the chat
 * channel. The full brief stays available behind a "View full brief" pill so
 * partners aren't forced to scroll a wall of text on mobile.
 *
 * Voice: a chief-of-staff handing the partner the punchy version 90 seconds
 * before they walk into a room — never a data dump. Reference:
 * /Users/Xinyu_Liu/Xinyu/pre-meeting-brief-redesign/docs/CONTENT-SPEC.md.
 *
 * Field-selection priority (highest → lowest), with generic content filtered
 * out at every step:
 *   1. The strategic story — `executiveProfile.topOfMind` first sentence,
 *      else the first `newsInsights` body sentence, else the meeting goal.
 *   2. The lead "person bullet" if it's specific (e.g. "AI-first CEO. Pushed
 *      the org to ship Apple Intelligence on-device"), or a specific
 *      conversation starter if available, or the second news insight.
 *   3. Relationship anchor — only when the summary has concrete content
 *      (named contacts, counts, dates), never just a temperature recap.
 *
 * Output is plain text with `\n\n` paragraph breaks (rendered with
 * `whitespace-pre-line` in MeetingBrief). No markdown — markdown won't
 * render in the chat block.
 */
export function synthesizeBrief(brief: StructuredBrief): string {
  const parts: string[] = [];

  const lead = pickLead(brief);
  if (lead) parts.push(lead);

  const supporting = pickSupporting(brief, lead);
  if (supporting) parts.push(supporting);

  const relationship = pickRelationship(brief);
  if (relationship) parts.push(relationship);

  return parts.join("\n\n");
}

/**
 * Extract the rich "Top-of-Mind" paragraph for the primary attendee — the
 * 3-4 sentence strategic narrative that gives the partner a window into
 * what's actually on this person's plate right now. Mirrors the desktop
 * `ExecutiveProfileCard` treatment.
 *
 * Returns null when the topOfMind is missing, too short, or generic enough
 * that the synthesis fallback would do better.
 */
export function extractTopOfMind(
  brief: StructuredBrief,
): { subjectName: string; content: string } | null {
  const raw = brief.executiveProfile?.topOfMind?.trim();
  if (!raw) return null;

  // Take up to the first 4 sentences and ensure substance: at least 2
  // sentences and a real proper noun anywhere.
  const sentences = raw.match(/[^.!?]+[.!?]+/g) ?? [raw];
  if (sentences.length === 0) return null;
  const trimmed = sentences
    .slice(0, 4)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
  if (trimmed.length < 80) return null;

  // Reject if every sentence trips the generic filter — fallback to synthesis.
  const allGeneric = sentences
    .slice(0, 4)
    .every((s) => isGeneric(s.trim()));
  if (allGeneric) return null;

  const subjectName =
    brief.primaryContactProfile?.name?.trim() ||
    brief.attendees?.[0]?.name?.trim() ||
    "this contact";

  return {
    subjectName,
    content: trimmed.length > 700 ? trimmed.slice(0, 697).trimEnd() + "…" : trimmed,
  };
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

// ─── Pickers ────────────────────────────────────────────────────────────

function pickLead(brief: StructuredBrief): string | null {
  const top = brief.executiveProfile?.topOfMind?.trim();
  if (top) {
    const firstSentence = takeSentences(top, 1);
    if (firstSentence && firstSentence.length >= 40 && !isGeneric(firstSentence)) {
      return firstSentence;
    }
  }

  for (const n of brief.newsInsights ?? []) {
    const body = n.body?.trim();
    if (!body) continue;
    const sentence = takeSentences(body, 1);
    if (sentence && sentence.length >= 40 && !isGeneric(sentence)) {
      return sentence;
    }
  }

  const lead = brief.primaryContactProfile?.bullets?.[0];
  if (lead?.label && lead?.detail) {
    const detail = takeSentences(lead.detail, 1);
    if (detail && !isGeneric(detail)) {
      return `${lead.label}. ${detail}`;
    }
  }

  const goal = brief.meetingGoal?.statement?.trim();
  if (goal && !isGenericGoal(goal)) return goal;

  return null;
}

function pickSupporting(brief: StructuredBrief, lead: string | null): string | null {
  for (const n of brief.newsInsights ?? []) {
    const body = n.body?.trim();
    if (!body) continue;
    const sentence = takeSentences(body, 1);
    if (!sentence || isGeneric(sentence)) continue;
    if (lead && substantiallyOverlaps(lead, sentence)) continue;
    return `Thread to pull — ${sentence}`;
  }

  const starter = brief.conversationStarters?.[0];
  if (starter?.question && !isGenericQuestion(starter.question)) {
    return `Open with: "${starter.question.trim()}"`;
  }

  const secondBullet = brief.primaryContactProfile?.bullets?.[1];
  if (secondBullet?.label && secondBullet?.detail) {
    const detail = takeSentences(secondBullet.detail, 1);
    if (detail && !isGeneric(detail)) {
      return `${secondBullet.label}. ${detail}`;
    }
  }

  return null;
}

function pickRelationship(brief: StructuredBrief): string | null {
  const temp = brief.relationshipHistory?.temperature;
  const summary = brief.relationshipHistory?.summary?.trim();
  if (!temp || !summary) return null;
  if (isGenericRelationship(summary)) return null;

  const tempLabel: Record<typeof temp, string> = {
    HOT: "Hot",
    WARM: "Warm",
    COOL: "Cool — worth rewarming",
    COLD: "Cold — treat as first real touch",
  };
  return `${tempLabel[temp]}: ${takeSentences(summary, 1) ?? summary}`;
}

// ─── Generic-content filters ────────────────────────────────────────────

const GENERIC_PHRASES = [
  "strategic priorities",
  "next quarter",
  "ai and digital transformation",
  "biggest opportunities",
  "partner more deeply",
  "specific challenges",
  "current deals",
  "thought partner",
  "trending topics",
  "explore collaboration",
  "strengthen the relationship",
  "regular engagement",
  "strong relationship foundation",
  "limited engagement history",
];

function isGeneric(text: string): boolean {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const phrase of GENERIC_PHRASES) {
    if (lower.includes(phrase)) hits++;
    if (hits >= 2) return true;
  }
  if (hits === 1 && countProperNouns(text) === 0) return true;
  return false;
}

function isGenericGoal(goal: string): boolean {
  const lower = goal.toLowerCase();
  if (/^(review|discuss|explore|strengthen|align)\b/i.test(goal) && countProperNouns(goal) <= 1) {
    return true;
  }
  return GENERIC_PHRASES.some((p) => lower.includes(p)) && countProperNouns(goal) <= 1;
}

function isGenericQuestion(q: string): boolean {
  const lower = q.toLowerCase();
  const patterns = [
    /what (specific )?(challenges|priorities|opportunities) are you/,
    /what are your top (strategic )?priorities/,
    /how (are you|is .* )thinking about (the )?(opportunities in )?(ai|digital transformation)/,
    /where do you see (the biggest )?(opportunities|areas)/,
    /how can we (partner|help|support) (more|better|deeper)/,
    /what's keeping you up at night/,
  ];
  if (patterns.some((p) => p.test(lower))) return true;
  // No proper noun anywhere → generic
  return countProperNouns(q) === 0;
}

function isGenericRelationship(summary: string): boolean {
  const lower = summary.toLowerCase();
  if (GENERIC_PHRASES.some((p) => lower.includes(p))) return true;
  // Substantive relationship summaries reference a number, a date, or a named
  // McKinsey contact — anything specific. If none of those exist, it's filler.
  const hasNumber = /\d/.test(summary);
  const hasNamedContact = /\b[A-Z][a-z]{2,}\b/.test(summary);
  return !hasNumber && !hasNamedContact;
}

// ─── Text utilities ─────────────────────────────────────────────────────

function takeSentences(text: string, n: number): string | null {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  const matches = cleaned.match(/[^.!?]+[.!?]+/g);
  if (!matches || matches.length === 0) {
    return cleaned.length > 200 ? cleaned.slice(0, 197).trimEnd() + "…" : cleaned;
  }
  const joined = matches.slice(0, n).join(" ").trim();
  return joined.length > 240 ? joined.slice(0, 237).trimEnd() + "…" : joined;
}

function countProperNouns(text: string): number {
  // Approximate: capitalized tokens not at sentence start, ignoring stop words.
  const tokens = text.split(/\s+/);
  let count = 0;
  const STOP = new Set(["The", "A", "An", "I", "We", "You", "They", "He", "She", "It", "Where", "What", "How", "When", "Why", "Who", "Open", "Thread"]);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].replace(/[^A-Za-z']/g, "");
    if (!t) continue;
    if (i === 0) continue; // sentence-initial capital is ambiguous
    if (STOP.has(t)) continue;
    if (/^[A-Z][a-z]+/.test(t)) count++;
    if (/^[A-Z]{2,}/.test(t)) count++; // acronyms (AI, CEO, DOJ)
  }
  return count;
}

function substantiallyOverlaps(a: string, b: string): boolean {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().split(/\W+/).filter((t) => t.length >= 5));
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size) >= 0.6;
}

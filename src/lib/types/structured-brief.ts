// src/lib/types/structured-brief.ts

export interface StructuredBrief {
  version: 1;

  meetingGoal: {
    statement: string;
    successCriteria: string;
  };

  primaryContactProfile: {
    name: string;
    bullets: Array<{
      label: string;
      detail: string;
    }>;
    emptyReason?: string;
  };

  conversationStarters: Array<{
    question: string;
    tacticalNote: string;
  }>;

  newsInsights: Array<{
    headline: string;
    body: string;
  }>;
  newsEmptyReason?: string;

  executiveProfile: {
    bioSummary: string;
    recentMoves: Array<{
      date: string;
      description: string;
    }>;
    patternCallout?: string;
  };

  relationshipHistory: {
    temperature: "COLD" | "COOL" | "WARM" | "HOT";
    summary: string;
    engagements: Array<{
      period: string;
      description: string;
    }>;
  };

  attendees: Array<{
    name: string;
    title: string;
    initials: string;
  }>;
}

const VALID_TEMPERATURES = new Set(["COLD", "COOL", "WARM", "HOT"]);

function isValidStructuredBrief(p: Record<string, unknown>): boolean {
  if (p.version !== 1) return false;

  const goal = p.meetingGoal as Record<string, unknown> | undefined;
  if (!goal || typeof goal !== "object") return false;
  if (typeof goal.statement !== "string") return false;

  const contact = p.primaryContactProfile as Record<string, unknown> | undefined;
  if (!contact || typeof contact !== "object") return false;
  if (!Array.isArray(contact.bullets)) return false;

  if (!Array.isArray(p.conversationStarters)) return false;
  if (!Array.isArray(p.newsInsights)) return false;

  const exec = p.executiveProfile as Record<string, unknown> | undefined;
  if (!exec || typeof exec !== "object") return false;

  const rel = p.relationshipHistory as Record<string, unknown> | undefined;
  if (!rel || typeof rel !== "object") return false;
  if (typeof rel.temperature !== "string" || !VALID_TEMPERATURES.has(rel.temperature)) return false;

  if (!Array.isArray(p.attendees)) return false;

  return true;
}

export function parseStructuredBrief(raw: string | null): StructuredBrief | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    if (!isValidStructuredBrief(parsed)) return null;
    return parsed as StructuredBrief;
  } catch {
    return null;
  }
}

export function formatBriefAsText(brief: StructuredBrief): string {
  const lines: string[] = [];

  lines.push("MEETING GOAL");
  lines.push(brief.meetingGoal.statement);
  lines.push(`Success = ${brief.meetingGoal.successCriteria}`);
  lines.push("");

  lines.push(`${brief.primaryContactProfile.name.toUpperCase()} IN 3 BULLETS`);
  for (const b of brief.primaryContactProfile.bullets) {
    lines.push(`• ${b.label}. ${b.detail}`);
  }
  if (brief.primaryContactProfile.emptyReason) {
    lines.push(brief.primaryContactProfile.emptyReason);
  }
  lines.push("");

  lines.push("CONVERSATION STARTERS");
  for (let i = 0; i < brief.conversationStarters.length; i++) {
    const s = brief.conversationStarters[i];
    lines.push(`${i + 1}. "${s.question}"`);
    lines.push(`   → ${s.tacticalNote}`);
  }
  lines.push("");

  if (brief.newsInsights.length > 0) {
    lines.push("NEWS INSIGHTS");
    for (const n of brief.newsInsights) {
      lines.push(`${n.headline}`);
      lines.push(n.body);
      lines.push("");
    }
  } else if (brief.newsEmptyReason) {
    lines.push("NEWS INSIGHTS");
    lines.push(brief.newsEmptyReason);
    lines.push("");
  }

  if (brief.executiveProfile.bioSummary) {
    lines.push("EXECUTIVE PROFILE");
    lines.push(brief.executiveProfile.bioSummary);
    if (brief.executiveProfile.recentMoves.length > 0) {
      lines.push("");
      lines.push("Recent Moves:");
      for (const m of brief.executiveProfile.recentMoves) {
        lines.push(`• ${m.date}: ${m.description}`);
      }
    }
    if (brief.executiveProfile.patternCallout) {
      lines.push("");
      lines.push(`Pattern: ${brief.executiveProfile.patternCallout}`);
    }
    lines.push("");
  }

  lines.push(`RELATIONSHIP: ${brief.relationshipHistory.temperature}`);
  lines.push(brief.relationshipHistory.summary);
  if (brief.relationshipHistory.engagements.length > 0) {
    for (const e of brief.relationshipHistory.engagements) {
      lines.push(`• ${e.period}: ${e.description}`);
    }
  }
  lines.push("");

  if (brief.attendees.length > 0) {
    lines.push("ATTENDEES");
    for (const a of brief.attendees) {
      lines.push(`• ${a.name} — ${a.title}`);
    }
  }

  return lines.join("\n");
}

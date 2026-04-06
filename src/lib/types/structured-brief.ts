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

export function parseStructuredBrief(raw: string | null): StructuredBrief | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1 && parsed?.meetingGoal) return parsed as StructuredBrief;
    return null;
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

  return lines.join("\n");
}

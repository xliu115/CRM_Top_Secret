import { callLLM, callLLMWithWebSearch } from "./llm-core";
import { format } from "date-fns";

// ── Types ───────────────────────────────────────────────────────────

export interface Company360Section {
  id: string;
  title: string;
  content: string;
}

export interface Company360Result {
  summary: string;
  sections: Company360Section[];
}

export interface Company360ContactSummary {
  name: string;
  title: string;
  importance: string;
  interactionCount: number;
  lastInteractionDate: string | null;
  sentiment: string | null;
  openNudges: number;
}

export interface Company360PartnerCoverage {
  partnerName: string;
  isCurrentUser: boolean;
  contactCount: number;
  totalInteractions: number;
  lastInteractionDate: string | null;
}

// ── Structured data types (returned directly, not LLM-generated) ──

export interface FirmCoverageData {
  totalPartners: number;
  totalContacts: number;
  partners: Company360PartnerCoverage[];
}

export type IntensityLevel = "Very High" | "High" | "Medium" | "Light" | "Cold";

export interface HealthMatrixEntry {
  name: string;
  title: string;
  importance: string;
  interactionCount: number;
  lastInteractionDate: string | null;
  daysSinceLastInteraction: number | null;
  intensity: IntensityLevel;
  intensityScore: number;
  sentiment: string | null;
  openNudges: number;
  contactId: string;
}

export function computeIntensity(
  interactionCount: number,
  daysSinceLastInteraction: number | null,
): { level: IntensityLevel; score: number } {
  if (daysSinceLastInteraction === null) return { level: "Cold", score: 0 };
  let recencyScore = 0;
  if (daysSinceLastInteraction <= 14) recencyScore = 40;
  else if (daysSinceLastInteraction <= 30) recencyScore = 30;
  else if (daysSinceLastInteraction <= 60) recencyScore = 20;
  else if (daysSinceLastInteraction <= 90) recencyScore = 10;
  let frequencyScore = 0;
  if (interactionCount >= 10) frequencyScore = 60;
  else if (interactionCount >= 7) frequencyScore = 45;
  else if (interactionCount >= 4) frequencyScore = 30;
  else if (interactionCount >= 2) frequencyScore = 15;
  else if (interactionCount >= 1) frequencyScore = 5;
  const score = recencyScore + frequencyScore;
  let level: IntensityLevel;
  if (score >= 70) level = "Very High";
  else if (score >= 45) level = "High";
  else if (score >= 20) level = "Medium";
  else if (score > 0) level = "Light";
  else level = "Cold";
  return { level, score };
}

export interface Company360Context {
  company: {
    name: string;
    industry: string;
    description: string;
    employeeCount: number;
    website: string;
  };
  contacts: Company360ContactSummary[];
  partners: Company360PartnerCoverage[];
  signals: {
    type: string;
    date: string;
    content: string;
    url: string | null;
  }[];
  meetings: {
    title: string;
    date: string;
    attendees: string[];
    contactName: string;
  }[];
  sequences: {
    contactName: string;
    status: string;
    currentStep: number;
    totalSteps: number;
  }[];
  webNews: { title: string; content: string; url: string }[];
}

// ── System Prompt ───────────────────────────────────────────────────

const COMPANY360_SYSTEM_PROMPT = `You are a senior intelligence analyst preparing a company-level relationship dossier for a consulting Partner preparing for a quarterly business review. Tone: crisp, strategic, actionable.

Rules:
- Write each section as 2-4 sentences of flowing prose. NO bullet points.
- Use **bold** for names, companies, dates, key numbers.
- Strategic recommendations should be specific and actionable.
- Do NOT include Firm Coverage or Relationship Health — those are shown as structured data separately.

Output format:
<one-line summary: company position + most important relationship insight>
---SECTIONS---
[
  {"id":"overview","title":"Company Overview","content":"..."},
  {"id":"recommendations","title":"Strategic Recommendations","content":"..."}
]`;

// ── Generate Company 360 ────────────────────────────────────────────

export async function generateCompany360(
  ctx: Company360Context
): Promise<Company360Result> {
  const userPrompt = buildCompany360Prompt(ctx);
  const result = await callLLM(COMPANY360_SYSTEM_PROMPT, userPrompt);

  if (result) {
    const parsed = parseCompany360Response(result);
    if (parsed) return parsed;
  }

  return generateCompany360Template(ctx);
}

function parseCompany360Response(raw: string): Company360Result | null {
  try {
    const parts = raw.split("---SECTIONS---");
    const summary = parts[0]?.trim();
    if (!summary || !parts[1]) return null;

    const jsonStr = parts[1].trim().replace(/```json\n?|\n?```/g, "").trim();
    const sections: Company360Section[] = JSON.parse(jsonStr);

    if (!Array.isArray(sections) || sections.length < 2) return null;

    return { summary, sections };
  } catch {
    return null;
  }
}

// ── Prompt Builder ──────────────────────────────────────────────────

function buildCompany360Prompt(ctx: Company360Context): string {
  const lines: string[] = [];

  lines.push(`## Company: ${ctx.company.name}`);
  lines.push(`Industry: ${ctx.company.industry} | Employees: ~${ctx.company.employeeCount} | Website: ${ctx.company.website}`);
  if (ctx.company.description) lines.push(`Description: ${ctx.company.description}`);

  lines.push(`\n## Contacts at ${ctx.company.name} (${ctx.contacts.length})`);
  for (const c of ctx.contacts) {
    const lastStr = c.lastInteractionDate
      ? format(new Date(c.lastInteractionDate), "MMM d, yyyy")
      : "never";
    lines.push(`- ${c.name} (${c.title}, ${c.importance}) — ${c.interactionCount} interactions, last: ${lastStr}, ${c.openNudges} open nudges${c.sentiment ? `, sentiment: ${c.sentiment}` : ""}`);
  }

  lines.push(`\n## Partner Coverage (${ctx.partners.length} partners)`);
  for (const p of ctx.partners) {
    const tag = p.isCurrentUser ? " (you)" : "";
    lines.push(`- ${p.partnerName}${tag}: ${p.contactCount} contacts, ${p.totalInteractions} interactions, last: ${p.lastInteractionDate ? format(new Date(p.lastInteractionDate), "MMM d") : "never"}`);
  }

  if (ctx.signals.length > 0) {
    lines.push(`\n## Signals (${ctx.signals.length})`);
    for (const s of ctx.signals.slice(0, 10)) {
      lines.push(`- ${s.date} | ${s.type}: ${s.content.slice(0, 200)}`);
    }
  }

  if (ctx.meetings.length > 0) {
    lines.push(`\n## Recent/Upcoming Meetings (${ctx.meetings.length})`);
    for (const m of ctx.meetings.slice(0, 5)) {
      lines.push(`- ${m.date} | "${m.title}" with ${m.attendees.join(", ")} (re: ${m.contactName})`);
    }
  }

  if (ctx.sequences.length > 0) {
    lines.push(`\n## Active Sequences (${ctx.sequences.length})`);
    for (const s of ctx.sequences) {
      lines.push(`- ${s.contactName}: ${s.status} step ${s.currentStep}/${s.totalSteps}`);
    }
  }

  if (ctx.webNews.length > 0) {
    lines.push("\n## Recent Web News");
    for (const n of ctx.webNews) {
      lines.push(`- ${n.title}: ${n.content.slice(0, 300)}`);
    }
  }

  return lines.join("\n");
}

// ── Template Fallback ───────────────────────────────────────────────

export function generateCompany360Template(
  ctx: Company360Context
): Company360Result {
  const sections: Company360Section[] = [];

  // Section 1: Company Overview
  sections.push({
    id: "overview",
    title: "Company Overview",
    content: `**${ctx.company.name}** operates in the ${ctx.company.industry} sector with approximately **${ctx.company.employeeCount} employees**. ${ctx.company.description || `Website: ${ctx.company.website}`}. Your firm has relationships with **${ctx.contacts.length} contact${ctx.contacts.length !== 1 ? "s" : ""}** at this company.`,
  });

  // Section 2: Strategic Recommendations
  const recs: string[] = [];
  const coldContacts = ctx.contacts.filter((c) => c.interactionCount === 0 || !c.lastInteractionDate);
  if (coldContacts.length > 0) {
    recs.push(`**${coldContacts.length} contact${coldContacts.length !== 1 ? "s have" : " has"} no recent activity** — consider proactive outreach to ${coldContacts[0].name}`);
  }
  const totalNudges = ctx.contacts.reduce((sum, c) => sum + c.openNudges, 0);
  if (totalNudges > 0) {
    recs.push(`**${totalNudges} open nudge${totalNudges !== 1 ? "s" : ""}** across contacts at ${ctx.company.name} — prioritize high-importance contacts first`);
  }
  if (ctx.partners.length === 1) {
    recs.push(`Only **1 partner** covers this account — consider expanding firm-wide coverage to reduce concentration risk`);
  }
  sections.push({
    id: "recommendations",
    title: "Strategic Recommendations",
    content: recs.length > 0 ? recs.join(". ") + "." : `${ctx.company.name} relationships appear healthy. Continue regular engagement.`,
  });

  const summary = `${ctx.company.name} (${ctx.company.industry}) — ${ctx.contacts.length} contacts tracked across ${ctx.partners.length} partner${ctx.partners.length !== 1 ? "s" : ""}.`;

  return { summary, sections };
}

// ── Mini Financial Snapshot (for chat) ─────────────────────────────

const MINI_FINANCIAL_PROMPT = `You are a financial analyst writing a 3-4 sentence snapshot for a consulting Partner. Be concise and data-driven.

Cover:
- Latest quarterly revenue/earnings and YoY change
- Current stock price and YTD performance (if publicly traded)
- One notable recent development (M&A, product launch, leadership change)

Rules:
- 3-4 sentences MAX. Flowing prose, no bullet points, no headings, no subheadings.
- **Bold** key numbers, percentages, and names.
- If the company is private, focus on funding, valuation, and growth signals instead.
- If you cannot find reliable financial data, say so briefly rather than guessing.
- Output ONLY the paragraph. Do NOT include any titles, headers, stock info blocks, disclaimers, or metadata.`;

export interface MiniFinancialSnapshot {
  content: string;
  sources: { title: string; url: string }[];
}

export async function generateMiniFinancialSnapshot(
  companyName: string,
  industry: string,
): Promise<MiniFinancialSnapshot | null> {
  const userPrompt = `Write a mini financial snapshot for **${companyName}** (${industry || "unknown industry"}). Include the latest available financial data.`;

  const result = await callLLMWithWebSearch(MINI_FINANCIAL_PROMPT, userPrompt, {
    maxOutputTokens: 400,
  });

  if (!result?.text) return null;

  // Strip any leaked headings/sections from web search artifacts
  let content = result.text.trim();
  const firstHeading = content.search(/^#{1,4}\s/m);
  if (firstHeading > 0) {
    content = content.slice(0, firstHeading).trim();
  }

  if (!content) return null;

  return {
    content,
    sources: result.citations.slice(0, 5),
  };
}

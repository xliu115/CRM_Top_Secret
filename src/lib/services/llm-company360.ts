import { callLLM } from "./llm-core";
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
- For the coverage map, highlight coordination gaps and opportunities.
- For health matrix, be honest: "cold" relationships are flagged, not hidden.
- Strategic recommendations should be specific and actionable.

Output format:
<one-line summary: company position + most important relationship insight>
---SECTIONS---
[
  {"id":"overview","title":"Company Overview","content":"..."},
  {"id":"coverage","title":"Firm Coverage Map","content":"..."},
  {"id":"health","title":"Relationship Health Matrix","content":"..."},
  {"id":"signals","title":"Signals and News","content":"..."},
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

    if (!Array.isArray(sections) || sections.length < 4) return null;

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

  // Section 2: Firm Coverage Map
  if (ctx.partners.length > 0) {
    const partnerLines = ctx.partners.map((p) => {
      const tag = p.isCurrentUser ? " (you)" : "";
      return `**${p.partnerName}**${tag} covers ${p.contactCount} contact${p.contactCount !== 1 ? "s" : ""} with ${p.totalInteractions} interactions`;
    });
    sections.push({
      id: "coverage",
      title: "Firm Coverage Map",
      content: `**${ctx.partners.length} partner${ctx.partners.length !== 1 ? "s"  : ""}** at the firm have relationships at ${ctx.company.name}. ${partnerLines.join(". ")}.`,
    });
  } else {
    sections.push({
      id: "coverage",
      title: "Firm Coverage Map",
      content: `No partner coverage data available for ${ctx.company.name}.`,
    });
  }

  // Section 3: Relationship Health Matrix
  if (ctx.contacts.length > 0) {
    const contactLines = ctx.contacts.map((c) => {
      const status = c.interactionCount === 0
        ? "no activity"
        : c.lastInteractionDate
          ? `last contact ${format(new Date(c.lastInteractionDate), "MMM d")}`
          : "unknown activity";
      return `**${c.name}** (${c.title}, ${c.importance}): ${c.interactionCount} interactions, ${status}`;
    });
    sections.push({
      id: "health",
      title: "Relationship Health Matrix",
      content: contactLines.join(". ") + ".",
    });
  } else {
    sections.push({
      id: "health",
      title: "Relationship Health Matrix",
      content: "No contacts tracked at this company yet.",
    });
  }

  // Section 4: Signals and News
  const signalParts: string[] = [];
  if (ctx.signals.length > 0) {
    signalParts.push(`**${ctx.signals.length} signal${ctx.signals.length !== 1 ? "s" : ""}**: ${ctx.signals.slice(0, 3).map((s) => s.content.slice(0, 100)).join("; ")}`);
  }
  if (ctx.webNews.length > 0) {
    signalParts.push(`**Web news**: ${ctx.webNews.slice(0, 2).map((n) => n.content.slice(0, 120)).join("; ")}`);
  }
  sections.push({
    id: "signals",
    title: "Signals and News",
    content: signalParts.length > 0 ? signalParts.join(". ") : `No recent signals or news for ${ctx.company.name}.`,
  });

  // Section 5: Strategic Recommendations
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

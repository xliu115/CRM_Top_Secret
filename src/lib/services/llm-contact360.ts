import { callLLM } from "./llm-core";
import { differenceInDays, format } from "date-fns";

// ── Types ───────────────────────────────────────────────────────────

export interface Contact360Section {
  id: string;
  title: string;
  content: string;
}

export interface Contact360Result {
  summary: string;
  sections: Contact360Section[];
  talkingPoints: string[];
}

export interface Contact360Context {
  contact: {
    name: string;
    title: string;
    email: string;
    importance: string;
    notes: string | null;
  };
  company: {
    name: string;
    industry: string;
    employeeCount: number;
    website: string;
  };
  interactions: {
    type: string;
    date: string;
    summary: string;
    sentiment: string;
    direction?: string;
  }[];
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
    purpose: string | null;
    briefExcerpt: string | null;
  }[];
  nudges: {
    ruleType: string;
    reason: string;
    priority: string;
  }[];
  sequences: {
    status: string;
    currentStep: number;
    totalSteps: number;
    angleStrategy: string | null;
  }[];
  firmRelationships: {
    partnerName: string;
    isCurrentUser: boolean;
    interactionCount: number;
    intensity: string;
    lastInteractionDate: string | null;
    contactsAtCompany: number;
  }[];
  webBackground: { title: string; content: string; url: string }[];
  webNews: { title: string; content: string; url: string }[];
  engagements: { type: string; name: string; date: string }[];
}

// ── System Prompts ──────────────────────────────────────────────────

const CONTACT360_SYSTEM_PROMPT = `You are a senior intelligence analyst preparing a 360-degree contact dossier for a consulting Partner. Tone: crisp, specific, strategic — like a briefing from a trusted chief of staff.

Rules:
- Write each section as 2-4 sentences of flowing prose. NO bullet points.
- Use **bold** for names, companies, dates, key numbers.
- Synthesize web background naturally — don't list search results.
- If web background unavailable, focus on CRM data.
- For the firm-wide section, highlight overlap and coordination opportunities.
- Be honest about gaps: "No recent interactions" is better than fabricating.
- Section 7 (Talking Points): 3 specific conversation starters combining news + shared context + relationship history. Each should be 1-2 sentences that the Partner could literally say in a meeting.
- End recommendations with 2-3 specific, actionable next steps.

Output format:
<one-line summary: who they are and the single most important thing to know>
---SECTIONS---
[
  {"id":"profile","title":"Person Profile","content":"..."},
  {"id":"relationship","title":"Relationship Overview","content":"..."},
  {"id":"timeline","title":"Communication Timeline","content":"..."},
  {"id":"firm","title":"Firm-Wide Connections","content":"..."},
  {"id":"signals","title":"News and Signals","content":"..."},
  {"id":"actions","title":"Open Threads and Recommendations","content":"..."},
  {"id":"talking_points","title":"Talking Points","content":"1. ...\\n2. ...\\n3. ..."}
]`;

const MINI360_SYSTEM_PROMPT = `You are preparing a quick intelligence snippet for a morning briefing email. 3 concise sections, each 1-2 sentences max. Total under 150 words. Use **bold** for key names and numbers.

Output format:
<one-line summary>
---SECTIONS---
[
  {"id":"profile","title":"Person Profile","content":"..."},
  {"id":"firm","title":"Firm Connections","content":"..."},
  {"id":"signals","title":"Key Signals","content":"..."}
]`;

const QUICK360_SYSTEM_PROMPT = `You are a senior intelligence analyst briefing a consulting Partner before a meeting. Write a concise, strategic insight summary followed by actionable talking points. Tone: like a trusted chief of staff — crisp, specific, strategic. NO bullet points in the insight summary.

Rules:
- Insight Summary: 3-5 sentences synthesizing who this person is, the state of the relationship, key signals/news, and what matters right now. Use **bold** for names, companies, dates, key numbers.
- Talking Points: Exactly 3 specific, natural conversation starters that combine news + shared context + relationship history. Each should be 1-2 sentences the Partner could literally say in a meeting.
- Be honest about gaps — "No recent interactions" is better than fabricating.

Output format:
---INSIGHT---
<insight paragraph>
---TALKING_POINTS---
1. <talking point>
2. <talking point>
3. <talking point>`;

// ── Contact 360 (full 7-section dossier) ────────────────────────────

export async function generateContact360(
  ctx: Contact360Context
): Promise<Contact360Result> {
  const userPrompt = buildContact360Prompt(ctx);
  const result = await callLLM(CONTACT360_SYSTEM_PROMPT, userPrompt);

  if (result) {
    const parsed = parseContact360Response(result);
    if (parsed) return parsed;
  }

  return generateContact360Template(ctx);
}

function parseContact360Response(raw: string): Contact360Result | null {
  try {
    const parts = raw.split("---SECTIONS---");
    const summary = parts[0]?.trim();
    if (!summary || !parts[1]) return null;

    const jsonStr = parts[1].trim().replace(/```json\n?|\n?```/g, "").trim();
    const sections: Contact360Section[] = JSON.parse(jsonStr);

    if (!Array.isArray(sections) || sections.length < 6) return null;

    const talkingPoints = extractTalkingPoints(sections);

    return { summary, sections, talkingPoints };
  } catch {
    return null;
  }
}

function extractTalkingPoints(sections: Contact360Section[]): string[] {
  const tpSection = sections.find((s) => s.id === "talking_points");
  if (!tpSection) return [];

  return tpSection.content
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);
}

// ── Mini 360 (3-section briefing variant) ───────────────────────────

export async function generateMini360(
  ctx: Contact360Context
): Promise<Contact360Result> {
  const userPrompt = buildMini360Prompt(ctx);
  const result = await callLLM(MINI360_SYSTEM_PROMPT, userPrompt);

  if (result) {
    const parsed = parseContact360Response(result);
    if (parsed) return parsed;
  }

  return generateMini360Template(ctx);
}

// ── Quick 360 (insight + talking points for chat) ────────────────────

export interface Quick360Result {
  contactName: string;
  title: string;
  companyName: string;
  insight: string;
  talkingPoints: string[];
}

export async function generateQuick360(
  ctx: Contact360Context
): Promise<Quick360Result> {
  const userPrompt = buildContact360Prompt(ctx);
  const result = await callLLM(QUICK360_SYSTEM_PROMPT, userPrompt);

  const base = {
    contactName: ctx.contact.name,
    title: ctx.contact.title,
    companyName: ctx.company.name,
  };

  if (result) {
    const parsed = parseQuick360Response(result);
    if (parsed) return { ...base, ...parsed };
  }

  return generateQuick360Template(ctx);
}

function parseQuick360Response(raw: string): { insight: string; talkingPoints: string[] } | null {
  try {
    const insightMatch = raw.match(/---INSIGHT---\s*([\s\S]*?)(?=---TALKING_POINTS---|$)/);
    const tpMatch = raw.match(/---TALKING_POINTS---\s*([\s\S]*)/);

    const insight = insightMatch?.[1]?.trim();
    if (!insight) return null;

    const talkingPoints = (tpMatch?.[1] ?? "")
      .split("\n")
      .map((line) => line.replace(/^\d+\.\s*/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 3);

    return { insight, talkingPoints };
  } catch {
    return null;
  }
}

function generateQuick360Template(ctx: Contact360Context): Quick360Result {
  const now = new Date();
  const lastInteraction = ctx.interactions[0];
  const daysSince = lastInteraction
    ? differenceInDays(now, new Date(lastInteraction.date))
    : null;

  const parts: string[] = [];
  parts.push(`**${ctx.contact.name}** is ${ctx.contact.title} at **${ctx.company.name}**${ctx.company.industry ? ` (${ctx.company.industry})` : ""}.`);

  if (daysSince !== null) {
    parts.push(`Your last interaction was **${daysSince} days ago** via ${lastInteraction.type.toLowerCase()}${lastInteraction.summary ? `: "${lastInteraction.summary.slice(0, 80)}"` : ""}.`);
  } else {
    parts.push("No interactions recorded yet — this is a new or untracked relationship.");
  }

  if (ctx.firmRelationships.length > 1) {
    const others = ctx.firmRelationships.filter((r) => !r.isCurrentUser);
    parts.push(`${others.length} other partner${others.length !== 1 ? "s" : ""} at the firm also know this contact: ${others.map((r) => `**${r.partnerName}** (${r.intensity})`).join(", ")}.`);
  }

  if (ctx.signals.length > 0 || ctx.webNews.length > 0) {
    const newsItem = ctx.webNews[0] ?? ctx.signals[0];
    if (newsItem) {
      const content = "content" in newsItem ? newsItem.content : "";
      parts.push(`Recent signal: ${content.slice(0, 120)}.`);
    }
  }

  const tp: string[] = [];
  if (ctx.webNews.length > 0) {
    tp.push(`I saw the news about "${ctx.webNews[0].content.slice(0, 80)}..." — how is that affecting your team?`);
  }
  if (ctx.meetings.length > 0) {
    tp.push(`Looking forward to "${ctx.meetings[0].title}" — what's top of mind for you going in?`);
  }
  if (ctx.firmRelationships.length > 1) {
    const other = ctx.firmRelationships.find((r) => !r.isCurrentUser);
    if (other) {
      tp.push(`My colleague ${other.partnerName} mentioned your work together — I'd love to hear your perspective on the broader engagement.`);
    }
  }
  if (tp.length === 0) {
    tp.push(`What are your biggest priorities at ${ctx.company.name} right now?`);
    tp.push(`How have things evolved since we last connected?`);
  }

  return {
    contactName: ctx.contact.name,
    title: ctx.contact.title,
    companyName: ctx.company.name,
    insight: parts.join(" "),
    talkingPoints: tp.slice(0, 3),
  };
}

// ── Prompt Builders ─────────────────────────────────────────────────

function buildContact360Prompt(ctx: Contact360Context): string {
  const lines: string[] = [];

  lines.push(`## Contact: ${ctx.contact.name}`);
  lines.push(`Title: ${ctx.contact.title} | Email: ${ctx.contact.email}`);
  lines.push(`Company: ${ctx.company.name} (${ctx.company.industry}, ~${ctx.company.employeeCount} employees)`);
  lines.push(`Importance: ${ctx.contact.importance}`);
  if (ctx.contact.notes) lines.push(`Notes: ${ctx.contact.notes}`);

  if (ctx.interactions.length > 0) {
    lines.push(`\n## Recent Interactions (last ${ctx.interactions.length})`);
    for (const i of ctx.interactions.slice(0, 15)) {
      const dir = i.direction ? ` [${i.direction}]` : "";
      lines.push(`- ${i.date} | ${i.type}${dir} | ${i.sentiment} | ${i.summary}`);
    }
  } else {
    lines.push("\n## Interactions: None recorded");
  }

  if (ctx.signals.length > 0) {
    const grouped = groupBy(ctx.signals, (s) => s.type);
    lines.push("\n## Signals");
    for (const [type, items] of Object.entries(grouped)) {
      lines.push(`### ${type} (${items.length})`);
      for (const s of items.slice(0, 5)) {
        lines.push(`- ${s.date} | ${s.content.slice(0, 200)}${s.url ? ` (${s.url})` : ""}`);
      }
    }
  }

  if (ctx.meetings.length > 0) {
    lines.push(`\n## Meetings (${ctx.meetings.length})`);
    for (const m of ctx.meetings.slice(0, 5)) {
      lines.push(`- ${m.date} | "${m.title}" with ${m.attendees.join(", ")}${m.purpose ? ` — ${m.purpose}` : ""}`);
    }
  }

  if (ctx.nudges.length > 0) {
    lines.push(`\n## Open Nudges (${ctx.nudges.length})`);
    for (const n of ctx.nudges) {
      lines.push(`- [${n.priority}] ${n.ruleType}: ${n.reason}`);
    }
  }

  if (ctx.sequences.length > 0) {
    lines.push(`\n## Active Sequences (${ctx.sequences.length})`);
    for (const s of ctx.sequences) {
      lines.push(`- ${s.status} | Step ${s.currentStep}/${s.totalSteps}${s.angleStrategy ? ` | ${s.angleStrategy}` : ""}`);
    }
  }

  if (ctx.firmRelationships.length > 0) {
    lines.push(`\n## Firm-Wide Relationships (${ctx.firmRelationships.length} partners)`);
    for (const r of ctx.firmRelationships) {
      const tag = r.isCurrentUser ? " (you)" : "";
      lines.push(`- ${r.partnerName}${tag}: ${r.interactionCount} interactions, ${r.intensity} intensity, last: ${r.lastInteractionDate ?? "never"}, ${r.contactsAtCompany} contacts at company`);
    }
  }

  if (ctx.webBackground.length > 0) {
    lines.push("\n## Web Background");
    for (const w of ctx.webBackground) {
      lines.push(`- ${w.title}: ${w.content.slice(0, 300)}`);
    }
  }

  if (ctx.webNews.length > 0) {
    lines.push("\n## Recent News (web)");
    for (const w of ctx.webNews) {
      lines.push(`- ${w.title}: ${w.content.slice(0, 300)}`);
    }
  }

  if (ctx.engagements.length > 0) {
    lines.push(`\n## Engagements (${ctx.engagements.length})`);
    for (const e of ctx.engagements.slice(0, 10)) {
      lines.push(`- ${e.date} | ${e.type}: ${e.name}`);
    }
  }

  return lines.join("\n");
}

function buildMini360Prompt(ctx: Contact360Context): string {
  const lines: string[] = [];

  lines.push(`Contact: ${ctx.contact.name}, ${ctx.contact.title} at ${ctx.company.name}`);
  lines.push(`Importance: ${ctx.contact.importance}`);

  if (ctx.interactions.length > 0) {
    const last = ctx.interactions[0];
    lines.push(`Last interaction: ${last.date} (${last.type}) — ${last.summary}`);
  }

  if (ctx.firmRelationships.length > 1) {
    const others = ctx.firmRelationships.filter((r) => !r.isCurrentUser);
    lines.push(`Other partners: ${others.map((r) => `${r.partnerName} (${r.intensity})`).join(", ")}`);
  }

  if (ctx.signals.length > 0) {
    lines.push(`Signals: ${ctx.signals.slice(0, 3).map((s) => `${s.type}: ${s.content.slice(0, 100)}`).join("; ")}`);
  }

  if (ctx.webNews.length > 0) {
    lines.push(`News: ${ctx.webNews[0].content.slice(0, 150)}`);
  }

  return lines.join("\n");
}

// ── Template Fallbacks ──────────────────────────────────────────────

export function generateContact360Template(
  ctx: Contact360Context
): Contact360Result {
  const now = new Date();
  const sections: Contact360Section[] = [];

  // Section 1: Profile
  const webBg = ctx.webBackground.length > 0
    ? ` ${ctx.webBackground.map((w) => w.content.slice(0, 150)).join(". ")}`
    : "";
  sections.push({
    id: "profile",
    title: "Person Profile",
    content: `**${ctx.contact.name}** is ${ctx.contact.title} at **${ctx.company.name}** (${ctx.company.industry}, ~${ctx.company.employeeCount} employees). Classified as ${ctx.contact.importance} importance.${webBg}${ctx.contact.notes ? ` Notes: ${ctx.contact.notes}` : ""}`,
  });

  // Section 2: Relationship Overview
  const totalInteractions = ctx.interactions.length;
  const firstDate = ctx.interactions.length > 0
    ? ctx.interactions[ctx.interactions.length - 1].date
    : null;
  const lastDate = ctx.interactions.length > 0 ? ctx.interactions[0].date : null;
  const daysSinceLast = lastDate
    ? differenceInDays(now, new Date(lastDate))
    : null;
  sections.push({
    id: "relationship",
    title: "Relationship Overview",
    content: totalInteractions > 0
      ? `You have **${totalInteractions} recorded interactions** with ${ctx.contact.name}${firstDate ? `, first contact on **${format(new Date(firstDate), "MMM d, yyyy")}**` : ""}. Last contact was ${daysSinceLast !== null ? `**${daysSinceLast} days ago**` : "unknown"} on ${lastDate ? format(new Date(lastDate), "MMM d, yyyy") : "unknown"}.`
      : `No interactions recorded yet with ${ctx.contact.name}. This is a new or untracked relationship.`,
  });

  // Section 3: Communication Timeline
  if (ctx.interactions.length > 0) {
    const timeline = ctx.interactions.slice(0, 8).map((i) => {
      const d = format(new Date(i.date), "MMM d, yyyy");
      return `**${d}** — ${i.type}${i.direction ? ` (${i.direction})` : ""}: ${i.summary} [${i.sentiment}]`;
    });
    sections.push({
      id: "timeline",
      title: "Communication Timeline",
      content: timeline.join(". "),
    });
  } else {
    sections.push({
      id: "timeline",
      title: "Communication Timeline",
      content: "No communication history available.",
    });
  }

  // Section 4: Firm-Wide Connections
  if (ctx.firmRelationships.length > 1) {
    const others = ctx.firmRelationships.filter((r) => !r.isCurrentUser);
    const firmLines = others.map(
      (r) => `**${r.partnerName}** has ${r.interactionCount} interactions (${r.intensity} intensity, last: ${r.lastInteractionDate ? format(new Date(r.lastInteractionDate), "MMM d") : "never"}, ${r.contactsAtCompany} contacts at ${ctx.company.name})`
    );
    sections.push({
      id: "firm",
      title: "Firm-Wide Connections",
      content: `${ctx.firmRelationships.length} partners at the firm know ${ctx.contact.name}. ${firmLines.join(". ")}.`,
    });
  } else {
    sections.push({
      id: "firm",
      title: "Firm-Wide Connections",
      content: `You appear to be the only partner at the firm with a recorded relationship with ${ctx.contact.name} at ${ctx.company.name}.`,
    });
  }

  // Section 5: News and Signals
  const signalParts: string[] = [];
  if (ctx.signals.length > 0) {
    const grouped = groupBy(ctx.signals, (s) => s.type);
    for (const [type, items] of Object.entries(grouped)) {
      signalParts.push(`**${type}**: ${items.slice(0, 2).map((s) => s.content.slice(0, 120)).join("; ")}`);
    }
  }
  if (ctx.webNews.length > 0) {
    signalParts.push(`**Recent web news**: ${ctx.webNews.map((n) => n.content.slice(0, 120)).join("; ")}`);
  }
  sections.push({
    id: "signals",
    title: "News and Signals",
    content: signalParts.length > 0
      ? signalParts.join(". ")
      : "No recent signals or news for this contact or company.",
  });

  // Section 6: Open Threads and Recommendations
  const actionParts: string[] = [];
  if (ctx.nudges.length > 0) {
    actionParts.push(`**${ctx.nudges.length} open nudge${ctx.nudges.length !== 1 ? "s" : ""}**: ${ctx.nudges.map((n) => `${n.ruleType} (${n.priority}): ${n.reason}`).join("; ")}`);
  }
  if (ctx.sequences.length > 0) {
    actionParts.push(`**${ctx.sequences.length} active sequence${ctx.sequences.length !== 1 ? "s" : ""}**: Step ${ctx.sequences[0].currentStep}/${ctx.sequences[0].totalSteps}`);
  }
  if (ctx.meetings.length > 0) {
    actionParts.push(`**Upcoming meeting**: "${ctx.meetings[0].title}" on ${format(new Date(ctx.meetings[0].date), "MMM d")}`);
  }
  sections.push({
    id: "actions",
    title: "Open Threads and Recommendations",
    content: actionParts.length > 0
      ? actionParts.join(". ")
      : "No open threads. Consider proactive outreach to strengthen this relationship.",
  });

  // Section 7: Talking Points
  const tp: string[] = [];
  if (ctx.webNews.length > 0) {
    tp.push(`Reference their recent news: "${ctx.webNews[0].content.slice(0, 100)}..." — ask how it's affecting their team.`);
  }
  if (ctx.engagements.length > 0) {
    tp.push(`You both attended ${ctx.engagements[0].name} — use that shared experience as a conversation opener.`);
  }
  if (ctx.firmRelationships.length > 1) {
    const other = ctx.firmRelationships.find((r) => !r.isCurrentUser);
    if (other) {
      tp.push(`Your colleague ${other.partnerName} also knows ${ctx.contact.name} — mention the firm's broader relationship as a trust signal.`);
    }
  }
  if (tp.length === 0) {
    tp.push(`Ask about their current priorities at ${ctx.company.name} and how things have evolved since your last conversation.`);
  }
  sections.push({
    id: "talking_points",
    title: "Talking Points",
    content: tp.map((t, i) => `${i + 1}. ${t}`).join("\n"),
  });

  const summary = `${ctx.contact.name} is ${ctx.contact.title} at ${ctx.company.name}${daysSinceLast !== null ? ` — last contact ${daysSinceLast} days ago` : ""}.`;

  return { summary, sections, talkingPoints: tp };
}

function generateMini360Template(ctx: Contact360Context): Contact360Result {
  const sections: Contact360Section[] = [];

  sections.push({
    id: "profile",
    title: "Person Profile",
    content: `**${ctx.contact.name}**, ${ctx.contact.title} at **${ctx.company.name}** (${ctx.company.industry}). ${ctx.contact.importance} importance.`,
  });

  if (ctx.firmRelationships.length > 1) {
    const others = ctx.firmRelationships.filter((r) => !r.isCurrentUser);
    sections.push({
      id: "firm",
      title: "Firm Connections",
      content: `${others.length} other partner${others.length !== 1 ? "s" : ""} know this contact: ${others.map((r) => `${r.partnerName} (${r.intensity})`).join(", ")}.`,
    });
  } else {
    sections.push({
      id: "firm",
      title: "Firm Connections",
      content: `You are the only partner with a recorded relationship with ${ctx.contact.name}.`,
    });
  }

  const signalBits: string[] = [];
  if (ctx.signals.length > 0) signalBits.push(ctx.signals[0].content.slice(0, 100));
  if (ctx.webNews.length > 0) signalBits.push(ctx.webNews[0].content.slice(0, 100));
  sections.push({
    id: "signals",
    title: "Key Signals",
    content: signalBits.length > 0
      ? signalBits.join(". ")
      : "No recent signals.",
  });

  const summary = `${ctx.contact.name}, ${ctx.contact.title} at ${ctx.company.name}.`;

  return { summary, sections, talkingPoints: [] };
}

// ── Helpers ─────────────────────────────────────────────────────────

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    (result[key] ??= []).push(item);
  }
  return result;
}

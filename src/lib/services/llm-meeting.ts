import { callLLMJson } from "./llm-core";
import { parseStructuredBrief, type StructuredBrief } from "@/lib/types/structured-brief";
import { stripMarkdown } from "@/lib/utils/nudge-summary";

export interface MeetingBriefContext {
  meetingTitle: string;
  meetingPurpose: string;
  attendees: {
    name: string;
    title: string;
    company: string;
    recentInteractions: string[];
    signals: string[];
  }[];
}

const STRUCTURED_BRIEF_SYSTEM_PROMPT = `You are a trusted chief of staff preparing a senior consulting partner for a specific meeting. Your job is to make them walk in feeling sharp and confident — not to dump data.

Return ONLY a valid JSON object matching this exact schema (no markdown, no explanation, no wrapping):

{
  "version": 1,
  "meetingGoal": {
    "statement": "1-2 sentences. Format: [Action verb] [what].",
    "successCriteria": "Success = [measurable outcome]"
  },
  "primaryContactProfile": {
    "name": "Full name of primary attendee",
    "bullets": [
      { "label": "2-4 word bolded descriptor", "detail": "1-2 sentences of evidence" }
    ],
    "emptyReason": "Only if fewer than 3 bullets possible"
  },
  "conversationStarters": [
    { "question": "Specific question in quotes", "tacticalNote": "Max 15 words: why this works" }
  ],
  "newsInsights": [
    { "headline": "ALL CAPS, max 8 words, states implication", "body": "2-3 sentences connecting to this meeting" }
  ],
  "newsEmptyReason": "Only if no meaningful news available",
  "executiveProfile": {
    "bioSummary": "2-3 sentences career arc, not full CV",
    "topOfMind": "3-4 sentences (70-110 words) of strategic synthesis on what is dominating this executive's attention right now. Must explicitly connect two or more concrete signals from the news/signals/recent moves provided (company initiative, public statement, organizational shift, external pressure) and name the strategic bet or tension those signals point to. Close with a sentence on what that likely means they want from a conversation with us (the implication for the meeting). Present-tense, specific to this person this quarter, no industry filler.",
    "recentMoves": [{ "date": "Mon YYYY", "description": "What they did" }],
    "patternCallout": "2-3 sentences on the pattern, only if clear pattern exists"
  },
  "relationshipHistory": {
    "temperature": "COLD|COOL|WARM|HOT",
    "summary": "1-2 sentences on relationship state",
    "engagements": [{ "period": "YYYY-YYYY", "description": "What happened" }]
  },
  "attendees": [{ "name": "Full Name", "title": "Abbreviated title", "initials": "FN" }]
}

QUALITY RULES:
- meetingGoal: Must include a concrete success criteria that someone could evaluate post-meeting. Not vague.
- primaryContactProfile.bullets: Each starts with a bold 2-4 word label. Never include LinkedIn connections, education (unless relevant), or generic title descriptions. Prioritize recent actions, public statements, decision patterns. Target 3 bullets.
- conversationStarters: Exactly 3. Each must be specific to THIS person, THIS company, THIS meeting. If a question could be asked to any executive in the same industry, rewrite it. Each gets a tacticalNote (max 15 words) explaining the strategic purpose.
- newsInsights: Target 3. Headlines must state the IMPLICATION, not the event. Body must connect to this meeting specifically. If no meaningful news, set newsEmptyReason and leave array empty.
- executiveProfile: Career arc, not full CV. topOfMind is the strategic heart of the brief — it must be 3-4 sentences (70-110 words), weave together at least two concrete signals from the data (not repeat the same fact), name the underlying strategic bet or tension (e.g. "balancing AI transformation with platform execution"), and end with what that likely means they'll want from this meeting. If signals are too thin to support that level of synthesis, write a shorter honest version naming the gap rather than padding with generic industry language. recentMoves in reverse chronological order. patternCallout only if a clear pattern exists.
- relationshipHistory: Temperature based on engagement frequency and recency. COLD = no engagement 2+ years. COOL = sparse. WARM = regular. HOT = active with champion. Synthesize from interaction history.
- attendees: Include all meeting attendees with abbreviated titles and initials.

When data is thin, use emptyReason fields rather than generating low-quality content. Honesty about gaps > hallucinated data.`;

function buildUserPrompt(ctx: MeetingBriefContext): string {
  const attendeeDetails = ctx.attendees
    .map(
      (a) =>
        `## ${a.name} – ${a.title}, ${a.company}\nRecent interactions: ${a.recentInteractions.join("; ") || "None"}\nSignals: ${a.signals.join("; ") || "None"}`
    )
    .join("\n\n");

  return `Generate a structured meeting brief for: "${ctx.meetingTitle}"

Purpose: ${ctx.meetingPurpose || "General relationship meeting"}

Attendees:
${attendeeDetails}

Return ONLY the JSON object.`;
}

function validateAndStringify(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const json = JSON.stringify(data);
  return parseStructuredBrief(json) ? json : null;
}

export async function generateMeetingBrief(
  ctx: MeetingBriefContext
): Promise<string> {
  const userPrompt = buildUserPrompt(ctx);

  const jsonResult = await callLLMJson<Record<string, unknown>>(
    STRUCTURED_BRIEF_SYSTEM_PROMPT,
    userPrompt,
    { maxTokens: 4000, temperature: 0.7 }
  );

  const validated = validateAndStringify(jsonResult);
  if (validated) return validated;

  if (jsonResult && typeof jsonResult === "object") {
    try {
      const raw = JSON.stringify(jsonResult);
      const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
      const repaired = validateAndStringify(JSON.parse(cleaned));
      if (repaired) return repaired;
    } catch {
      // Local repair failed — fall through to template
    }
  }

  return generateBriefTemplate(ctx);
}

function firstSentence(text: string, max = 180): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  const match = cleaned.match(/^(.+?[.!?])(\s|$)/);
  const sentence = match ? match[1] : cleaned;
  return sentence.length > max ? sentence.slice(0, max - 1).trimEnd() + "…" : sentence;
}

function cleanSignal(raw: string): string {
  return stripMarkdown(raw.replace(/^[A-Z_]+\s*(\([^)]*\))?\s*:?\s*/, "")).trim();
}

function deriveTopOfMind(
  primary: MeetingBriefContext["attendees"][number] | undefined,
  newsInsights: StructuredBrief["newsInsights"],
): string | undefined {
  if (!primary) return undefined;

  const firstName = primary.name.split(/\s+/)[0] ?? primary.name;
  const sentences: string[] = [];

  const newsBodies = newsInsights
    .map((n) => firstSentence(n.body))
    .filter((s) => s.length > 20);

  const strategicSignals = primary.signals
    .map(cleanSignal)
    .filter((s) =>
      /growth|strategy|expansion|ai|transformation|restructur|cost|layoff|merger|acquisition|launch|hiring|funding|pricing|partnership|earnings|regulation|competitor/i.test(
        s,
      ),
    )
    .map((s) => firstSentence(s));

  const leadSignal = newsBodies[0] ?? strategicSignals[0];
  if (!leadSignal) return undefined;

  sentences.push(
    `${firstName} is currently navigating ${leadSignal.replace(/^[A-Z]/, (c) => c.toLowerCase())}`.replace(/\.$/, "") + ".",
  );

  const secondSignal = newsBodies[1] ?? strategicSignals.find((s) => !leadSignal.includes(s.slice(0, 30)));
  if (secondSignal) {
    sentences.push(
      `At the same time, ${secondSignal.replace(/^[A-Z]/, (c) => c.toLowerCase())}`.replace(/\.$/, "") +
        ", which adds pressure on how they prioritize the next few quarters.",
    );
  }

  if (newsBodies.length >= 2 || strategicSignals.length >= 2) {
    sentences.push(
      `Taken together, the signals suggest ${firstName} is weighing where to concentrate executive attention and capital between these priorities.`,
    );
  }

  sentences.push(
    `A conversation that helps them pressure-test those trade-offs — or unlock capacity on them — is likely to land.`,
  );

  return sentences.join(" ");
}

function generateBriefTemplate(ctx: MeetingBriefContext): string {
  const primary = ctx.attendees[0];
  const primaryName = primary?.name ?? "Attendee";
  const primaryCompany = primary?.company ?? "Company";

  const bullets: StructuredBrief["primaryContactProfile"]["bullets"] = [];
  if (primary) {
    if (primary.title) {
      bullets.push({
        label: "Current Role",
        detail: `${primary.name} serves as ${primary.title} at ${primary.company}.`,
      });
    }

    const jobSignal = primary.signals.find((s) => s.toLowerCase().includes("job_change") || s.toLowerCase().includes("new role") || s.toLowerCase().includes("promoted") || s.toLowerCase().includes("transitioned"));
    if (jobSignal) {
      bullets.push({
        label: "Recent Move",
        detail: stripMarkdown(jobSignal.replace(/^[A-Z_]+:\s*/, "")),
      });
    }

    const linkedInSignal = primary.signals.find((s) => s.toLowerCase().includes("linkedin"));
    if (linkedInSignal && bullets.length < 3) {
      bullets.push({
        label: "Active Voice",
        detail: stripMarkdown(linkedInSignal.replace(/^[A-Z_]+:\s*/, "")),
      });
    }

    if (primary.recentInteractions.length > 0 && bullets.length < 3) {
      const latest = primary.recentInteractions[0];
      const clean = stripMarkdown(latest.replace(/^[A-Z_]+\s*(\([^)]*\))?\s*:?\s*/, ""));
      bullets.push({
        label: "Last Touchpoint",
        detail: clean || latest,
      });
    }
  }

  const newsInsights: StructuredBrief["newsInsights"] = [];
  for (const a of ctx.attendees) {
    for (const s of a.signals) {
      if (s.toLowerCase().includes("company_news") || s.toLowerCase().includes("news")) {
        const cleaned = stripMarkdown(s.replace(/^[A-Z_]+:\s*/, ""));
        if (cleaned.length > 20 && newsInsights.length < 3) {
          const headline = cleaned.slice(0, 50).toUpperCase();
          newsInsights.push({
            headline: headline.length < cleaned.length ? headline + "..." : headline,
            body: cleaned,
          });
        }
      }
    }
  }

  const recentMoves: StructuredBrief["executiveProfile"]["recentMoves"] = [];
  if (primary) {
    for (const s of primary.signals) {
      if (s.toLowerCase().includes("job_change") || s.toLowerCase().includes("new role")) {
        recentMoves.push({
          date: "Recent",
          description: stripMarkdown(s.replace(/^[A-Z_]+:\s*/, "")),
        });
      }
    }
  }

  let temperature: StructuredBrief["relationshipHistory"]["temperature"] = "COOL";
  let relSummary = "Limited engagement history available.";
  const engagements: StructuredBrief["relationshipHistory"]["engagements"] = [];

  if (primary && primary.recentInteractions.length > 0) {
    const count = primary.recentInteractions.length;
    if (count >= 4) temperature = "HOT";
    else if (count >= 2) temperature = "WARM";
    else temperature = "COOL";

    relSummary = `${count} recent interaction${count !== 1 ? "s" : ""} on record with ${primary.name}.`;
    for (const i of primary.recentInteractions.slice(0, 3)) {
      const dateMatch = i.match(/\((\d{4}-\d{2}-\d{2})\)/);
      engagements.push({
        period: dateMatch?.[1] ?? "Recent",
        description: stripMarkdown(i.replace(/^[A-Z_]+\s*(\([^)]*\))?\s*:?\s*/, "")),
      });
    }
  }

  const attendees: StructuredBrief["attendees"] = ctx.attendees.map((a) => {
    const parts = a.name.split(" ");
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : a.name.slice(0, 2).toUpperCase();
    const abbrevTitle = a.title.length > 40 ? a.title.slice(0, 37) + "..." : a.title;
    return { name: a.name, title: abbrevTitle, initials };
  });

  const brief: StructuredBrief = {
    version: 1,
    meetingGoal: {
      statement: `${ctx.meetingPurpose || "Strengthen the relationship and explore collaboration opportunities"} with ${primaryName} at ${primaryCompany}.`,
      successCriteria: `Success = Clear next steps agreed and relationship momentum maintained.`,
    },
    primaryContactProfile: {
      name: primaryName,
      bullets,
      emptyReason: bullets.length === 0 ? `Limited public information available for ${primaryName}.` : undefined,
    },
    conversationStarters: [
      {
        question: `What are your top strategic priorities for the next quarter at ${primaryCompany}?`,
        tacticalNote: "Opens with their agenda, not yours — builds trust.",
      },
      {
        question: `How is ${primaryCompany} thinking about the opportunities in AI and digital transformation?`,
        tacticalNote: "Positions you as a thought partner on trending topics.",
      },
      {
        question: `Where do you see the biggest opportunities for us to partner more deeply?`,
        tacticalNote: "Directly surfaces unmet needs you can fill.",
      },
    ],
    newsInsights,
    newsEmptyReason: newsInsights.length === 0 ? `No recent notable news found for ${primaryCompany}.` : undefined,
    executiveProfile: {
      bioSummary: primary
        ? `${primary.name} is ${primary.title} at ${primary.company}.`
        : "No executive profile data available.",
      topOfMind: deriveTopOfMind(primary, newsInsights),
      recentMoves,
      patternCallout: recentMoves.length > 0 ? undefined : undefined,
    },
    relationshipHistory: {
      temperature,
      summary: relSummary,
      engagements,
    },
    attendees,
  };

  return JSON.stringify(brief);
}

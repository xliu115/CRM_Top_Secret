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

QUALITY BAR — "personal chief of staff", not data dump
The partner reads this 10 minutes before walking into a room. Every field has to earn its slot. If you can't write something specific to THIS person, THIS company, THIS meeting, leave it short and honest rather than padding with industry filler. A short, sharp brief beats a long, generic one every time.

QUALITY RULES:
- meetingGoal.statement: Do NOT just echo the meeting purpose. Infer the partner's actual objective from the attendee profile, signals, and relationship history. Format: "[Action verb] [specific thing] with [Name]." Example of acceptable: "Pressure-test Apple's hardware-led AI bet with Eddy and align on where outside help unlocks speed." Example of unacceptable (generic): "Review active deals and identify acceleration opportunities."
- meetingGoal.successCriteria: Specific enough that someone could say post-meeting "we achieved this" or "we didn't." Reference a concrete artifact, decision, or commitment.
- primaryContactProfile.bullets: Each starts with a bolded 2-4 word label (e.g., "AI-first CEO", "Hardware veteran", "Cost hawk"), then 1-2 sentences of evidence drawn from the signals/interactions/recent moves. Never use generic descriptors ("Experienced leader", "Strategic thinker"). Never include LinkedIn connections, education (unless directly relevant), or restated job title. Prioritize recent actions, public statements, decision patterns. Target 3 bullets — fewer is fine if signals are thin (set emptyReason).
- conversationStarters: Exactly 3. FORBIDDEN GENERIC PATTERNS (rewrite if you find yourself reaching for these):
    × "What are your top strategic priorities for the next quarter?"
    × "How are you thinking about AI / digital transformation?"
    × "What specific challenges are you facing with current deals?"
    × "Where do you see the biggest opportunities for us to partner more deeply?"
    × "What's keeping you up at night?"
  Each question must reference a concrete signal — a named initiative, a public statement, a recent move, a competitor action, a financial event. The reader should think "this came from someone who did the homework," not "this came from a research brief." Each gets a tacticalNote (max 15 words) explaining the strategic purpose.
- newsInsights: Target 3. Headlines: ALL CAPS, max 8 words, state the IMPLICATION not the event. Acceptable: "TERNUS PICK SIGNALS HARDWARE-LED AI BET". Unacceptable: "Apple announces new CEO". Body: 2-3 sentences connecting to THIS meeting specifically and ending with a concrete recommendation. If no meaningful news, set newsEmptyReason and leave the array empty — never fabricate.
- executiveProfile.topOfMind: The strategic heart of the brief — 3-4 sentences (70-110 words). Must (1) weave together at least two concrete signals from the data (not the same fact restated), (2) name the underlying strategic bet or tension (e.g., "balancing AI transformation with platform execution"), and (3) close with what that likely means they want from a conversation with us. Present-tense, specific to this person this quarter, no industry filler. If signals are too thin, write a shorter honest version naming the gap rather than padding.
- executiveProfile.recentMoves: Reverse chronological. patternCallout only if a clear behavioral pattern emerges across 2+ moves.
- relationshipHistory.summary: Reference concrete details — number of recent touches, named McKinsey contacts, specific past engagements. Avoid temperature-only restatements ("warm relationship suggests strong foundation"). If sparse, name the gap honestly.
- relationshipHistory.temperature: COLD = no engagement 2+ years. COOL = sparse. WARM = regular cadence. HOT = active with named champion.
- attendees: All meeting attendees with abbreviated titles and initials.

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
  const primaryFirstName = primaryName.split(/\s+/)[0] ?? primaryName;

  const bullets: StructuredBrief["primaryContactProfile"]["bullets"] = [];
  if (primary) {
    const jobSignal = primary.signals.find((s) => s.toLowerCase().includes("job_change") || s.toLowerCase().includes("new role") || s.toLowerCase().includes("promoted") || s.toLowerCase().includes("transitioned"));
    if (jobSignal) {
      bullets.push({
        label: "Recent Move",
        detail: stripMarkdown(jobSignal.replace(/^[A-Z_]+:\s*/, "")),
      });
    }

    const newsSignal = primary.signals.find((s) =>
      /company_news|news|launch|announce|earnings|funding|acquisition/i.test(s),
    );
    if (newsSignal && bullets.length < 3) {
      bullets.push({
        label: "Front of Mind",
        detail: cleanSignal(newsSignal),
      });
    }

    const linkedInSignal = primary.signals.find((s) => s.toLowerCase().includes("linkedin"));
    if (linkedInSignal && bullets.length < 3) {
      bullets.push({
        label: "Public Voice",
        detail: cleanSignal(linkedInSignal),
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
        const cleaned = cleanSignal(s);
        if (cleaned.length > 20 && newsInsights.length < 3) {
          newsInsights.push({
            headline: synthesizeHeadline(cleaned),
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
  let relSummary = primary
    ? `No interactions on file with ${primary.name} — treat this as a first real touch.`
    : "No prior engagement on record.";
  const engagements: StructuredBrief["relationshipHistory"]["engagements"] = [];

  if (primary && primary.recentInteractions.length > 0) {
    const count = primary.recentInteractions.length;
    if (count >= 4) temperature = "HOT";
    else if (count >= 2) temperature = "WARM";
    else temperature = "COOL";

    const latestRaw = primary.recentInteractions[0];
    const latestDescription = cleanSignal(latestRaw);
    const latestDateMatch = latestRaw.match(/\((\d{4}-\d{2}-\d{2})\)/);
    const dateClause = latestDateMatch ? ` (most recent ${latestDateMatch[1]})` : "";
    relSummary = `${count} recent touch${count !== 1 ? "es" : ""} with ${primary.name}${dateClause}: ${truncate(latestDescription, 110)}`;
    for (const i of primary.recentInteractions.slice(0, 3)) {
      const dateMatch = i.match(/\((\d{4}-\d{2}-\d{2})\)/);
      engagements.push({
        period: dateMatch?.[1] ?? "Recent",
        description: cleanSignal(i),
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

  const conversationStarters = buildSignalGroundedStarters(primary, primaryFirstName, primaryCompany);
  const goalStatement = inferGoalStatement(ctx, primaryFirstName, primaryCompany);

  const brief: StructuredBrief = {
    version: 1,
    meetingGoal: {
      statement: goalStatement,
      successCriteria: `Success = ${primaryFirstName} commits to a concrete next step (intro, follow-on session, or a named workstream) before the meeting ends.`,
    },
    primaryContactProfile: {
      name: primaryName,
      bullets,
      emptyReason:
        bullets.length === 0
          ? `Limited public signals on ${primaryName} — lead with discovery, not assumptions.`
          : undefined,
    },
    conversationStarters,
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

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Compress a longer signal into an ALL-CAPS headline of ≤8 meaningful words.
 * Strips filler words and truncates rather than just taking the first 50
 * characters (which produces ugly "APPLE'S BIGGEST WEEK OF 2026: MACBO…").
 */
const HEADLINE_FILLERS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "in", "on", "for", "to", "with",
  "as", "by", "at", "from", "is", "are", "was", "were", "be", "been", "this",
  "that", "it", "its", "into", "after", "before", "also", "than",
]);

function synthesizeHeadline(text: string): string {
  const cleaned = text.replace(/[—–:]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(" ");
  const kept: string[] = [];
  for (const t of tokens) {
    const stripped = t.replace(/[.,;()"']+$/g, "");
    if (!stripped) continue;
    if (HEADLINE_FILLERS.has(stripped.toLowerCase()) && kept.length > 0) continue;
    kept.push(stripped);
    if (kept.length >= 8) break;
  }
  return kept.join(" ").toUpperCase();
}

/**
 * Build conversation starters that reference actual signals when present,
 * rather than the generic "what are your priorities?" pattern. Each starter
 * pulls from one signal source (news, recent move, recent interaction) so
 * the partner walks in sounding like they did the homework.
 */
function buildSignalGroundedStarters(
  primary: MeetingBriefContext["attendees"][number] | undefined,
  firstName: string,
  company: string,
): StructuredBrief["conversationStarters"] {
  const starters: StructuredBrief["conversationStarters"] = [];
  if (!primary) {
    return [
      {
        question: `What's the single most important outcome for ${company} over the next two quarters?`,
        tacticalNote: "Forces specificity; surfaces the real agenda fast.",
      },
      {
        question: `If you could fast-forward 12 months and land one bet, what would it be?`,
        tacticalNote: "Reveals the strategic hill they're willing to die on.",
      },
      {
        question: `Where is internal capacity the biggest bottleneck right now?`,
        tacticalNote: "Surfaces a concrete gap McKinsey can fill.",
      },
    ];
  }

  const signals = primary.signals.map(cleanSignal).filter((s) => s.length > 20);
  const newsLike = signals.find((s) => /launch|announce|earnings|funding|acquisition|merger|partner|hire/i.test(s));
  if (newsLike) {
    const sentence = firstSentence(newsLike, 120);
    starters.push({
      question: `Saw the recent news — "${truncate(sentence, 100)}". What's the strategic story behind it that doesn't make the press release?`,
      tacticalNote: "Signals you read past the headline; invites candor.",
    });
  }

  const moveLike = signals.find((s) => /job_change|promoted|new role|transitioned|stepping down|appointed/i.test(s));
  if (moveLike && starters.length < 3) {
    starters.push({
      question: `With the recent leadership shift in mind, what's the first 90-day bet you most want to land?`,
      tacticalNote: "Anchors on the change; invites them to share priorities.",
    });
  }

  const aiSignal = signals.find((s) => /ai|artificial intelligence|model|automation/i.test(s));
  if (aiSignal && starters.length < 3) {
    starters.push({
      question: `On the AI side, where are you trying to compress timelines vs. where are you holding the line for quality?`,
      tacticalNote: "Avoids 'how do you think about AI'; surfaces real trade-offs.",
    });
  }

  while (starters.length < 3) {
    const fallbacks: StructuredBrief["conversationStarters"] = [
      {
        question: `What's a decision on your plate right now where an outside view would actually move the needle?`,
        tacticalNote: "Concrete and specific — invites a real ask.",
      },
      {
        question: `Where is ${company}'s leadership team spending the most time this quarter that the market hasn't fully priced in?`,
        tacticalNote: "Probes for the strategic priority behind the noise.",
      },
      {
        question: `If we sat here a year from now and called this collaboration a success, what would have happened?`,
        tacticalNote: "Forward-dates success; clarifies the bar.",
      },
    ];
    const next = fallbacks[starters.length];
    if (!next) break;
    if (!starters.some((s) => s.question === next.question)) starters.push(next);
  }

  // Personalize the first fallback if the company token was used
  return starters.slice(0, 3).map((s) => ({
    ...s,
    question: s.question.replace(/\$\{firstName\}/g, firstName),
  }));
}

/**
 * Infer a goal statement from the meeting context rather than echoing the
 * (often generic) `meetingPurpose` template verbatim.
 */
function inferGoalStatement(
  ctx: MeetingBriefContext,
  firstName: string,
  company: string,
): string {
  const purpose = ctx.meetingPurpose?.trim() ?? "";
  const title = ctx.meetingTitle ?? "";
  const lowerTitle = title.toLowerCase();
  const lowerPurpose = purpose.toLowerCase();

  if (/pipeline|deal/i.test(lowerTitle) || /pipeline|deal/i.test(lowerPurpose)) {
    return `Pressure-test the active ${company} pipeline with ${firstName} and lock in one acceleration play before the call ends.`;
  }
  if (/quarterly|qbr|business review/i.test(lowerTitle) || /quarterly|qbr|business review/i.test(lowerPurpose)) {
    return `Walk ${firstName} through Q-progress, hear what's changed in their priorities, and surface one workstream to deepen.`;
  }
  if (/renew|contract/i.test(lowerTitle) || /renew|contract/i.test(lowerPurpose)) {
    return `Reaffirm value delivered, hear ${firstName}'s honest read on the relationship, and protect the renewal envelope.`;
  }
  if (/strategy|alignment|planning|relationship/i.test(lowerTitle) || /strategy|alignment|planning|relationship/i.test(lowerPurpose)) {
    return `Re-anchor on what ${firstName} is actually trying to land in the next two quarters and identify where outside help compresses time.`;
  }
  if (/onboard|kickoff/i.test(lowerTitle) || /onboard|kickoff/i.test(lowerPurpose)) {
    return `Set a sharp shared goal with ${firstName} for the first 30 days and confirm the right working rhythm.`;
  }
  if (/innovation|workshop|deep dive|technical/i.test(lowerTitle) || /innovation|workshop|technical/i.test(lowerPurpose)) {
    return `Get to one concrete experiment ${firstName}'s team would actually run before the next session.`;
  }

  if (purpose) {
    return `${capitalizeFirst(purpose.replace(/\.$/, ""))} with ${firstName} — and leave with a named next step.`;
  }
  return `Build trust with ${firstName} and surface one concrete area where outside help moves the needle this quarter.`;
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

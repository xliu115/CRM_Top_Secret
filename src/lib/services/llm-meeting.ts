import { callLLM } from "./llm-core";
import type { StructuredBrief } from "@/lib/types/structured-brief";

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
- executiveProfile: Career arc, not full CV. recentMoves in reverse chronological order. patternCallout only if a clear pattern exists.
- relationshipHistory: Temperature based on engagement frequency and recency. COLD = no engagement 2+ years. COOL = sparse. WARM = regular. HOT = active with champion. Synthesize from interaction history.
- attendees: Include all meeting attendees with abbreviated titles and initials.

When data is thin, use emptyReason fields rather than generating low-quality content. Honesty about gaps > hallucinated data.`;

export async function generateMeetingBrief(
  ctx: MeetingBriefContext
): Promise<string> {
  const attendeeDetails = ctx.attendees
    .map(
      (a) =>
        `## ${a.name} – ${a.title}, ${a.company}\nRecent interactions: ${a.recentInteractions.join("; ") || "None"}\nSignals: ${a.signals.join("; ") || "None"}`
    )
    .join("\n\n");

  const userPrompt = `Generate a structured meeting brief for: "${ctx.meetingTitle}"

Purpose: ${ctx.meetingPurpose || "General relationship meeting"}

Attendees:
${attendeeDetails}

Return ONLY the JSON object. No markdown fences, no explanation.`;

  const result = await callLLM(STRUCTURED_BRIEF_SYSTEM_PROMPT, userPrompt);

  if (result) {
    const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed?.version === 1 && parsed?.meetingGoal) {
        return JSON.stringify(parsed);
      }
    } catch {
      const retry = await callLLM(
        STRUCTURED_BRIEF_SYSTEM_PROMPT,
        `Your previous response was not valid JSON. Please output ONLY the JSON object for this meeting brief, no other text.\n\n${userPrompt}`
      );
      if (retry) {
        const retryCleaned = retry.replace(/```json\n?|\n?```/g, "").trim();
        try {
          const retryParsed = JSON.parse(retryCleaned);
          if (retryParsed?.version === 1 && retryParsed?.meetingGoal) {
            return JSON.stringify(retryParsed);
          }
        } catch {
          // Fall through to template
        }
      }
    }
  }

  return generateBriefTemplate(ctx);
}

function generateBriefTemplate(ctx: MeetingBriefContext): string {
  const attendeeSection = ctx.attendees
    .map((a) => {
      const interactions = a.recentInteractions.length
        ? a.recentInteractions.slice(0, 2).map((i) => `  - ${i}`).join("\n")
        : "  - No recent interactions";
      const signals = a.signals.length
        ? a.signals.slice(0, 2).map((s) => `  - ${s}`).join("\n")
        : "  - No recent signals";
      return `### ${a.name} – ${a.title}, ${a.company}\n**Recent Interactions:**\n${interactions}\n**Signals:**\n${signals}`;
    })
    .join("\n\n");

  return `# Meeting Brief: ${ctx.meetingTitle}

## Meeting Context
${ctx.meetingPurpose || "General relationship meeting."}

## Attendee Insights
${attendeeSection}

## Recommended Agenda
1. Open with relationship check-in and recent developments
2. Discuss strategic priorities and how we can add value
3. Review any open action items from previous meetings
4. Explore new collaboration opportunities
5. Agree on next steps and follow-up timeline

## Suggested Questions
1. What are your top strategic priorities for the next quarter?
2. How is the team adapting to recent organizational changes?
3. Where do you see the biggest opportunities for us to partner?
4. Are there any challenges where we could provide additional support?
5. What would make this relationship even more valuable to you?

## Risks & Watch-outs
- Be mindful of any recent negative sentiment in past interactions
- Watch for signs of competitive pressure or budget constraints
- Note any organizational changes that may affect decision-making

## Preparation Checklist
- [ ] Review all attendee profiles and recent interactions
- [ ] Prepare 1-2 relevant insights or case studies to share
- [ ] Have follow-up materials ready to send post-meeting`;
}

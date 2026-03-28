import { callLLM } from "./llm-core";

// ── Meeting Brief ───────────────────────────────────────────────────

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

export async function generateMeetingBrief(
  ctx: MeetingBriefContext
): Promise<string> {
  const attendeeDetails = ctx.attendees
    .map(
      (a) =>
        `## ${a.name} – ${a.title}, ${a.company}\nRecent interactions: ${a.recentInteractions.join("; ") || "None"}\nSignals: ${a.signals.join("; ") || "None"}`
    )
    .join("\n\n");

  const result = await callLLM(
    `You are an expert meeting preparation assistant. Generate structured, actionable meeting briefs.`,
    `Generate a meeting brief for: "${ctx.meetingTitle}"

Purpose: ${ctx.meetingPurpose}

Attendees:
${attendeeDetails}

Structure the brief with these sections:
1. **Meeting Context** – Why this meeting matters
2. **Attendee Insights** – Key facts about each person
3. **Recommended Agenda** – 3-5 agenda items
4. **Suggested Questions** – 3-5 strategic questions to ask
5. **Risks & Watch-outs** – Potential concerns to be aware of
6. **Preparation Checklist** – 2-3 things to prepare before the meeting`
  );

  return result ?? generateBriefTemplate(ctx);
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

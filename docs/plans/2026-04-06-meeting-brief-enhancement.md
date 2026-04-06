# Meeting Brief Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the meeting brief from a generic markdown data dump into a structured, two-layer JSON brief (90-second hero card + expandable prep detail) that answers "what do you need to own the room?"

**Architecture:** The LLM returns structured JSON conforming to a `StructuredBrief` schema. The same `generatedBrief` column stores the JSON string (no DB migration). The frontend detects JSON vs legacy markdown via `JSON.parse` and renders the appropriate layout. New UI components are extracted into `src/components/meetings/`.

**Tech Stack:** Next.js 16 + React 19, Tailwind CSS 4, OpenAI `callLLMJson` (existing), Radix UI primitives (existing Card/Badge/Avatar), Lucide icons

---

## File Structure

**New files:**
- `src/lib/types/structured-brief.ts` — StructuredBrief interface, parse utility, text formatter
- `src/components/meetings/structured-brief-card.tsx` — 90-second hero card (goal + bullets + starters)
- `src/components/meetings/prep-detail-section.tsx` — collapsible wrapper for detail sections
- `src/components/meetings/news-insights-card.tsx` — 3 insight cards
- `src/components/meetings/executive-profile-card.tsx` — bio + recent moves + pattern callout
- `src/components/meetings/relationship-history-card.tsx` — temperature bar + timeline
- `src/components/meetings/attendee-chip-grid.tsx` — attendee chip grid
- `src/components/meetings/freshness-indicator.tsx` — green/yellow/red dot

**Modified files:**
- `src/lib/services/llm-meeting.ts` — new structured prompt + JSON validation
- `src/app/meetings/[id]/page.tsx` — restructured layout with new components
- `src/app/dashboard/page.tsx` — enhanced meeting preview with structured data

---

### Task 1: StructuredBrief Type + Utilities

**Files:**
- Create: `src/lib/types/structured-brief.ts`

- [ ] **Step 1: Create the StructuredBrief type file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep structured-brief || echo "No errors"`
Expected: No errors related to the new file

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/structured-brief.ts
git commit -m "feat(brief): add StructuredBrief type, parser, and text formatter"
```

---

### Task 2: LLM Structured Brief Prompt

**Files:**
- Modify: `src/lib/services/llm-meeting.ts`

- [ ] **Step 1: Replace generateMeetingBrief with structured JSON version**

Replace the entire contents of `src/lib/services/llm-meeting.ts` with:

```typescript
// src/lib/services/llm-meeting.ts
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
      // JSON parse failed — try one more time with correction
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep llm-meeting || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/llm-meeting.ts
git commit -m "feat(brief): replace markdown prompt with structured JSON brief generation"
```

---

### Task 3: FreshnessIndicator Component

**Files:**
- Create: `src/components/meetings/freshness-indicator.tsx`

- [ ] **Step 1: Create the FreshnessIndicator component**

```typescript
// src/components/meetings/freshness-indicator.tsx
"use client";

import { cn } from "@/lib/utils/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FreshnessIndicatorProps {
  generatedAt: string | null;
  className?: string;
}

function getFreshness(generatedAt: string | null): {
  color: string;
  label: string;
  dotClass: string;
} {
  if (!generatedAt) {
    return { color: "gray", label: "Not generated", dotClass: "bg-gray-400" };
  }
  const hoursAgo =
    (Date.now() - new Date(generatedAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 24) {
    return { color: "green", label: "Fresh (< 24h)", dotClass: "bg-green-500" };
  }
  if (hoursAgo < 48) {
    return {
      color: "yellow",
      label: "Aging (24-48h)",
      dotClass: "bg-yellow-500",
    };
  }
  return { color: "red", label: "Stale (> 48h)", dotClass: "bg-red-500" };
}

export function FreshnessIndicator({
  generatedAt,
  className,
}: FreshnessIndicatorProps) {
  const { label, dotClass } = getFreshness(generatedAt);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
              dotClass,
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/meetings/freshness-indicator.tsx
git commit -m "feat(brief): add FreshnessIndicator component"
```

---

### Task 4: StructuredBriefCard (Hero) Component

**Files:**
- Create: `src/components/meetings/structured-brief-card.tsx`

- [ ] **Step 1: Create the hero card component**

```typescript
// src/components/meetings/structured-brief-card.tsx
"use client";

import type { StructuredBrief } from "@/lib/types/structured-brief";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Target, User, MessageCircle } from "lucide-react";

interface StructuredBriefCardProps {
  brief: StructuredBrief;
}

export function StructuredBriefCard({ brief }: StructuredBriefCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Meeting Prep Card</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Meeting Goal */}
        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-4 border border-indigo-100 dark:border-indigo-900/50">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Meeting Goal
            </span>
          </div>
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {brief.meetingGoal.statement}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Success = {brief.meetingGoal.successCriteria}
          </p>
        </div>

        {/* Primary Contact in 3 Bullets */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              {brief.primaryContactProfile.name} in{" "}
              {brief.primaryContactProfile.bullets.length} Bullets
            </span>
          </div>
          {brief.primaryContactProfile.bullets.length > 0 ? (
            <ul className="space-y-2.5">
              {brief.primaryContactProfile.bullets.map((bullet, i) => (
                <li key={i} className="text-sm text-foreground/80 leading-relaxed">
                  <span className="font-semibold text-foreground">
                    {bullet.label}.
                  </span>{" "}
                  {bullet.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {brief.primaryContactProfile.emptyReason ??
                "Limited information available."}
            </p>
          )}
        </div>

        {/* Conversation Starters */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Conversation Starters
            </span>
          </div>
          <div className="space-y-3">
            {brief.conversationStarters.map((starter, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-muted/20 px-4 py-3"
              >
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  &ldquo;{starter.question}&rdquo;
                </p>
                <p className="text-xs text-muted-foreground italic mt-1">
                  → {starter.tacticalNote}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/meetings/structured-brief-card.tsx
git commit -m "feat(brief): add StructuredBriefCard hero component"
```

---

### Task 5: Prep Detail Components

**Files:**
- Create: `src/components/meetings/prep-detail-section.tsx`
- Create: `src/components/meetings/news-insights-card.tsx`
- Create: `src/components/meetings/executive-profile-card.tsx`
- Create: `src/components/meetings/relationship-history-card.tsx`
- Create: `src/components/meetings/attendee-chip-grid.tsx`

- [ ] **Step 1: Create PrepDetailSection wrapper**

```typescript
// src/components/meetings/prep-detail-section.tsx
"use client";

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PrepDetailSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export function PrepDetailSection({
  title,
  icon,
  children,
}: PrepDetailSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-950/40">
            {icon}
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create NewsInsightsCard**

```typescript
// src/components/meetings/news-insights-card.tsx
"use client";

import type { StructuredBrief } from "@/lib/types/structured-brief";
import { PrepDetailSection } from "./prep-detail-section";
import { Newspaper } from "lucide-react";

interface NewsInsightsCardProps {
  insights: StructuredBrief["newsInsights"];
  emptyReason?: string;
}

export function NewsInsightsCard({
  insights,
  emptyReason,
}: NewsInsightsCardProps) {
  if (insights.length === 0 && !emptyReason) return null;

  return (
    <PrepDetailSection
      title="Client News Insights"
      icon={<Newspaper className="h-3.5 w-3.5 text-indigo-600" />}
    >
      {insights.length > 0 ? (
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-muted/20 p-4"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                {insight.headline}
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed">
                {insight.body}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">{emptyReason}</p>
      )}
    </PrepDetailSection>
  );
}
```

- [ ] **Step 3: Create ExecutiveProfileCard**

```typescript
// src/components/meetings/executive-profile-card.tsx
"use client";

import type { StructuredBrief } from "@/lib/types/structured-brief";
import { PrepDetailSection } from "./prep-detail-section";
import { UserCircle } from "lucide-react";

interface ExecutiveProfileCardProps {
  profile: StructuredBrief["executiveProfile"];
}

export function ExecutiveProfileCard({ profile }: ExecutiveProfileCardProps) {
  return (
    <PrepDetailSection
      title="Executive Profile"
      icon={<UserCircle className="h-3.5 w-3.5 text-indigo-600" />}
    >
      <div className="space-y-4">
        <p className="text-sm text-foreground/80 leading-relaxed">
          {profile.bioSummary}
        </p>

        {profile.recentMoves.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Recent Moves
            </p>
            <div className="space-y-2 border-l-2 border-indigo-200 dark:border-indigo-800 pl-4">
              {profile.recentMoves.map((move, i) => (
                <div key={i}>
                  <span className="text-xs font-medium text-muted-foreground">
                    {move.date}
                  </span>
                  <p className="text-sm text-foreground/80">{move.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.patternCallout && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-950/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-400 mb-1">
              Pattern
            </p>
            <p className="text-sm text-yellow-800 dark:text-yellow-300 leading-relaxed">
              {profile.patternCallout}
            </p>
          </div>
        )}
      </div>
    </PrepDetailSection>
  );
}
```

- [ ] **Step 4: Create RelationshipHistoryCard**

```typescript
// src/components/meetings/relationship-history-card.tsx
"use client";

import type { StructuredBrief } from "@/lib/types/structured-brief";
import { PrepDetailSection } from "./prep-detail-section";
import { cn } from "@/lib/utils/cn";
import { Handshake } from "lucide-react";

interface RelationshipHistoryCardProps {
  history: StructuredBrief["relationshipHistory"];
}

const temperatureConfig = {
  COLD: {
    label: "Cold",
    barClass: "bg-blue-400",
    width: "w-1/4",
    textClass: "text-blue-600 dark:text-blue-400",
  },
  COOL: {
    label: "Cool",
    barClass: "bg-sky-400",
    width: "w-2/4",
    textClass: "text-sky-600 dark:text-sky-400",
  },
  WARM: {
    label: "Warm",
    barClass: "bg-orange-400",
    width: "w-3/4",
    textClass: "text-orange-600 dark:text-orange-400",
  },
  HOT: {
    label: "Hot",
    barClass: "bg-red-500",
    width: "w-full",
    textClass: "text-red-600 dark:text-red-400",
  },
};

export function RelationshipHistoryCard({
  history,
}: RelationshipHistoryCardProps) {
  const config = temperatureConfig[history.temperature];

  return (
    <PrepDetailSection
      title="Relationship History"
      icon={<Handshake className="h-3.5 w-3.5 text-indigo-600" />}
    >
      <div className="space-y-4">
        {/* Temperature bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Temperature
            </span>
            <span className={cn("text-xs font-bold uppercase", config.textClass)}>
              {config.label}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={cn("h-2 rounded-full transition-all", config.barClass, config.width)}
            />
          </div>
        </div>

        <p className="text-sm text-foreground/80 leading-relaxed">
          {history.summary}
        </p>

        {history.engagements.length > 0 && (
          <div className="space-y-2 border-l-2 border-border pl-4">
            {history.engagements.map((eng, i) => (
              <div key={i}>
                <span className="text-xs font-medium text-muted-foreground">
                  {eng.period}
                </span>
                <p className="text-sm text-foreground/80">{eng.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PrepDetailSection>
  );
}
```

- [ ] **Step 5: Create AttendeeChipGrid**

```typescript
// src/components/meetings/attendee-chip-grid.tsx
"use client";

import type { StructuredBrief } from "@/lib/types/structured-brief";
import { PrepDetailSection } from "./prep-detail-section";
import { Avatar } from "@/components/ui/avatar";
import { Users } from "lucide-react";

interface AttendeeChipGridProps {
  attendees: StructuredBrief["attendees"];
}

export function AttendeeChipGrid({ attendees }: AttendeeChipGridProps) {
  if (attendees.length <= 1) return null;

  return (
    <PrepDetailSection
      title="Also Attending"
      icon={<Users className="h-3.5 w-3.5 text-indigo-600" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {attendees.map((attendee, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border p-2.5"
          >
            <Avatar name={attendee.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {attendee.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {attendee.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </PrepDetailSection>
  );
}
```

- [ ] **Step 6: Verify all components compile**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "components/meetings" || echo "No errors"`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/components/meetings/
git commit -m "feat(brief): add prep detail components (news, executive, relationship, attendees)"
```

---

### Task 6: Redesign Meeting Detail Page

**Files:**
- Modify: `src/app/meetings/[id]/page.tsx`

- [ ] **Step 1: Replace the meeting detail page**

Replace the entire contents of `src/app/meetings/[id]/page.tsx` with:

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Users,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownPreview } from "@/components/ui/markdown-preview";
import { FreshnessIndicator } from "@/components/meetings/freshness-indicator";
import { StructuredBriefCard } from "@/components/meetings/structured-brief-card";
import { NewsInsightsCard } from "@/components/meetings/news-insights-card";
import { ExecutiveProfileCard } from "@/components/meetings/executive-profile-card";
import { RelationshipHistoryCard } from "@/components/meetings/relationship-history-card";
import { AttendeeChipGrid } from "@/components/meetings/attendee-chip-grid";
import {
  parseStructuredBrief,
  formatBriefAsText,
} from "@/lib/types/structured-brief";

type Meeting = {
  id: string;
  title: string;
  purpose: string | null;
  startTime: string;
  createdAt?: string;
  generatedBrief: string | null;
  attendees: {
    contact: {
      id: string;
      name: string;
      title: string;
      company: { name: string };
    };
  }[];
};

export default function MeetingDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  async function fetchMeeting() {
    if (!id) return;
    try {
      const res = await fetch(`/api/meetings/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Meeting not found");
        throw new Error("Failed to fetch meeting");
      }
      const data = await res.json();
      setMeeting(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMeeting();
  }, [id]);

  async function handleGenerateBrief() {
    if (!id) return;
    setGeneratingBrief(true);
    setBriefError(null);
    try {
      const res = await fetch(`/api/meetings/${id}/brief`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Failed to generate brief"
        );
      }
      const { brief } = data as { brief: string };
      setMeeting((prev) =>
        prev ? { ...prev, generatedBrief: brief } : null
      );
    } catch (err) {
      setBriefError(
        err instanceof Error ? err.message : "Failed to generate brief"
      );
    } finally {
      setGeneratingBrief(false);
    }
  }

  function handleCopyBrief() {
    if (!meeting?.generatedBrief) return;
    const structured = parseStructuredBrief(meeting.generatedBrief);
    const text = structured
      ? formatBriefAsText(structured)
      : meeting.generatedBrief;
    void navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  if (loading && !meeting) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardShell>
    );
  }

  if (error || !meeting) {
    return (
      <DashboardShell>
        <div className="space-y-4">
          <Button variant="ghost" asChild>
            <Link href="/meetings" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Meetings
            </Link>
          </Button>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error ?? "Meeting not found"}
          </div>
        </div>
      </DashboardShell>
    );
  }

  const structuredBrief = parseStructuredBrief(meeting.generatedBrief);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/meetings" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Meetings
          </Link>
        </Button>

        {/* Meeting Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{meeting.title}</CardTitle>
                <CardDescription className="mt-1">
                  {format(
                    new Date(meeting.startTime),
                    "EEEE, MMMM d, yyyy 'at' h:mm a"
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {meeting.generatedBrief && (
                  <FreshnessIndicator generatedAt={meeting.createdAt ?? null} />
                )}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {meeting.attendees.length}
                </div>
              </div>
            </div>
            {meeting.purpose && (
              <p className="text-foreground mt-2">{meeting.purpose}</p>
            )}
          </CardHeader>
        </Card>

        {/* Brief content — structured or legacy */}
        {structuredBrief ? (
          <>
            {/* Hero Card */}
            <StructuredBriefCard brief={structuredBrief} />

            {/* Detailed Prep divider */}
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Detailed Prep
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Prep Detail sections */}
            <NewsInsightsCard
              insights={structuredBrief.newsInsights}
              emptyReason={structuredBrief.newsEmptyReason}
            />
            <ExecutiveProfileCard
              profile={structuredBrief.executiveProfile}
            />
            <RelationshipHistoryCard
              history={structuredBrief.relationshipHistory}
            />
            <AttendeeChipGrid attendees={structuredBrief.attendees} />

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateBrief}
                disabled={generatingBrief}
              >
                {generatingBrief ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate Brief
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyBrief}
              >
                {copySuccess ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Brief
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Legacy: Attendees card */}
            <Card>
              <CardHeader>
                <CardTitle>Attendees</CardTitle>
                <CardDescription>
                  People invited to this meeting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {meeting.attendees.map((a) => (
                    <Link
                      key={a.contact.id}
                      href={`/contacts/${a.contact.id}`}
                      className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                    >
                      <Avatar name={a.contact.name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {a.contact.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {a.contact.title} at {a.contact.company.name}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Legacy: Meeting Brief card */}
            <Card>
              <CardHeader>
                <CardTitle>Meeting Brief</CardTitle>
                <CardDescription>
                  AI-generated preparation brief for this meeting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {meeting.generatedBrief ? (
                  <>
                    <div className="rounded-md border border-border bg-muted/30 p-4">
                      <MarkdownPreview content={meeting.generatedBrief} />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyBrief}
                    >
                      {copySuccess ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Brief
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <Button
                      onClick={handleGenerateBrief}
                      disabled={generatingBrief}
                    >
                      {generatingBrief ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate Brief"
                      )}
                    </Button>
                    {briefError && (
                      <p className="text-sm text-destructive">{briefError}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
```

- [ ] **Step 2: Verify page compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "meetings" || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/meetings/\[id\]/page.tsx
git commit -m "feat(brief): redesign meeting detail page with structured brief layout"
```

---

### Task 7: Dashboard Meeting Card Enhancement

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add import for parseStructuredBrief at the top of dashboard page**

In `src/app/dashboard/page.tsx`, add this import alongside the existing imports:

```typescript
import { parseStructuredBrief } from "@/lib/types/structured-brief";
```

- [ ] **Step 2: Update the Top Nudges feed meeting card preview**

In `src/app/dashboard/page.tsx`, find the meeting card rendering inside `feedItems.map` (around line 1064-1134). Replace the summary preview logic.

Find this block:

```typescript
                          const summarySource = meeting.generatedBrief || meeting.purpose;
                          const summaryPreview = summarySource
                            ? summarySource.length > 200
                              ? summarySource.slice(0, 200).trimEnd() + "\u2026"
                              : summarySource
                            : null;
```

Replace with:

```typescript
                          const structuredBrief = parseStructuredBrief(meeting.generatedBrief);
                          const summarySource = structuredBrief
                            ? structuredBrief.meetingGoal.statement
                            : (meeting.generatedBrief || meeting.purpose);
                          const summaryPreview = summarySource
                            ? summarySource.length > 200
                              ? summarySource.slice(0, 200).trimEnd() + "\u2026"
                              : summarySource
                            : null;
                          const briefLabel = structuredBrief
                            ? "Goal"
                            : (meeting.generatedBrief ? "Brief" : "Purpose");
```

Then find the label display:

```typescript
                                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                                      {meeting.generatedBrief ? "Brief" : "Purpose"}
                                    </span>
```

Replace with:

```typescript
                                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                                      {briefLabel}
                                    </span>
```

- [ ] **Step 3: Update "Today's Meetings & Briefs" card preview**

In the same file, find the "Today's Meetings & Briefs" section (around line 1257-1306). Find:

```typescript
                              {meeting.generatedBrief && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {meeting.generatedBrief}
                                </p>
                              )}
```

Replace with:

```typescript
                              {meeting.generatedBrief && (() => {
                                const sb = parseStructuredBrief(meeting.generatedBrief);
                                return sb ? (
                                  <div className="mt-1 space-y-0.5">
                                    <p className="text-xs text-foreground/70 line-clamp-1">
                                      {sb.meetingGoal.statement}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {sb.conversationStarters.length} conversation starters ready
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                    {meeting.generatedBrief}
                                  </p>
                                );
                              })()}
```

- [ ] **Step 4: Verify dashboard compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "dashboard" || echo "No errors"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(brief): enhance dashboard meeting cards with structured brief previews"
```

---

### Task 8: Increase LLM Token Limit for Structured Briefs

**Files:**
- Modify: `src/lib/services/llm-core.ts`

The structured brief JSON is larger than the old markdown brief. The current `callLLM` uses `max_tokens: 2000` which may truncate the response.

- [ ] **Step 1: Increase max_tokens in callLLM**

In `src/lib/services/llm-core.ts`, find:

```typescript
      max_tokens: 2000,
```

in the `callLLM` function and replace with:

```typescript
      max_tokens: 4000,
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/llm-core.ts
git commit -m "chore: increase LLM max_tokens to 4000 for structured brief output"
```

---

### Task 9: Manual Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Navigate to a meeting detail page**

Open `http://localhost:3000/meetings/mtg-034` (or any meeting ID from the seed data).

- [ ] **Step 3: Generate a new structured brief**

Click "Generate Brief" and verify:
- The LLM returns structured JSON (check browser Network tab)
- The page renders the hero card with Meeting Goal, Primary Contact in 3 Bullets, and Conversation Starters
- The Detailed Prep section shows News Insights, Executive Profile, Relationship History, and Also Attending
- Copy Brief copies formatted text (not JSON)
- Regenerate Brief works

- [ ] **Step 4: Check backward compatibility**

Navigate to a meeting that has an existing legacy markdown brief. Verify it still renders with `MarkdownPreview` in the old layout.

- [ ] **Step 5: Check dashboard enhancement**

Navigate to `http://localhost:3000/dashboard`. Verify:
- Meeting cards in Top Nudges feed show "Goal" label with the meeting goal statement for any meetings with structured briefs
- "Today's Meetings & Briefs" card shows the meeting goal one-liner and "3 conversation starters ready" for structured briefs

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(brief): address issues found during manual verification"
```

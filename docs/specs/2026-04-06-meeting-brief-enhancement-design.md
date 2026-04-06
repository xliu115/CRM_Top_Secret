# Meeting Brief Enhancement — Design Spec

**Date:** April 6, 2026
**Branch:** `feat/meeting-brief-enhancement`
**Strategy source:** [Pre-meeting-brief STRATEGY.md](https://github.com/xliu115/Pre-meeting-brief/blob/main/docs/STRATEGY.md)

## Problem

The current meeting brief is a generic 6-section markdown blob (Meeting Context, Attendee Insights, Recommended Agenda, Suggested Questions, Risks & Watch-outs, Preparation Checklist). It answers "what data do we have?" instead of "what does the partner need to walk in sharp?"

A partner reading this brief 10 minutes before a meeting must self-synthesize from a data dump. The brief should instead deliver confidence in 90 seconds.

## Scope

**In scope:**
- Restructure the LLM-generated meeting brief from markdown to structured JSON
- Meeting Card (hero layer): Meeting Goal + Success Criteria, Primary Contact in 3 Bullets, 3 Conversation Starters with tactical notes
- Prep Detail layer: Synthesized News Insights, Executive Profile + Recent Moves + Pattern Callout, Relationship History, Also Attending
- Redesign the `/meetings/[id]` detail page to render the structured brief
- Enhance the dashboard meeting card with richer previews from structured data
- Backward compatibility: legacy markdown briefs continue rendering via `MarkdownPreview`

**Out of scope (deferred):**
- Competitive Position visualization (needs reliable data pipeline)
- CEO Psychology Profile
- Potential Landmines
- Company Snapshot / Industry Intel sections
- Post-meeting feedback loop
- Mobile-specific meeting brief page
- Email brief redesign

## Approach

**Structured JSON Brief (Approach A)**: The LLM returns JSON conforming to a typed schema. The `generatedBrief` column stores the JSON string (no schema migration). The frontend detects JSON vs markdown via `JSON.parse` and renders accordingly.

## Structured Brief Schema

```typescript
interface StructuredBrief {
  version: 1;

  // MEETING CARD (90-second hero)
  meetingGoal: {
    statement: string;       // 1-2 sentences, "[Action verb] [what]"
    successCriteria: string; // "Success = [measurable outcome]"
  };

  primaryContactProfile: {
    name: string;      // full name of the primary contact
    bullets: Array<{
      label: string;   // bolded 2-4 word label, e.g. "AI-first CEO"
      detail: string;  // 1-2 sentences of evidence
    }>;               // target 3, may be fewer with emptyReason
    emptyReason?: string; // "Limited public information available for [Name]"
  };

  conversationStarters: Array<{
    question: string;      // in quotes, specific to THIS CEO/company/meeting
    tacticalNote: string;  // italic, max 15 words, explains WHY it works
  }>;                     // exactly 3

  // PREP DETAIL (expandable depth)
  newsInsights: Array<{
    headline: string; // ALL CAPS, max 8 words, states implication not event
    body: string;     // 2-3 sentences connecting news to this meeting
  }>;               // target 3, may be empty
  newsEmptyReason?: string;

  executiveProfile: {
    bioSummary: string;   // 2-3 sentences, career arc not full CV
    recentMoves: Array<{
      date: string;       // e.g. "Mar 2026"
      description: string;
    }>;
    patternCallout?: string; // 2-3 sentences synthesizing the activity pattern
  };

  relationshipHistory: {
    temperature: "COLD" | "COOL" | "WARM" | "HOT";
    summary: string;     // 1-2 sentences on relationship state
    engagements: Array<{
      period: string;    // e.g. "2024-2025"
      description: string;
    }>;
  };

  attendees: Array<{
    name: string;
    title: string;      // abbreviated, e.g. "VP, R&D Strategy"
    initials: string;   // "JS"
  }>;
}
```

**Version field** enables future schema evolution. **Empty reasons** provide graceful degradation when data is thin.

## Meeting Detail Page Layout

Redesign of `/meetings/[id]` from three flat cards to a two-layer progressive disclosure architecture.

**Page structure (top to bottom):**

1. **Back nav** — unchanged
2. **Meeting Header Card** — title, formatted date/time, attendee count, freshness indicator (green dot <24h, yellow 24-48h, red >48h since generation)
3. **Meeting Card (Hero)** — single Card component with internal sections:
   - Meeting Goal banner (highlighted background, statement + success criteria)
   - Primary Contact in 3 Bullets (bolded labels + evidence text)
   - 3 Conversation Starters (quoted questions + italic tactical notes beneath each)
4. **"Detailed Prep" divider** — visual separator with section label
5. **Prep Detail sections** (each its own Card, default expanded):
   - Synthesized News Insights — 3 insight cards with ALL CAPS headlines and body text
   - Executive Profile — bio summary, reverse-chronological recent moves list, optional yellow pattern callout box
   - Relationship History — temperature indicator (COLD/COOL/WARM/HOT as colored bar), summary text, engagement timeline
   - Also Attending — chip grid of attendee name + abbreviated title + initials avatar
6. **Actions** — Regenerate Brief button, Copy Brief (copies a formatted plain-text version of the structured brief, not raw JSON), share options

**Backward compatibility:** If `generatedBrief` does not parse as JSON with `version: 1`, the page renders the legacy layout: single "Meeting Brief" Card with `MarkdownPreview`.

**Generate/Regenerate flow:** Button triggers `POST /api/meetings/[id]/brief`, which now returns structured JSON. The response replaces local state and the page re-renders with the structured layout.

## Dashboard Meeting Card Enhancement

**"Today's Meetings & Briefs" card** (per meeting row):
- Meeting title + time + company — unchanged
- Prep status badge: "Brief ready" (green) / "Prep needed" (amber) — unchanged
- When brief is structured JSON: show `meetingGoal.statement` as a one-liner preview + "3 conversation starters ready" count chip + "View full brief" link
- When brief is legacy markdown: fall back to current one-line truncation

**Top Nudges feed** (meeting prep items):
- When structured: show meeting goal as preview instead of raw brief truncation
- Label changes from "Brief" to "Goal" for structured briefs, remains "Brief"/"Purpose" for legacy

## LLM Prompt Design

### System Prompt

Replace the current generic "expert meeting preparation assistant" with:

> You are a trusted chief of staff preparing a senior consulting partner for a specific meeting. Your job is to make them walk in feeling sharp and confident — not to dump data.

Key instructions:
- Output strict JSON matching the StructuredBrief schema
- Meeting Goal must include a concrete success criteria evaluable post-meeting
- Primary contact bullets must start with a bolded 2-4 word label; never include LinkedIn vanity metrics or generic title descriptions; prioritize recent actions, public statements, and decision patterns
- Conversation Starters must be specific to THIS CEO, THIS company, THIS meeting; if a question could be asked to any CEO in the same industry, it fails; each question gets a tactical note (max 15 words) explaining WHY it works strategically
- News insights must state the implication for the upcoming meeting, not just the event; format: "[Fact] + [What it means] = [Your play]"
- Executive profile focuses on career arc and recent moves, not full CV
- Relationship history synthesizes engagement patterns into a temperature reading
- When data is thin, use explicit empty reasons rather than generating low-quality content

### Context Assembly

Enhanced `MeetingBriefContext` (same interface, richer prompt construction):
- `meetingTitle`, `meetingPurpose` — unchanged
- `attendees[]` with `name`, `title`, `company`, `recentInteractions`, `signals` — unchanged
- The prompt instructs the LLM to synthesize all available data into the structured sections, acknowledging gaps via empty states

### JSON Validation

1. Parse LLM response as JSON
2. Validate: `version === 1`, required fields present, array lengths reasonable
3. If parsing fails: retry once with a correction prompt ("Your response was not valid JSON. Please output only the JSON object.")
4. If still fails: fall back to the existing `generateBriefTemplate()` markdown fallback
5. Store the validated JSON string in `generatedBrief` column

### Backward Compatibility

The `generatedBrief` column remains a nullable string. Detection logic:

```typescript
function parseStructuredBrief(raw: string | null): StructuredBrief | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1 && parsed?.meetingGoal) return parsed;
    return null;
  } catch {
    return null;
  }
}
```

If `parseStructuredBrief` returns `null`, the UI renders with `MarkdownPreview`. If it returns a `StructuredBrief`, the UI renders the structured layout.

## Component Architecture

New components to create:

| Component | Location | Purpose |
|-----------|----------|---------|
| `StructuredBriefCard` | `src/components/meetings/structured-brief-card.tsx` | The 90-second hero card (goal + CEO bullets + conversation starters) |
| `PrepDetailSection` | `src/components/meetings/prep-detail-section.tsx` | Wrapper for each collapsible prep detail section |
| `NewsInsightsCard` | `src/components/meetings/news-insights-card.tsx` | 3 insight cards with headlines and body |
| `ExecutiveProfileCard` | `src/components/meetings/executive-profile-card.tsx` | Bio + recent moves + pattern callout |
| `RelationshipHistoryCard` | `src/components/meetings/relationship-history-card.tsx` | Temperature bar + timeline |
| `AttendeeChipGrid` | `src/components/meetings/attendee-chip-grid.tsx` | Chip grid for attendees |
| `FreshnessIndicator` | `src/components/meetings/freshness-indicator.tsx` | Green/yellow/red dot based on brief age |

Modified files:

| File | Changes |
|------|---------|
| `src/app/meetings/[id]/page.tsx` | Restructure to use new components, add JSON detection |
| `src/lib/services/llm-meeting.ts` | Replace prompt with structured JSON prompt, add validation |
| `src/app/api/meetings/[id]/brief/route.ts` | No changes needed (already stores string) |
| `src/app/dashboard/page.tsx` | Enhance meeting card preview with structured data |

## Files Affected Summary

**New files (7):**
- `src/components/meetings/structured-brief-card.tsx`
- `src/components/meetings/prep-detail-section.tsx`
- `src/components/meetings/news-insights-card.tsx`
- `src/components/meetings/executive-profile-card.tsx`
- `src/components/meetings/relationship-history-card.tsx`
- `src/components/meetings/attendee-chip-grid.tsx`
- `src/components/meetings/freshness-indicator.tsx`

**Modified files (3):**
- `src/app/meetings/[id]/page.tsx`
- `src/lib/services/llm-meeting.ts`
- `src/app/dashboard/page.tsx`

**Shared type + utils (1):**
- `src/lib/types/structured-brief.ts` — the `StructuredBrief` interface, `parseStructuredBrief` utility, and `formatBriefAsText` function (for clipboard copy)

# Concise Narrative Morning Brief — Design Spec

**Date:** 2026-04-06
**Status:** Draft
**Branch:** TBD (will be created at implementation)

## Problem

The narrative morning briefing on the dashboard feels like a wall of text. It is ~250 words of flowing prose with no visual hierarchy — bold is used sparingly, and bullet points are explicitly forbidden by the LLM prompt. Users want the same content coverage but in a format they can scan in under a minute.

## Goal

Rewrite the narrative briefing to be **concise, scannable, and conversational**: bold headline + short bullet sections with a warm "chief of staff" voice. Keep both the Narrative and Structured tabs; only the Narrative view changes.

## Design

### Output Format

The new narrative follows this structure:

1. **Bold headline sentence** — names the single most important action and why. If a campaign approval exists, the headline is about the campaign. Otherwise, it's about the top-priority contact nudge.
2. **Bullet sections** grouped by category (only sections with data appear):
   - **Priority contacts** — who, company, days-since, why to reach out
   - **Campaign approvals** — campaign name, pending count, deadline
   - **Meetings** — title, time, key attendees, optional prep note
   - **On the radar** — notable client news
3. **`---ACTIONS---` JSON block** — unchanged from today (3 CTA actions)

### Voice and Tone

- Each bullet is a short, natural sentence — like a colleague briefing you verbally.
- Uses "you/your" voice: "hasn't heard from you in 94 days" not "94 days since last contact."
- The headline is warm and personal, not a subject line.
- Total target: **100-150 words** (down from ~250).

### Example Output

```markdown
**Reach out to Sarah Chen at Acme Corp today — it's been 94 days, and she just moved to VP of Strategy.**

**Priority contacts**
- **Sarah Chen** at **Acme Corp** hasn't heard from you in **94 days**. Her new role is a natural reason to reconnect.
- **James Park** at **Globex** attended your event last week — a quick follow-up would keep the momentum going.

**Meetings**
- You've got **"Q2 Pipeline Review"** at **10:30 AM** with **Sarah Chen** and **Tom Liu**. Worth reviewing the brief beforehand.

**On the radar**
- **Acme Corp** announced a new VP of Strategy — could be an intro opportunity for your team.
```

## Changes

### 1. LLM System Prompt (`src/lib/services/llm-briefing.ts`)

**`NARRATIVE_SYSTEM_PROMPT` (line 97)** — full rewrite.

Current constraints to remove:
- "Write flowing prose, 3-4 short paragraphs"
- "NO bullet points, NO headers"
- "Keep it under 250 words"

New constraints:
- Open with one bold headline sentence naming the most important action.
- Use short bullet sections grouped by category (Priority contacts, Campaign approvals, Meetings, On the radar). Only include sections that have data.
- Write each bullet as a short, natural sentence — like a colleague briefing you verbally. Not a data dump.
- Use "you/your" voice.
- Bold: contact names (first mention), company names, days-since numbers, meeting titles, campaign names, deadlines.
- Total length: 100-150 words.
- Do NOT write flowing paragraphs. Use bullets.
- Campaign approval handling stays the same (call out explicitly, mention campaign name, pending count, deadline).
- `---ACTIONS---` JSON format stays exactly the same.

### 2. Fallback Template (`src/lib/services/llm-briefing.ts`)

**`generateNarrativeTemplate` function (line 268)** — rewrite to produce bullet format.

Same logic and priority ordering:
1. Campaign approvals first (if any)
2. Top contact nudge as headline
3. Remaining contacts as bullets
4. Meetings
5. Client news as "on the radar"

Output format changes from multi-paragraph prose to:
- Bold headline sentence
- Bullet sections with bold labels

### 3. Frontend Spacing (optional, minor) (`src/app/dashboard/page.tsx`)

The `MarkdownContent` component (line 992) already renders markdown bullets and bold. May need a small spacing adjustment to ensure bullet lists have comfortable breathing room. Check and adjust if needed — likely just adding `space-y-1` or `prose-sm` to the wrapper.

## What Does NOT Change

- **Structured view** — completely untouched
- **Briefing API route** (`src/app/api/dashboard/briefing/route.ts`) — unchanged
- **`NarrativeBriefingContext` type** — unchanged
- **`parseNarrativeResponse` function** — unchanged (splits on `---ACTIONS---`)
- **`resolveDeeplink` and `buildFallbackActions`** — unchanged
- **CTA action buttons** — unchanged
- **`---ACTIONS---` JSON format** — unchanged

## Scope

Two files change:
- `src/lib/services/llm-briefing.ts` — prompt rewrite + fallback template rewrite
- `src/app/dashboard/page.tsx` — possible minor CSS spacing tweak

No new components, no new dependencies, no API changes.

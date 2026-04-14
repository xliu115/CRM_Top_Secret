# Strategic Nudge Insights

**Date:** 2026-04-14
**Status:** Design
**Scope:** Contact nudges only (STALE_CONTACT, JOB_CHANGE, COMPANY_NEWS, LINKEDIN_ACTIVITY, EVENT types, ARTICLE_READ)

## Problem

The current nudge system is data-reporting. A nudge for Craig Federighi reads:

> Apple is in the news: "Apple's biggest week of 2026: MacBook Neo, iPhone 17e..." There's been an executive change at Apple -- "Apple names new CTO." It's been 42 days since your last conversation. This is a good moment to reach out with a company update note.

This is a list of data points with a generic CTA. It tells the Partner *what happened* but not *what it means* or *what specifically to do about it*.

## Solution

A new LLM synthesis layer transforms raw signal data into strategic intelligence:

1. **Strategic narrative** (3-5 sentences) -- what this person is likely thinking, what pressures they face, and why now is the right moment to engage.
2. **Suggested action** -- a specific, labeled action ("Reach out to Craig about Apple's AI transformation roadmap") that generates a contextually-rich draft email.
3. **Evidence citations** -- the underlying data signals, accessible via an expandable "Show Evidence" section one click away.

Target output example:

> Craig Federighi is likely focused on navigating a pivotal moment for Apple's software organization. With growing external pressure around AI -- especially Siri's perceived lag -- he's prioritizing how to close the capability gap and reassert Apple's innovation leadership. At the same time, recent leadership changes (new CTO) introduce internal realignment, adding complexity to decision-making and execution. Your last conversation was 42 days ago about digital transformation -- this is a natural moment to reconnect around how Apple defines its next era.

CTA: **"Reach out about Apple's AI transformation"** --> generates a draft email with the strategic context baked in.

Evidence (expandable): 3 news articles, 1 job change signal, stale contact data.

---

## Architecture

### Data flow

```
refreshNudgesForPartner()          (existing, unchanged)
  |
  v
Rule-based Insight[] generation    (existing, unchanged)
  |
  v
Nudge row created in DB            (existing metadata.insights)
  |
  v
generateStrategicInsight()         (NEW -- post-creation hook)
  |  reads: metadata.insights, contact profile, interactions,
  |         signals, web news, company context
  |
  v
callLLMJson() --> gpt-4o-mini      (NEW)
  |
  v
Store in Nudge.metadata            (extends existing JSON, no schema migration)
```

### Where it runs

The `generateStrategicInsight()` service is called inside `refreshNudgesForPartner()` after the nudge rows are created. It runs for each contact nudge whose `ruleType` is in the eligible set. The existing rule engine is untouched -- it continues to produce `Insight[]` for signal detection, priority ranking, and the metadata backbone.

### Eligible nudge types

Only contact-anchored nudge types get strategic insight synthesis:

- STALE_CONTACT
- JOB_CHANGE
- COMPANY_NEWS
- LINKEDIN_ACTIVITY
- UPCOMING_EVENT
- EVENT_ATTENDED
- EVENT_REGISTERED
- ARTICLE_READ
- MEETING_PREP

Excluded (workflow nudges that don't benefit from strategic framing):

- CAMPAIGN_APPROVAL
- ARTICLE_CAMPAIGN
- FOLLOW_UP (sequence-managed, has its own cadence context)
- REPLY_NEEDED (inbound email context is sufficient)

### Timing

Pre-computed at refresh time. Every eligible nudge gets its strategic insight generated before the user sees it. This means:

- Zero latency when the user opens the nudge tab or dashboard
- Token cost is bounded by the number of nudges generated per refresh (typically 5-15 per partner)
- Failed LLM calls fall back to the current `buildSummaryFragments()` output

---

## Enhanced Metadata Schema

The existing `Nudge.metadata` JSON string is extended. No Prisma schema migration needed.

```typescript
interface EnhancedNudgeMetadata {
  // Existing -- unchanged
  insights: Insight[];

  // New -- strategic synthesis
  strategicInsight?: {
    narrative: string;           // 3-5 sentences, full strategic synthesis
    oneLiner: string;            // 15-20 word summary for compact surfaces (SMS, tooltips)

    suggestedAction: {
      label: string;             // CTA button text, e.g. "Reach out about Apple's AI transformation"
      context: string;           // Rich context paragraph passed to email draft LLM
      emailAngle: string;        // 2-4 word topic, e.g. "AI transformation roadmap"
    };

    evidenceCitations: {
      claim: string;             // Key claim from the narrative
      insightTypes: string[];    // Which Insight types support this claim
      signalIds: string[];       // ExternalSignal IDs
      sourceUrls: string[];      // Direct URLs to news articles, LinkedIn, etc.
    }[];

    generatedAt: string;         // ISO timestamp
  };
}
```

---

## New Service: `llm-insight.ts`

New file: `src/lib/services/llm-insight.ts`

### System prompt

```
You are a senior strategic advisor briefing a consulting Partner about a key
executive in their client portfolio. Your job is to synthesize raw CRM signals
into a narrative about what this person is likely thinking, what pressures they
face, and why now is the right moment to engage.

Rules:
- Never list data points. Connect them into a strategic story.
- If multiple signals exist (job change + news + stale relationship), explain
  what that combination means for the person's priorities and decision-making.
- Ground every claim in the provided evidence. Do not fabricate.
- End with a natural bridge to why outreach makes sense right now.
- Write in flowing prose, 3-5 sentences. No bullet points, no headers.
- Use **bold** for key names, companies, and pivotal facts.
- When the data is thin (e.g. only a stale contact signal), keep the narrative
  short and honest rather than speculating.

Output JSON:
{
  "narrative": "3-5 sentences of strategic synthesis...",
  "oneLiner": "15-20 word summary for compact displays...",
  "suggestedAction": {
    "label": "Specific CTA button text (under 60 chars)...",
    "context": "Rich paragraph the email draft LLM should use as its prompt context...",
    "emailAngle": "2-4 word topic..."
  },
  "evidenceCitations": [
    {
      "claim": "key claim from the narrative",
      "insightTypes": ["COMPANY_NEWS", "JOB_CHANGE"],
      "signalIds": ["signal-id-1"],
      "sourceUrls": ["https://..."]
    }
  ]
}
```

### User prompt structure

Built from:
- Contact profile: name, title, company, industry, importance, notes
- Recent interactions: last 5-10 with dates, types, summaries, sentiment
- All raw `Insight[]` from the nudge engine (the full array from metadata)
- Relevant external signals with full content text and URLs
- Web news about the company (from Tavily ingestion)
- Relationship staleness data (days since last contact, threshold)

### Function signature

```typescript
export async function generateStrategicInsight(
  nudge: NudgeWithRelations,
  insights: Insight[],
  partnerName: string,
): Promise<StrategicInsight | null>
```

The function loads additional context internally:
- `interactionRepo.findByContactId(nudge.contactId)` -- last 10 interactions
- `signalRepo.findByContactId(nudge.contactId)` + `signalRepo.findByCompanyId(nudge.contact.companyId)` -- recent signals with full content and URLs
- Contact profile fields from `nudge.contact` (name, title, company, importance, notes)

This keeps the caller simple while giving the LLM the full picture. The function handles its own data loading, LLM call, JSON parsing, and error handling.

Returns `null` on LLM failure (triggers fallback to current behavior).

### Integration point

In `nudge-engine.ts`, after `nudgeRepo.createMany(candidates)`, iterate over the created nudges and call `generateStrategicInsight()` for eligible types. Update the metadata JSON with the result.

```typescript
// After nudge creation in refreshNudgesForPartner()
const createdNudges = await nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" });
const eligibleTypes = new Set([
  "STALE_CONTACT", "JOB_CHANGE", "COMPANY_NEWS", "LINKEDIN_ACTIVITY",
  "UPCOMING_EVENT", "EVENT_ATTENDED", "EVENT_REGISTERED", "ARTICLE_READ", "MEETING_PREP",
]);

await Promise.all(
  createdNudges
    .filter((n) => eligibleTypes.has(n.ruleType))
    .map(async (nudge) => {
      const meta = JSON.parse(nudge.metadata ?? "{}");
      const insight = await generateStrategicInsight(nudge, meta.insights ?? [], partnerName);
      if (insight) {
        meta.strategicInsight = insight;
        await nudgeRepo.update(nudge.id, { metadata: JSON.stringify(meta) });
      }
    })
);
```

---

## Surface Changes

### Surface 1: Nudge Tab (`/nudges/page.tsx`) -- PRIMARY

**File:** `src/app/nudges/page.tsx`

**Current:** `NudgeCard` renders `buildSummaryFragments()` via `FragmentText` inside an "Insights" box. CTA buttons use generic labels from `NUDGE_TYPE_CONFIG` (e.g., "Draft Check-in"). `DraftEmailPanel` passes `nudge.reason` to the email API.

**Changes:**

In `NudgeCard` (for non-campaign, non-sequence nudges):

1. **Insight block:** Check `meta.strategicInsight`. If present, render `narrative` as prose text (with markdown bold support) instead of `FragmentText`. If absent, fall back to current `FragmentText` behavior.

2. **Evidence section:** Add a collapsible "Show Evidence" toggle below the narrative. When expanded, render the raw `insights[]` grouped by type with signal content and source URLs. Reuse the pattern from `NudgeEvidence` component in chat, adapted for card context.

3. **CTA button:** Use `suggestedAction.label` as the button text instead of the generic `cfg.ctaLabel`. Clicking still opens `DraftEmailPanel`, but the panel passes `suggestedAction.context` to the `/api/nudges/[id]/draft-email` endpoint.

4. **Draft email API change:** `POST /api/nudges/[id]/draft-email` reads `strategicInsight.suggestedAction.context` from metadata and passes it as `nudgeReason` to `generateEmail()`. Falls back to `nudge.reason` if not present.

### Surface 2: Contact Detail (`/contacts/[id]/page.tsx`) -- HIGH

**File:** `src/app/contacts/[id]/page.tsx`

**Current:** `ContactNudgeCard` uses `buildSummaryFragments()` + `FragmentText`. `ContactNudgeDraftPanel` calls `/api/nudges/[id]/draft-email`.

**Changes:**

Same pattern as Surface 1:

1. Render `strategicInsight.narrative` in the insight box when available, fall back to `FragmentText`.
2. Add collapsible evidence section.
3. Use `suggestedAction.label` for the CTA button.
4. `ContactNudgeDraftPanel` benefits from the same draft email API change (passes through to the same endpoint).

### Surface 3: Dashboard Feed (`/dashboard/page.tsx`) -- HIGH

**File:** `src/app/dashboard/page.tsx`

**Current:** Top nudges feed renders per-nudge cards with `buildSummaryFragments()`. CTA is "Take action" link to chat.

**Changes:**

1. In the feed card rendering (around line 1419), check for `strategicInsight.narrative` and render it instead of `FragmentText`.
2. Replace "Take action" text with `suggestedAction.label` when available.
3. Add a compact evidence toggle (or just show signal type chips, since dashboard cards are more compact).
4. The "Take action" link to chat should include the `suggestedAction.label` as the query param so chat opens with context.

### Surface 4: Digest Email (`email-service.ts`) -- HIGH

**File:** `src/lib/services/email-service.ts`

**Current:** `buildSummaryHtml()` calls `buildSummaryFragments()` and renders as HTML. CTA links to `/nudges`.

**Changes:**

1. In `buildSummaryHtml()`, check for `strategicInsight` in parsed metadata. If present, render `narrative` as the email body for that nudge row (with bold styling preserved). Fall back to current fragment rendering.
2. In `buildNudgeRow()`, use `suggestedAction.label` as the CTA link text.
3. Deep-link CTA to `/chat?nudgeId=ID&q=<suggestedAction.label encoded>` so clicking goes directly to action.

### Surface 5: Chat Interface (`api/chat/route.ts`) -- MEDIUM

**Files:** `src/app/api/chat/route.ts`, `src/lib/services/rag-service.ts`

**Current:** RAG path passes `"Name (Company): reason"` as flat source docs. `nudge_summary` intent rebuilds markdown from `buildSummaryFragments`. Draft email uses `nudge.reason`.

**Changes:**

1. **RAG path** (`rag-service.ts`): When building `RetrievedDoc` for nudges, use `strategicInsight.narrative` as the `content` field instead of the raw `reason`. This gives the chat LLM strategic framing when answering questions about contacts.

2. **`nudge_summary` intent** (`route.ts`): When the nudge has `strategicInsight`, use the pre-generated narrative as the markdown answer instead of rebuilding from fragments. Emit a `nudge_evidence` block with the raw insights (the block type and renderer already exist but are never emitted -- wire them up).

3. **Draft email intent**: When drafting from a nudge context, read `strategicInsight.suggestedAction.context` from metadata and pass it as `nudgeReason` to `generateEmail()`.

4. **`action_bar` blocks**: Use `suggestedAction.label` for the primary action label instead of the generic `NUDGE_TYPE_QUICK_ACTION` mapping.

### Surface 6: Morning Briefing Narrative (`llm-briefing.ts`) -- MEDIUM

**File:** `src/lib/services/llm-briefing.ts`

**Current:** `formatNudgeBlockForPrompt()` passes raw `reason` + priority + last-touch to the briefing LLM, which re-synthesizes from scratch.

**Changes:**

1. In `formatNudgeBlockForPrompt()`, when a nudge has `strategicInsight`, pass the `narrative` and `suggestedAction.label` instead of (or alongside) the raw reason. This gives the briefing LLM pre-synthesized strategic context to work with rather than re-deriving it.

2. The `---ACTIONS---` JSON output should prefer `suggestedAction.label` for `actionLabel` and `suggestedAction.emailAngle` for `detail`, with the nudge's `narrative` as additional context.

Format change for prompt line:
```
// Before
- [HIGH] Craig Federighi (Apple): 3 reasons to reach out... [type: COMPANY_NEWS]

// After
- [HIGH] Craig Federighi (Apple): Craig is likely focused on navigating a pivotal
  moment for Apple's software organization... [suggested: Reach out about Apple's
  AI transformation] [type: COMPANY_NEWS]
```

### Surface 7: Morning Briefing Structured (`structured-briefing.ts`) -- LOW

**File:** `src/lib/services/structured-briefing.ts`

**Current:** `buildDataDrivenSummaryMarkdown()` uses raw `reason` and `lastContactedLabel`.

**Changes:**

1. In the "Who to contact" section, when a nudge has `strategicInsight`, use `oneLiner` for the contact's "why" line and `suggestedAction.label` as the action hint.

### Surface 8: Digest SMS (`sms-service.ts`) -- LOW

**File:** `src/lib/services/sms-service.ts`

**Current:** Emoji + contact name + rule type label + truncated raw `reason`.

**Changes:**

1. In `buildDigestSms()`, when a nudge has `strategicInsight`, use `oneLiner` instead of the truncated `reason`.
2. Append `suggestedAction.emailAngle` as a hint: `"-> Re: AI transformation"`.

Format change:
```
// Before
🔴 Craig Federighi (Company News)
   Apple's biggest week of 2026: MacBook Neo, iPhone 17e...

// After
🔴 Craig Federighi
   Pivotal AI moment at Apple, good time to reconnect
   → Re: AI transformation
```

---

## Shared UI Components

### `StrategicInsightBlock` (new component)

New file: `src/components/nudges/strategic-insight-block.tsx`

A shared component used by NudgeCard, ContactNudgeCard, and dashboard feed cards.

Props:
```typescript
interface StrategicInsightBlockProps {
  strategicInsight: StrategicInsight;
  insights: InsightData[];           // Raw insights for evidence section
  nudge: NudgeForSummary;           // Fallback data
  compact?: boolean;                 // Dashboard uses compact mode
}
```

Behavior:
- Renders `narrative` as prose with markdown bold support
- Shows signal type chips (existing pattern)
- "Show Evidence" collapsible section with insights grouped by type, signal content, and source URLs
- Falls back to `FragmentText` + `buildSummaryFragments()` when `strategicInsight` is absent

### `SuggestedActionButton` (new component)

New file: `src/components/nudges/suggested-action-button.tsx`

Props:
```typescript
interface SuggestedActionButtonProps {
  suggestedAction: StrategicInsight["suggestedAction"];
  nudgeId: string;
  contactId: string;
  fallbackLabel: string;             // Current cfg.ctaLabel as fallback
  onDraftEmail?: () => void;         // Opens draft panel
}
```

Behavior:
- Shows `suggestedAction.label` as button text when available, falls back to `fallbackLabel`
- Click behavior unchanged (opens draft panel or navigates to chat)

---

## Draft Email Enhancement

### API change: `POST /api/nudges/[id]/draft-email`

**File:** `src/app/api/nudges/[id]/draft-email/route.ts`

The route already loads the nudge and passes `nudge.reason` to `generateEmail()`. Change:

1. Parse `nudge.metadata` for `strategicInsight.suggestedAction.context`.
2. If present, pass it as `nudgeReason` to `generateEmail()` instead of the raw `reason`.
3. This means the email draft LLM receives strategic context like "Craig is navigating Apple's AI transformation, with growing pressure around Siri's capabilities and a new CTO appointment..." rather than "3 reasons to reach out to Craig Federighi at Apple: company news, executive transition, and overdue for a check-in."

The `generateEmail()` function in `llm-email.ts` itself does not change -- it already accepts `nudgeReason` as a string and uses it in the prompt.

---

## Fallback Strategy

Every surface must degrade gracefully when `strategicInsight` is absent:

| Condition | Behavior |
|-----------|----------|
| `strategicInsight` present | Render narrative, smart CTA, evidence section |
| `strategicInsight` absent (LLM failure) | Render current `buildSummaryFragments()` output, generic CTA |
| `OPENAI_API_KEY` not set | `generateStrategicInsight()` returns `null`, all nudges use current behavior |
| Nudge type not eligible | No strategic insight generated, current behavior preserved |

---

## Performance and Cost

### Token usage estimate

Per nudge insight generation:
- Input: ~800-1200 tokens (contact profile + interactions + signals + insights)
- Output: ~300-500 tokens (JSON with narrative + action + citations)
- Model: gpt-4o-mini (cost-efficient, adequate quality for synthesis)

Per partner refresh (typical 5-15 eligible nudges):
- Estimated: 5,000-15,000 input tokens + 1,500-5,000 output tokens
- Cost at gpt-4o-mini rates: ~$0.001-0.003 per partner refresh

### Latency impact

Strategic insight generation runs after nudge creation. With `Promise.all()` for parallel generation across nudges:
- Per nudge: ~1-2 seconds LLM latency
- Total added to refresh: ~2-3 seconds (parallel, bounded by slowest call)
- User-visible impact: none (pre-computed before page load)

### Caching

Strategic insights are stored in metadata and persist until the next nudge refresh. They are not regenerated on page load. The `generatedAt` timestamp allows the UI to show freshness indicators if needed.

---

## Testing

### Unit tests

- `generateStrategicInsight()` returns valid JSON structure
- `generateStrategicInsight()` returns `null` on LLM failure
- `StrategicInsightBlock` renders narrative when present
- `StrategicInsightBlock` falls back to `FragmentText` when absent
- Evidence section expands/collapses correctly
- `SuggestedActionButton` uses smart label when available, falls back to generic
- `buildSummaryHtml()` uses narrative for email rendering
- `buildDigestSms()` uses `oneLiner` for SMS

### Integration tests

- End-to-end: `refreshNudgesForPartner()` produces nudges with `strategicInsight` in metadata
- Draft email API uses `suggestedAction.context` when present
- Chat `nudge_summary` intent returns narrative + evidence blocks
- Briefing LLM receives strategic context in prompt

---

## Out of Scope

- Changing the rule-based nudge engine logic (signal detection, priority ranking)
- Adding new signal types or data sources
- Changing the nudge data model in Prisma (metadata is already a JSON string)
- Generating strategic insights for FOLLOW_UP, REPLY_NEEDED, CAMPAIGN_APPROVAL, or ARTICLE_CAMPAIGN nudge types
- Real-time streaming of insight generation (pre-computed is sufficient)
- User editing/feedback on generated insights (future enhancement)

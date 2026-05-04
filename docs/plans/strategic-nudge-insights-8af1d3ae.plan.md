---
name: Strategic Nudge Insights
overview: Implement the LLM insight synthesis layer and propagate strategic narratives, evidence sections, and smart CTAs across all 8 surfaces where nudges appear, per the design spec at docs/designs/2026-04-14-strategic-nudge-insights.md.
todos:
  - id: phase-1a
    content: Create llm-insight.ts service with StrategicInsight type, system prompt, user prompt builder, and generateStrategicInsight function
    status: completed
  - id: phase-1b
    content: Register llm-insight.ts in llm-service.ts barrel export
    status: completed
  - id: phase-1c
    content: Add updateMetadata method to nudge repository interface and Prisma implementation
    status: completed
  - id: phase-1d
    content: Integrate generateStrategicInsight into nudge-engine.ts after nudge creation
    status: completed
  - id: phase-2a
    content: Create StrategicInsightBlock component with narrative rendering, fallback, and evidence toggle
    status: completed
  - id: phase-2b
    content: Create SuggestedActionButton component
    status: completed
  - id: phase-2c
    content: Extend NudgeMetadata type on nudges page to include strategicInsight
    status: completed
  - id: phase-3a
    content: Update NudgeCard on /nudges page to use StrategicInsightBlock and SuggestedActionButton
    status: completed
  - id: phase-3b
    content: Update ContactNudgeCard on contact detail page
    status: completed
  - id: phase-3c
    content: Update dashboard feed cards to use strategic insight components
    status: completed
  - id: phase-4a
    content: Update draft-email API route to use suggestedAction.context as nudgeReason
    status: completed
  - id: phase-5a
    content: Update RAG service to use narrative in nudge source docs
    status: completed
  - id: phase-5b
    content: Update chat nudge_summary intent to use pre-generated narrative and emit nudge_evidence block
    status: completed
  - id: phase-5c
    content: Update morning briefing formatNudgeBlockForPrompt to use strategic insight narrative
    status: completed
  - id: phase-6a
    content: Update structured briefing to use oneLiner and suggestedAction
    status: completed
  - id: phase-6b
    content: Update digest SMS to use oneLiner and emailAngle
    status: completed
  - id: phase-6c
    content: Update digest email to use narrative and suggestedAction.label
    status: completed
  - id: phase-7
    content: Write unit tests for llm-insight, integration tests for engine, component tests for new UI
    status: completed
isProject: false
---

# Strategic Nudge Insights -- Implementation Plan

Based on spec: [docs/designs/2026-04-14-strategic-nudge-insights.md](docs/designs/2026-04-14-strategic-nudge-insights.md)

## Phase 1: Core LLM Service + Engine Integration

### 1A. Create `llm-insight.ts`

New file: [src/lib/services/llm-insight.ts](src/lib/services/llm-insight.ts)

- Define `StrategicInsight` type matching the `EnhancedNudgeMetadata.strategicInsight` shape from the spec (narrative, oneLiner, suggestedAction, evidenceCitations, generatedAt)
- Define `STRATEGIC_INSIGHT_SYSTEM_PROMPT` -- the system prompt from the spec that instructs the LLM to synthesize signals into a strategic narrative
- Implement `buildInsightUserPrompt(nudge, insights, partnerName)`:
  - Loads contact profile from `nudge.contact` (name, title, company, importance, notes)
  - Loads last 10 interactions via `interactionRepo.findByContactId(nudge.contactId)`
  - Loads contact signals + company signals via `prisma.externalSignal.findMany()`
  - Formats all raw `Insight[]` with their signalIds and URLs
  - Assembles into a structured prompt string
- Implement `generateStrategicInsight(nudge, insights, partnerName)`:
  - Calls `callLLMJson<StrategicInsight>(systemPrompt, userPrompt)`
  - Validates the response has required fields (narrative, suggestedAction.label, etc.)
  - Adds `generatedAt: new Date().toISOString()`
  - Returns `null` on failure (LLM error, missing key, invalid JSON)
- Pattern to follow: [src/lib/services/llm-contact360.ts](src/lib/services/llm-contact360.ts) (similar context-loading + LLM call + fallback pattern)
- Uses `callLLMJson` from [src/lib/services/llm-core.ts](src/lib/services/llm-core.ts) (line 64-91) with `response_format: { type: "json_object" }`

### 1B. Register in barrel export

In [src/lib/services/llm-service.ts](src/lib/services/llm-service.ts), add:
```
export * from "./llm-insight";
```

### 1C. Add `update` method to nudge repository

The nudge repo currently has no `update` method for arbitrary fields. Add one:

- [src/lib/repositories/interfaces/nudge-repository.ts](src/lib/repositories/interfaces/nudge-repository.ts): Add `updateMetadata(id: string, metadata: string): Promise<void>` to the interface
- [src/lib/repositories/prisma/nudge-repository.ts](src/lib/repositories/prisma/nudge-repository.ts): Implement using `prisma.nudge.update({ where: { id }, data: { metadata } })`

### 1D. Integrate into nudge engine

In [src/lib/services/nudge-engine.ts](src/lib/services/nudge-engine.ts), after line 612 (after `nudgeRepo.createMany(candidates)`):

- Import `generateStrategicInsight` from `llm-insight`
- Define `ELIGIBLE_INSIGHT_TYPES` set (9 contact nudge types from spec)
- Load the partner name (already available via partner lookup or add minimal query)
- Re-fetch the created nudges via `nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" })`
- Filter to eligible types
- `Promise.all()` over eligible nudges, calling `generateStrategicInsight()` for each
- On success, update metadata JSON via `nudgeRepo.updateMetadata()`
- Wrap in try/catch so LLM failures never break the refresh flow

---

## Phase 2: Shared UI Components

### 2A. Create `StrategicInsightBlock`

New file: [src/components/nudges/strategic-insight-block.tsx](src/components/nudges/strategic-insight-block.tsx)

- Props: `strategicInsight`, `insights: InsightData[]`, `nudge: NudgeForSummary`, `compact?: boolean`
- **Primary state:** When `strategicInsight` exists, render `narrative` as prose with inline bold support (parse `**text**` into `<strong>` spans)
- **Fallback state:** When absent, render `<FragmentText fragments={buildSummaryFragments(nudge, insights)} />`
- **Evidence toggle:** `useState<boolean>(false)` for "Show Evidence" / "Hide Evidence"
- **Evidence section:** When expanded, group `insights[]` by type (reuse `INSIGHT_TYPE_LABELS` from [src/lib/utils/nudge-summary.ts](src/lib/utils/nudge-summary.ts)), show signal content + source URLs. Adapt the pattern from [src/components/chat/blocks/nudge-evidence.tsx](src/components/chat/blocks/nudge-evidence.tsx) (groupByType, EvidenceTypeGroup, InsightDetail)
- `compact` mode (for dashboard): hides evidence toggle, shows only narrative

### 2B. Create `SuggestedActionButton`

New file: [src/components/nudges/suggested-action-button.tsx](src/components/nudges/suggested-action-button.tsx)

- Props: `suggestedAction`, `fallbackLabel`, `fallbackIcon`, `onClick`, `variant?`
- Shows `suggestedAction.label` when present (truncated to ~50 chars if needed), otherwise `fallbackLabel`
- Uses the same `Button` component and sizing as existing CTA buttons

### 2C. Extend `NudgeMetadata` type on nudges page

In [src/app/nudges/page.tsx](src/app/nudges/page.tsx) (line 57-61), extend the `NudgeMetadata` type to include optional `strategicInsight` field matching the `StrategicInsight` type. Also extend the local `parseMetadata` function.

---

## Phase 3: Surface Updates (Primary)

### 3A. Nudge Tab -- `NudgeCard`

File: [src/app/nudges/page.tsx](src/app/nudges/page.tsx), `NudgeCard` component (line 423-754)

In the default contact nudge branch (line 610-754):

1. **Replace insight block** (lines 651-659): Swap `<NudgeSummary>` for `<StrategicInsightBlock>` passing `meta.strategicInsight`, `insights`, `nudge`
2. **Replace CTA button** (lines 719-723): Swap `cfg.ctaLabel` for `<SuggestedActionButton>` with `meta.strategicInsight?.suggestedAction` and `fallbackLabel={cfg.ctaLabel}`
3. Keep meeting prep, snooze/done, and panel toggle logic unchanged

### 3B. Contact Detail -- `ContactNudgeCard`

File: [src/app/contacts/[id]/page.tsx](src/app/contacts/[id]/page.tsx), `ContactNudgeCard` (around line 2349)

Same pattern as 3A:
1. Replace the insight box's `<FragmentText>` with `<StrategicInsightBlock>`
2. Replace CTA label with `<SuggestedActionButton>`
3. Extend the local `parseMetadata` to include `strategicInsight`

### 3C. Dashboard Feed

File: [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx), feed card rendering (around line 1419)

1. Replace `<FragmentText fragments={fragments}>` with `<StrategicInsightBlock compact>`
2. Replace "Take action" link text with `suggestedAction.label` when available
3. Update the chat deep-link `q` param to use `suggestedAction.label` as the query
4. Extend local `parseInsights` to also extract `strategicInsight`

---

## Phase 4: Draft Email Enhancement

### 4A. Draft email API route

File: [src/app/api/nudges/[id]/draft-email/route.ts](src/app/api/nudges/[id]/draft-email/route.ts)

At line 52-53, after building `nudgeReason`:

1. Parse `nudge.metadata` for `strategicInsight.suggestedAction.context`
2. If present, replace `nudgeReason` with: `typeContext + "\n\nStrategic context: " + suggestedAction.context`
3. This flows into the existing `generateEmail()` call without changing `llm-email.ts`

---

## Phase 5: Surface Updates (Medium Priority)

### 5A. Chat -- RAG path

File: [src/lib/services/rag-service.ts](src/lib/services/rag-service.ts)

At lines 99-107 (stale/follow-up nudge docs) and lines 169-177 (keyword nudge docs):

1. Parse `n.metadata` for `strategicInsight.narrative`
2. If present, use narrative as the `content` field instead of `n.reason`
3. Format: `"${n.contact.name} (${n.contact.company.name}): ${narrative}"`

### 5B. Chat -- `nudge_summary` intent

File: [src/app/api/chat/route.ts](src/app/api/chat/route.ts), around line 578-705

1. After loading the primary nudge, parse its metadata for `strategicInsight`
2. If present, use `narrative` as the markdown answer body instead of rebuilding from `fragmentsToMarkdown`
3. Emit a `nudge_evidence` block with the raw insights data (the type and renderer already exist in [src/lib/types/chat-blocks.ts](src/lib/types/chat-blocks.ts) and [src/components/chat/blocks/nudge-evidence.tsx](src/components/chat/blocks/nudge-evidence.tsx))
4. Use `suggestedAction.label` for the primary action in `action_bar` block

### 5C. Morning Briefing Narrative

File: [src/lib/services/llm-briefing.ts](src/lib/services/llm-briefing.ts), `formatNudgeBlockForPrompt()` (line 126-142)

1. The nudge context objects passed to this function include `metadata` (string). Parse it.
2. When `strategicInsight` is present, replace the raw `reason` in the prompt line with `narrative` (truncated to ~300 chars to stay within budget)
3. Append `[suggested: ${suggestedAction.label}]` to the prompt line
4. Update `NarrativeBriefingContext["nudges"]` type to include optional `metadata?: string` field (already present in the briefing route builders)

---

## Phase 6: Surface Updates (Low Priority)

### 6A. Structured Briefing

File: [src/lib/services/structured-briefing.ts](src/lib/services/structured-briefing.ts)

In `buildDataDrivenSummaryMarkdown()`, when building "Who to contact" bullets:
1. Parse nudge metadata for `strategicInsight`
2. If present, use `oneLiner` for the "why" line and `suggestedAction.label` as the action hint

### 6B. Digest SMS

File: [src/lib/services/sms-service.ts](src/lib/services/sms-service.ts)

In `buildDigestSms()`:
1. Parse `n.metadata` for `strategicInsight`
2. If present, use `oneLiner` instead of truncated `reason`
3. Append `suggestedAction.emailAngle` as action hint line

### 6C. Digest Email

File: [src/lib/services/email-service.ts](src/lib/services/email-service.ts)

In `buildSummaryHtml()`:
1. Parse metadata for `strategicInsight`
2. If present, render `narrative` as the email body (convert `**bold**` to `<strong>`)
3. In `buildNudgeRow()`, use `suggestedAction.label` as CTA link text
4. Update CTA href to deep-link into chat with the suggested action

---

## Phase 7: Testing

### 7A. Unit test for `llm-insight.ts`

New file: `tests/llm-insight.test.ts`
- Mock `callLLMJson` to return valid/invalid/null responses
- Verify `generateStrategicInsight` returns correct shape on success
- Verify returns `null` on LLM failure
- Verify returns `null` when OpenAI key is missing

### 7B. Integration test for nudge engine

Update `tests/nudge-engine.test.ts`:
- Verify that after `refreshNudgesForPartner()`, eligible nudges have `strategicInsight` in metadata (with LLM mocked)
- Verify non-eligible types (CAMPAIGN_APPROVAL, etc.) do NOT have `strategicInsight`
- Verify refresh still works when LLM returns `null` (fallback path)

### 7C. Component tests

- `StrategicInsightBlock` renders narrative when `strategicInsight` present
- `StrategicInsightBlock` falls back to `FragmentText` when absent
- Evidence toggle expands/collapses
- `SuggestedActionButton` shows smart vs fallback label

---

## Implementation Order and Dependencies

```
Phase 1 (core) ──> Phase 2 (components) ──> Phase 3 (primary surfaces)
                                         ──> Phase 4 (draft email API)
                                         ──> Phase 5 (medium surfaces)
                                         ──> Phase 6 (low surfaces)
                                         ──> Phase 7 (tests)
```

Phases 3-6 are independent of each other and can be parallelized. Phase 2 must complete before Phase 3. Phase 1 must complete before everything else.

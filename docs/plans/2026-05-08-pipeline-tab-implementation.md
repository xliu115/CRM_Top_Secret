# Pipeline tab implementation plan

> **For agentic workers:** Implement task-by-task using the **subagent-driven-development** or **executing-plans** superpowers skill (fresh subagent per task vs batched checkpoints). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder `/pipeline` with the dual-lens Pipeline experience from [docs/superpowers/specs/2026-05-08-pipeline-tab-design.md](../superpowers/specs/2026-05-08-pipeline-tab-design.md): live tab counts, per-tab highlights and `lastViewedAt`, suggestions lifecycle, confirmed vs draft rows, add paths (recommendations, voice, upload, manual), lane filters collapsed by default, mark-as-seen, and copy-summary escape hatch—without playbook/vs-target UI.

**Architecture:** Persist partner-scoped pipeline entities in SQLite via Prisma; expose JSON APIs under `src/app/api/pipeline/…` using `requirePartnerId()` like `src/app/api/dashboard/route.ts`. Server modules own ranking/suggestion rules and change-log writes; the page is a client shell that syncs `?lens=pipeline|clients`, loads board + suggestions + tab state, and posts mutations. Reuse `POST /api/transcribe` for voice; add a small structured-extract step (LLM or heuristic) that returns a draft row for confirm-only commit.

**Tech stack:** Next.js 16 (App Router), React 19, Prisma + SQLite, Vitest, existing shadcn-style UI under `src/components/ui`, NextAuth + `get-current-partner`.

**Canonical spec:** `docs/superpowers/specs/2026-05-08-pipeline-tab-design.md` (§3–§13).

---

## File map (create / modify)

| Area | Create | Modify |
|------|--------|--------|
| Schema | — | `prisma/schema.prisma` |
| Migration | `prisma/migrations/…` (generated) | — |
| Repos | `src/lib/repositories/prisma/pipeline-repository.ts`, `src/lib/repositories/interfaces.ts` (types + `IPipelineRepository`) | `src/lib/repositories/index.ts` |
| Domain | `src/lib/pipeline/stages.ts` (enums + labels), `src/lib/pipeline/tab-counts.ts` (pure: triple from rows), `src/lib/pipeline/suggestion-engine.ts` (rank + material-change), `src/lib/pipeline/change-log.ts` (event builders) | — |
| API | `src/app/api/pipeline/board/route.ts`, `…/rows/route.ts`, `…/rows/[id]/route.ts`, `…/suggestions/route.ts`, `…/suggestions/[id]/route.ts`, `…/tab-state/route.ts`, `…/attachments/route.ts`, `…/summary-text/route.ts` | — |
| UI | `src/components/pipeline/*.tsx` (tabs, highlight band, lanes, row card, add chooser, confirm sheet, filter drawer) | `src/app/pipeline/page.tsx` |
| Hooks | `src/hooks/use-pipeline-board.ts`, `src/hooks/use-pipeline-tab-state.ts` | — |
| Tests | `tests/pipeline-tab-counts.test.ts`, `tests/pipeline-suggestions.test.ts`, `tests/pipeline-permissions.test.ts` | — |
| Seed (demo) | optional `prisma/seed-data/pipeline-rows.ts` | `prisma/seed.ts` if present |
| Dashboard link | — | `src/app/dashboard/page.tsx` Pipeline Pulse card → `/pipeline?lens=pipeline` (if card exists) |

---

### Task 1: Prisma models and migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev --name pipeline_tab_v1`

**Models (v1):**

1. **`PipelineRow`** — `id`, `partnerId` → `Partner`, `lens` (`PIPELINE` \| `CLIENTS`), `stage` (string: use values below), `confirmationStatus` (`DRAFT` \| `CONFIRMED`), `title` (string), `workingTitle` (optional), `companyId` (optional FK), `contactId` (optional FK), `nextStep` (optional), `provenance` (`manual` \| `system` \| `voice` \| `upload`), `tags` (JSON string array, default `[]`), `dropOffReason` (optional, for archive/remove), `archivedAt` (DateTime?), `createdAt`, `updatedAt`. Index: `[partnerId, lens, confirmationStatus]`, `[partnerId, lens, stage, confirmationStatus]`.

2. **`PipelineSuggestion`** — `id`, `partnerId`, `type` (`NEW_ROW` \| `STAGE_MOVE` \| `HYGIENE`), `targetRowId` (optional), `payload` (JSON: draft fields or proposed stage), `title`, `subtitle` (optional), `whyLine` (string), `rank` (float), `status` (`pending` \| `accepted` \| `dismissed` \| `snoozed`), `snoozedUntil` (DateTime?), `dedupeKey` (string, optional: hash of type+target+payload for idempotency), `createdAt`, `updatedAt`. Index `[partnerId, status]`.

3. **`PipelineTabState`** — composite unique `(partnerId, tabKey)` where `tabKey` is `pipeline` \| `clients`; fields `lastViewedAt` (DateTime?), `highlightCollapsedUntil` (DateTime?, optional session dismiss).

4. **`PipelineEvent`** (change log) — `id`, `partnerId`, `rowId` (optional), `eventType` (`ROW_CREATED` \| `ROW_CONFIRMED` \| `STAGE_CHANGED` \| `ROW_ARCHIVED` \| `ROW_RESTORED` \| `ATTACHMENT_ADDED` \| `SUGGESTION_OUTCOME`), `payload` (JSON), `createdAt`. Index `[partnerId, createdAt]`.

5. **`PipelineAttachment`** — `id`, `partnerId`, `rowId`, `fileName`, `mimeType`, `sizeBytes`, `storageKey` (or inline path for local dev), `createdAt`. Virus scan: v1 document as “best-effort / future hook”; enforce MIME allowlist + max size in API.

**Stage values (store as string, validate in TS):**

- Pipeline lens: `active_engagements` | `lops_in_discussion` | `serious_discussions`
- Clients lens: `active_clients` | `warm_relationships` | `under_cultivation`

- [ ] **Step 1:** Add models to `schema.prisma` with `@@map` snake_case table names.
- [ ] **Step 2:** Run `npx prisma migrate dev --name pipeline_tab_v1` and `npx prisma generate`.
- [ ] **Step 3:** Commit: `git add prisma && git commit -m "feat(db): pipeline tab core tables"`

---

### Task 2: Pure domain — tab triples and stage validation

**Files:**

- Create: `src/lib/pipeline/stages.ts`
- Create: `src/lib/pipeline/tab-counts.ts`
- Create: `tests/pipeline-tab-counts.test.ts`

**`src/lib/pipeline/stages.ts`** (illustrative — keep in sync with Prisma):

```ts
export const PIPELINE_STAGES = [
  "active_engagements",
  "lops_in_discussion",
  "serious_discussions",
] as const;
export const CLIENT_STAGES = [
  "active_clients",
  "warm_relationships",
  "under_cultivation",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type ClientStage = (typeof CLIENT_STAGES)[number];

export function isPipelineStage(s: string): s is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(s);
}
export function isClientStage(s: string): s is ClientStage {
  return (CLIENT_STAGES as readonly string[]).includes(s);
}
```

**`src/lib/pipeline/tab-counts.ts`:**

```ts
import type { PipelineStage, ClientStage } from "./stages";

export type Lens = "pipeline" | "clients";

type RowLike = {
  lens: Lens;
  stage: string;
  confirmationStatus: "DRAFT" | "CONFIRMED";
  archivedAt: Date | null;
};

export function tabTriple(
  lens: Lens,
  rows: RowLike[]
): [number, number, number] {
  const active = rows.filter(
    (r) =>
      r.lens === lens &&
      r.confirmationStatus === "CONFIRMED" &&
      !r.archivedAt
  );
  const order =
    lens === "pipeline"
      ? (["active_engagements", "lops_in_discussion", "serious_discussions"] as const)
      : (["active_clients", "warm_relationships", "under_cultivation"] as const);
  return order.map((stage) => active.filter((r) => r.stage === stage).length) as [
    number,
    number,
    number,
  ];
}
```

**Test (failing first):** assert triple matches hand-built rows; assert drafts and archived excluded.

- [ ] **Step 1:** Add `tab-counts.test.ts` with 2–3 cases; run `npm test -- tests/pipeline-tab-counts.test.ts` → FAIL (module missing).
- [ ] **Step 2:** Implement `stages.ts` + `tab-counts.ts`; run tests → PASS.
- [ ] **Step 3:** Commit.

---

### Task 3: `IPipelineRepository` + Prisma implementation

**Files:**

- Modify: `src/lib/repositories/interfaces.ts` (add interface + DTO types)
- Create: `src/lib/repositories/prisma/pipeline-repository.ts`
- Modify: `src/lib/repositories/index.ts`

**Interface methods (minimal v1):**

- `listRows(partnerId, lens, { includeArchived?: boolean })`
- `createRow`, `updateRow`, `confirmRow` (DRAFT → CONFIRMED), `setStage`, `archiveRow`, `undoLastStageChange` (if you store last event id — v1 can skip undo and add in fast follow; spec prefers undo — implement via `PipelineEvent` + optional `previousStage` on last `STAGE_CHANGED` within 2 minutes)
- `listPendingSuggestions(partnerId)`, `updateSuggestionStatus`, `createSuggestions` (batch)
- `getTabState`, `upsertTabState` (patch `lastViewedAt`, `highlightCollapsedUntil`)
- `appendEvent`, `listEventsSince(partnerId, lens, since: Date)` for highlight deltas
- `listAttachments(rowId)`, `createAttachment`

Wire `pipelineRepo` in `index.ts` like other repos.

- [ ] **Step 1:** Interface + stub methods throwing `new Error("not implemented")`.
- [ ] **Step 2:** Prisma implementation + manual smoke via small script or `npx tsx` one-liner (optional).
- [ ] **Step 3:** Commit.

---

### Task 4: API — board + tab state + mark seen

**Files:**

- Create: `src/app/api/pipeline/board/route.ts` — `GET`: `{ rows, suggestions, tabState, eventsSinceLastView }` for both tabs or filter by `?lens=`. Partner from `requirePartnerId()`.
- Create: `src/app/api/pipeline/tab-state/route.ts` — `PATCH` body `{ tabKey: "pipeline"|"clients", lastViewedAt?: ISO string, markSeenNow?: boolean, highlightCollapsed?: boolean }`. If `markSeenNow`, set `lastViewedAt = new Date()` for that tab.
- **Idle / leave policy (resolve §11):** Server stores timestamps only; client sends `PATCH markSeenNow` on explicit button (§13), on `visibilitychange` hidden + debounce, and on `beforeunload` (best-effort). **Default idle:** 10 minutes (constant `PIPELINE_LAST_VIEWED_IDLE_MS = 10 * 60 * 1000` in `src/lib/pipeline/constants.ts`); document `PIPELINE_LAST_VIEWED_IDLE_MS` env override if needed later.

- [ ] **Step 1:** Implement GET board (serialize dates ISO).
- [ ] **Step 2:** Implement PATCH tab-state; 401 on missing partner.
- [ ] **Step 3:** Vitest: mock repo or hit pure serializers — at minimum test `tabTriple` consistency endpoint builds same counts as client would (integration optional).
- [ ] **Step 4:** Commit.

---

### Task 5: API — rows CRUD + confirm + stage move

**Files:**

- Create: `src/app/api/pipeline/rows/route.ts` — `POST` create draft or confirmed manual row.
- Create: `src/app/api/pipeline/rows/[id]/route.ts` — `PATCH` (fields, stage with confirm flag in body), `DELETE` archive.

**Rules:**

- Rows from `voice` | `upload` | `system` start as `DRAFT` until `PATCH { confirm: true }`.
- Stage changes append `PipelineEvent` `STAGE_CHANGED`.
- Hygiene archive requires `{ confirm: true }` in body.

- [ ] **Step 1:** POST/PATCH with validation (Zod optional; manual validation acceptable if consistent with repo).
- [ ] **Step 2:** `tests/pipeline-permissions.test.ts`: ensure repository queries always include `partnerId` (mirror patterns from `tests/permissions.test.ts` for row ownership).
- [ ] **Step 3:** Commit.

---

### Task 6: API — suggestions accept / dismiss / snooze

**Files:**

- Create: `src/app/api/pipeline/suggestions/route.ts` — `GET` pending; optional `POST` refresh (regenerate — v1 can noop).
- Create: `src/app/api/pipeline/suggestions/[id]/route.ts` — `PATCH` `{ action: "accept"|"dismiss"|"snooze", snoozeDays?: number, edits?: … }`.

**Dismissal resurfacing:** Implement `materialChangeKey` in `src/lib/pipeline/suggestion-engine.ts`: dismissed suggestion id may reappear only if target row `updatedAt` or relevant `PipelineEvent` after dismiss — store `dismissedAtSnapshot` on suggestion or compare row version.

- [ ] **Step 1:** Implement PATCH actions; accept applies row create/move and marks suggestion `accepted`.
- [ ] **Step 2:** Unit tests in `tests/pipeline-suggestions.test.ts` for material-change helper.
- [ ] **Step 3:** Commit.

---

### Task 7: Suggestion engine v1 (rule-based + optional LLM phrasing)

**Files:**

- Create: `src/lib/pipeline/suggestion-engine.ts`
- Create: `src/lib/services/pipeline-suggestions-service.ts` (orchestration: load contacts/meetings/nudges via existing repos, emit candidates)

**v1 rules (no playbook strings in output):**

- Stale confirmed row (no `PipelineEvent` / row `updatedAt` older than N days): hygiene “Mark inactive?” with `whyLine` from template using real dates only.
- Contact with upcoming meeting + no pipeline row: `NEW_ROW` draft in `active_engagements` / `active_clients` with company name from CRM.
- Rank: recency + meeting proximity; clamp list to e.g. 20 pending suggestions max.

Optional: call OpenAI to rephrase `whyLine` from a structured bullet list (facts only) — if `openai` null, use template strings.

- [ ] **Step 1:** Function `buildSuggestions(partnerId): PipelineSuggestionInput[]` returning DTOs for repo batch insert (dedupe by `dedupeKey`).
- [ ] **Step 2:** Invoke from dashboard GET or dedicated `POST /api/pipeline/suggestions/refresh` after board load (rate-limit per partner).
- [ ] **Step 3:** Commit.

---

### Task 8: UI shell — tabs, URL, a11y, live counts

**Files:**

- Modify: `src/app/pipeline/page.tsx` — composition only; delegate to components.
- Create: `src/components/pipeline/pipeline-page-client.tsx` — `useSearchParams` sync `lens`; `router.replace` when tab changes.
- Create: `src/components/pipeline/pipeline-tabs.tsx` — Radix Tabs; label format `Pipeline (${a} · ${b} · ${c})` with `aria-label` e.g. `Pipeline, ${a} active engagements, …` per spec §3.1.

- [ ] **Step 1:** Static tabs with `0 · 0 · 0` wired to state.
- [ ] **Step 2:** Connect to `usePipelineBoard` fetching `/api/pipeline/board`.
- [ ] **Step 3:** Commit.

---

### Task 9: Highlight band (§3.2–3.3, §13)

**Files:**

- Create: `src/components/pipeline/updates-highlight-band.tsx`

**Behavior:**

- Heading: prefer **“Updates”** with subtitle “On your board only.” (§13.6); show relative time since `lastViewedAt` when set.
- First visit (`lastViewedAt` null): no band; empty state copy operational (“Add your first item”).
- Order: suggestions first (rank), then activity from `listEventsSince`; cap 6 with “Show more”.
- **“Mark updates as seen”** button → PATCH tab-state `markSeenNow: true`.
- **“Got it”** sets session collapse (client state + optional `highlightCollapsedUntil` = end of day).
- Per-line: **why** + always-visible **Dismiss**; hygiene uses warning styling + confirm on accept.

- [ ] **Step 1:** Presentational component + tests for ordering pure function `sortHighlightLines`.
- [ ] **Step 2:** Wire mutations.
- [ ] **Step 3:** Commit.

---

### Task 10: Lanes + row cards + collapsed filters

**Files:**

- Create: `src/components/pipeline/pipeline-lanes.tsx`, `lane-column.tsx`, `pipeline-row-card.tsx`
- Create: `src/components/pipeline/lane-filters-drawer.tsx` — **collapsed by default** (§13.2); filters: text search, company, practice/institution field if on row, tags.

**Stage moves:** Button “Move…” opens confirm dialog; on success PATCH row; optional undo snackbar calling new endpoint `POST /api/pipeline/rows/[id]/undo-stage` if within 2 minutes.

- [ ] **Step 1:** Render three columns with sortable list (client-side sort v1 OK).
- [ ] **Step 2:** Stage move flow.
- [ ] **Step 3:** Commit.

---

### Task 11: Add chooser — manual + recommendations list

**Files:**

- Create: `src/components/pipeline/add-pipeline-item-menu.tsx`
- Create: `src/components/pipeline/manual-row-dialog.tsx`

Manual form: lens (inherited from tab), stage select, title, optional company picker (reuse patterns from contacts API), next step, provenance `manual`.

“Recommendations for me” navigates to same list as highlight band (reuse component with `variant="full"`).

- [ ] **Step 1:** Manual create flow → POST row.
- [ ] **Step 2:** Recommendations entry opens sheet/list.
- [ ] **Step 3:** Commit.

---

### Task 12: Voice add (mobile v1-required §13.4)

**Files:**

- Create: `src/components/pipeline/voice-add-pipeline-row.tsx`
- Create: `src/app/api/pipeline/voice-draft/route.ts` — accepts transcript text (client posted from existing `POST /api/transcribe`); returns structured `{ title, nextStep, suggestedLens, suggestedStage, companyHint }` using small LLM JSON schema or regex fallback; **does not persist** until user confirms → existing POST rows.

**Mobile:** Use `matchMedia("(max-width: …)")` or user-agent hook only if needed; **show voice as first-class in Add menu on narrow viewports**; desktop may show voice behind “More” but spec says manual+upload cover desktop — still ship voice UI if cheap.

- [ ] **Step 1:** Client: MediaRecorder → FormData → `/api/transcribe` → `/api/pipeline/voice-draft` → confirm dialog.
- [ ] **Step 2:** E2E manual test on iOS simulator or document QA checklist.
- [ ] **Step 3:** Commit.

---

### Task 13: Upload attachments

**Files:**

- Create: `src/app/api/pipeline/attachments/route.ts` — multipart upload, allowlist `application/pdf`, `image/png`, `image/jpeg`, max **15 MiB** (concrete default from §11).

Store under `uploads/pipeline/{partnerId}/` (gitignored) for local dev; abstract `storageKey` in DB for future S3.

- [ ] **Step 1:** POST returns attachment metadata; row link optional in same request.
- [ ] **Step 2:** UI on row card: attach file → draft until row confirm rules satisfied.
- [ ] **Step 3:** Commit.

---

### Task 14: Copy summary escape hatch (§13.5)

**Files:**

- Create: `src/app/api/pipeline/summary-text/route.ts` — `GET` returns `{ text: string }` plain-text lanes + counts + top 5 titles + next steps per lane.
- Create: `src/components/pipeline/copy-board-summary-button.tsx` — `navigator.clipboard.writeText`.

If read-only share link is deferred, document as post-v1; clipboard is required for v1 if export slips.

- [ ] **Step 1:** Implement text builder pure function + test `tests/pipeline-summary-text.test.ts`.
- [ ] **Step 2:** Button in page header.
- [ ] **Step 3:** Commit.

---

### Task 15: Roles matrix (§8) — v1 baseline

**Current app:** Single logged-in partner per session (`Partner` model); no delegate/EA models in schema.

**Plan:**

- v1: enforce **owner partner** only on all pipeline APIs (already `partnerId` from session).
- Add a cross-reference to `docs/superpowers/specs/2026-05-08-pipeline-tab-design.md` in a code comment at `src/lib/pipeline/` entrypoint plus a short **Roles (future)** block comment in `pipeline-repository.ts` listing `view` / `edit` / `confirm` / `attachments` for EA/delegate when a multi-user model exists (avoid a new standalone doc file unless product asks).

- [ ] **Step 1:** Centralize `assertRowOwnedByPartner(row, partnerId)` in repository.
- [ ] **Step 2:** Document extension points; commit.

---

### Task 16: Dashboard deep link (§10)

**Files:**

- Modify: `src/app/dashboard/page.tsx` — any “Pipeline” / Pipeline Pulse CTA uses `href="/pipeline?lens=pipeline"` (and clients variant if copy exists).

- [ ] **Step 1:** Grep `pipelinePulse` / pipeline copy; add deep link.
- [ ] **Step 2:** Commit.

---

### Task 17: Acceptance QA (manual checklist from spec §9)

Run through:

- [ ] Lens switch + URL `?lens=` persistence.
- [ ] Tab triple equals confirmed per-lane counts.
- [ ] Independent `lastViewedAt` per tab; switching tabs does not clear without mark-seen / idle / leave.
- [ ] Suggestion lifecycle + dismiss not resurfacing without material change.
- [ ] Draft rows never increment tab counts until confirm.
- [ ] Copy summary clipboard.

Record failures as GitHub issues or inline TODO with owner.

---

## Spec coverage checklist (self-review)

| Spec section | Task |
|--------------|------|
| §3.1 Tabs + counts + URL + a11y | Task 8 |
| §3.2 lastViewedAt, highlight band, first visit | Tasks 4, 9 |
| §3.3 Suggestions types, ordering, actions | Tasks 6, 7, 9, 11 |
| §4 Lanes, filters collapsed, moves, undo | Tasks 10, 3 |
| §6 Add paths + trust | Tasks 11–13 |
| §7 Data model | Task 1 |
| §8 Privacy / roles | Task 15 |
| §9 Testing | Tasks 2, 6, 14 + §17 manual |
| §10 Dashboard | Task 16 |
| §11 Open decisions (defaults set) | Tasks 4 (idle), 12 (voice), 13 (upload limits) |
| §12 Activate crosswalk | Addressed by filters, undo, voice, export path |
| §13 Guardrails | Tasks 9 (copy, mark seen, dismiss), 10 (filters), 12 (mobile voice), 14 (copy summary) |

**Placeholder scan:** No TBD left without default; undo is explicit optional fast-follow if timeboxed.

**Type consistency:** `Lens` slug `pipeline|clients` matches URL and `PipelineTabState.tabKey`.

---

## Verification commands

```bash
npm run lint
npm test
npm run build
```

Fix any pre-existing unrelated build errors before merging pipeline work (e.g. `src/app/api/chat/route.ts` if still broken).

---

## Plan complete

Saved to **`docs/plans/2026-05-08-pipeline-tab-implementation.md`**.

**Execution options:**

1. **Subagent-driven (recommended)** — Fresh subagent per task; review between tasks.  
2. **Inline** — Run tasks sequentially in this workspace with checkpoints after Tasks 4, 8, and 14.

Which approach do you want for implementation?

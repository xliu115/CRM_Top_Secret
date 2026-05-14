# Pipeline tab — design spec (ClientIQ)

**Status:** Draft for product/engineering review  
**Date:** 2026-05-08  
**Scope:** Replace placeholder `/pipeline` with the Pipeline experience aligned to partner workflow (study-level and client-level lenses). Playbook concepts inform **systems behavior only**, not user-visible copy or links.

---

## 1. Goals

- Give partners a **single place** to see and manage **pipeline** (study-level) and **client portfolio** (client-level) without exposing methodology, explicit target comparisons, or internal documentation on the surface. **Tab labels show live board counts** (see §3.1); steady-state **2-4-8 / 4-8-16** exist **only behind the scenes** for recommendations and ranking.
- Allow **capture** through recommendations, **voice**, **uploads**, and **manual** entry, with confirmation before persisted changes affect official lists.

## 2. Non-goals (v1)

- Surfacing playbook text, iron laws, “vs. target” indicators, progress bars against 2-4-8 or 4-8-16 numeric targets, or links to internal methodology docs.
- Explaining Sven’s operating model in the UI.
- Auto-promoting items to “serious” / “cultivation” without an explicit partner confirmation step.

## 3. Information architecture

### 3.1 Tabs

Tabs have a **fixed name** plus a **live numeric triple** that always reflects **this partner’s current board** (confirmed rows only — same rules as lane totals).

| Tab | Lens | Triple order (left → right) |
|-----|------|-----------------------------|
| **Pipeline** `(a · b · c)` | Study-level | **a** = active engagements, **b** = LOPs in discussion, **c** = serious discussions |
| **Clients** `(x · y · z)` | Client-level | **x** = active clients, **y** = warm relationships, **z** = under cultivation |

- **Numbers on the tab are always actual counts**, e.g. `Pipeline (1 · 3 · 5)` or `Clients (2 · 6 · 11)`. They are **not** the steady-state targets 2-4-8 or 4-8-16; those targets drive **backend** behavior only (e.g. what to recommend), never as fixed display digits on the tab.
- **Separator:** Use a clear neutral separator (e.g. middle dot ` · `) so the triple is not mistaken for a single number (e.g. not `248`).
- **Zeros:** Show `0` in each position when empty (e.g. `Pipeline (0 · 0 · 0)`) so the tab stays truthful and scannable.
- **Accessibility:** Expose the triple in the tab’s accessible name (e.g. “Pipeline, 1 active, 3 LOPs, 5 serious discussions”) so screen readers do not read “one three five” without context.
- **URL:** Persist selected lens, e.g. `?lens=pipeline|clients` (implementation may use stable slugs).

### 3.2 “Since last view” (per tab)

- Each tab maintains its own **`lastViewedAt`** (and optionally `lastLens` is implicit per tab).
- **Update policy:** Set `lastViewedAt` when the user **leaves** `/pipeline` or after **idle** (configurable threshold) so switching tabs inside the page does not clear highlights prematurely.
- **Highlight band** directly **above the tab panels / lane content** (below the tab strip):
  - **Since your last visit** (relative time) for **this tab only**.
  - Content mix: **recommendations** (system-ranked using behind-the-scenes rules) + **factual deltas** (adds, removes, stage changes, drop-off reasons if captured).
  - **Ordering:** Recommendations first, then changes; cap visible items with **“Show more”** to avoid inbox fatigue.
  - **Dismiss:** Collapse or “Got it”; highlights are informational, not blocking.
- **First visit:** No highlights; concise empty guidance in **operational** language only (e.g. “Add your first item”).
- **Partner guardrails:** Explicit **mark as seen**, conservative idle behavior, and **neutral heading copy** for the band — §13.

### 3.3 Recommendations — logic, presentation, partner actions

#### How recommendations are produced (behind the scenes)

- The engine consumes **partner-scoped signals**: current **confirmed** board (both lenses), **change history**, and product data the rest of ClientIQ already has (e.g. companies, contacts, meetings, touches, nudges — exact wiring in implementation plan). Optional **LLM** may phrase a short reason or next step; **no** playbook names, iron laws, or “2-4-8” language in user-visible strings.
- **Internal weights** (not shown) may encode steady-state funnel shape, recency, staleness, and confidence so the system ranks what to surface first. Outputs are only **plain-language** suggestions (e.g. “Move to LOP when ready,” “Check if this is still active”).
- Each surfaced item is a **suggestion** with a stable id, type, payload (target row id or draft row), and **status**: `pending` → `accepted` | `dismissed` | `snoozed` until expired.

#### Types of suggestions (v1 scope)

| Type | Meaning |
|------|--------|
| **New draft row** | System proposes a **new** pipeline/client row in a given stage (pre-filled from CRM context). Does **not** count in tab triples until **accepted**. |
| **Stage move** | Proposes moving an existing confirmed row to a different stage within the same lens. |
| **Hygiene** | Proposes archiving, merging duplicates, or marking “inactive” when stale — partner confirms. |

Additional types (e.g. “schedule a touch”) stay **out of v1** unless product expands.

#### How they appear with “since last view” (visual)

- **Container:** A single **panel** directly under the tab strip: light **tinted background** (e.g. subtle brand-tinted or neutral `muted` panel), **rounded** corners, **clear heading**: “Since your last visit” + **relative timestamp** (this tab’s `lastViewedAt` reference).
- **Ordering:** (1) **Suggestions** first, sorted by rank; (2) **Activity** lines (rows added/removed, stage changes, drop-off reason if logged) after. Cap **5–7** lines; **“Show more”** reveals the rest in-panel or on a simple full-list view.
- **Per line — suggestions:** Small **“Suggested”** pill (or icon) + **one-line title** + optional **subtitle** (client, study name). Each line includes a **one-line “why”** (signals/rules; LLM may phrase without inventing facts) and an **always-visible Dismiss** (see §13). Do not use scary reds for normal suggestions; reserve **warning** styling only for hygiene that implies data loss (archive), with confirm anyway.
- **Per line — activity:** Neutral icon or dot; factual copy (“Jamie Lee moved to LOPs,” “Acme study removed”).
- **Dismiss bar:** **“Got it”** collapses the whole panel for this visit; individual lines can still be acted on from **Add → Recommendations** if needed.

#### Partner actions (per suggestion line)

| Action | Effect |
|--------|--------|
| **Review / Open** | Opens a **confirmation sheet** or inline expand with editable fields (stage, title, next step). **No** change to confirmed board until confirmed. |
| **Accept** | Persists the suggestion (new row or stage move or archive). Tab triples and lanes update; suggestion marked `accepted` and leaves the highlight list. |
| **Edit & accept** | Same as accept after partner adjusts fields. |
| **Dismiss** | Marks `dismissed`; removes from this panel; system should not re-show the **same** suggestion id unless underlying data changes materially (implementation defines “material”). |
| **Snooze** | Marks `snoozed` until chosen interval; hidden from band until then. |

**“Add → Recommendations for me”** opens the **same** ranked list (or filtered view) so partners can work suggestions even after collapsing the band.

#### Relationship to tab counts

- Suggestions and unconfirmed drafts **never** increment the **Pipeline (a · b · c)** / **Clients (x · y · z)** tab numbers until **accepted** (per §6.2).

## 4. Tab content (lanes)

### 4.1 Pipeline lens

- **Three lanes** (sections): active engagements · LOPs in discussion · serious discussions.
- Each lane: **sortable list** of rows (e.g. client, working title, next step, last touch). No aggregate “2/4/8” vs-target row in v1.
- **Lane filters:** Filters scoped to this lens (e.g. institution, practice, search, optional **theme / workstream tags**) so large boards stay usable—addresses recurring Activate feedback on **filtering**, **business-unit scope**, and **theme** grouping without sounding methodological. **Default:** filters/tags **collapsed** until expanded (§13).
- **Stage moves:** Partners can move a row **forward or backward** between stages with the same **confirm** affordance as today; consider **undo last move** within a short window when feasible (Activate: “move back in funnel,” reduce rigid rules).
- Rows support **linked attachments** and provenance: `manual` | `system` | `voice` | `upload` for audit.

### 4.2 Clients lens

- **Three lanes:** active clients · warm relationships · under cultivation.
- Same list, attachment, provenance, **filter**, and **bidirectional stage move** behavior as §4.1 where applicable; copy tuned to **relationship / account** language, not methodology.

## 5. Rhythm in the product

| Cadence | Behavior |
|---------|----------|
| **Daily / weekly** | Do **not** push pipeline-building framing on relationship-first surfaces by default (briefing nudges optional and conservative). |
| **Monthly / quarterly** | Partners use `/pipeline` when they choose; external reminders or dashboard links may deep-link with `?lens=…`. No dedicated review wizard or playbook tutorial on this page in v1. |

## 6. Adding and updating data

### 6.1 Entry points

Primary **Add** affordance per tab opens a **chooser**:

- Recommendations for me (system-suggested rows or stage changes — **confirm to apply**).
- **Voice:** capture → transcript → **structured draft** → partner **confirms** before commit. **Mobile:** voice add is **v1-required** unless product documents a pilot exception (§13). Desktop scope per implementation plan.
- **Upload:** files attached to a new or existing row; virus scan, size/type limits, and retention policy defined at implementation.
- **Manual:** form for precise entry when voice/upload is insufficient.

### 6.2 Trust

- No row counts toward funnel stages until **confirmed** when originating from system, voice, or upload.
- Optional “still active?” nudges on stale rows may be generated **without** citing playbook; copy stays neutral.

## 7. Data model (conceptual)

- Entities or tagged records per **lens** with **stage** enums appropriate to that lens.
- **Suggested vs confirmed** stage where inference exists.
- **Change log** for stage transitions and drop-off reasons (for analytics and “since last view” deltas); partners may supply reason on archive/remove.
- **Attachments** stored with metadata; link to row or hold in **unmatched inbox** until linked.

## 8. Privacy and compliance

- Voice and files are **partner-scoped**; access control matches rest of ClientIQ.
- **Roles:** Define who may **view**, **edit**, **confirm suggestions**, and **see attachments** on a row (partner, delegate, EA, practice admin) so “non-owner update” and **EA coverage** patterns from Activate field feedback do not regress—exact matrix in implementation plan.
- Retention and export rules follow org policy (detail in implementation plan).

## 9. Testing (acceptance-oriented)

- Lens switching + URL persistence; tab triples **update when board counts change** and match sum of confirmed rows per lane.
- Independent `lastViewedAt` per tab; highlight content differs when switching lenses after time passes.
- Suggestion lifecycle: `pending` → accept / dismiss / snooze; dismissed ids not resurfaced without material data change (per §3.3).
- Add flows: manual, voice (confirm), upload (confirm), system (confirm); unconfirmed drafts never inflate lane counts used for summaries if any summary exists.
- Tab label triples **equal** confirmed row counts per lane (regression guard against drift).

## 10. Relationship to dashboard

- Optional **Pipeline Pulse** (or similar) dashboard card may deep-link to `/pipeline?lens=…`; card copy should remain **operational**, not methodological, and must not reintroduce vs-target on the dashboard unless product explicitly revisits.

## 11. Open decisions (implementation plan)

- Exact **idle threshold** for updating `lastViewedAt`.
- **Voice** capture reuse vs new component; ASR error handling and PII in transcripts.
- **Upload** allowed MIME types, max size, storage backend, and malware scanning.
- **Scope model** for “whose rows appear by default” (e.g. mine vs broader team) and **export** of the current lens for CST meetings (CSV/snapshot)—priority post-v1 unless pilot demands sooner. If export slips v1, ship **copy summary / read-only share** per §13.

## 12. Crosswalk — Activate ad-hoc feedback tracker (2026-05-09)

Source workbook: `Activate Ad-hoc feedback tracker_20260509.xlsx` (Activate / Salesforce-era CST pilot). Not ClientIQ-specific, but **themes** below should inform Pipeline so we do not repeat the same friction.

| Theme in tracker | Implication for ClientIQ Pipeline (this spec) |
|------------------|-----------------------------------------------|
| **Pipeline prominence** (“make opportunity pipeline more prominent”; “click funnel → detail”) | Keep **Pipeline** in primary nav; dashboard/home widgets should **deep-link** to `/pipeline` + lens (§10). |
| **Kanban / funnel loved but rigid** | Lanes are the analog of Kanban; **backward moves + undo** (§4.1) reduce “stuck in wrong stage” pain. |
| **Filtering & overload** (BU, status, themes, “50+ opps”) | **Lane filters + tags** (§4.1); optional **default scope** (“mine”) in open decisions §11. |
| **Non-owner / delegate edits** | **Role matrix** for edit/confirm (§8). |
| **Themes spanning multiple deals** | **Theme / workstream tags** on rows (§4.1). |
| **Skepticism: fluid pipeline, won’t maintain** | Double down on **voice, upload, low-friction add, confirm** (§6); consider **batch quick-capture** later in implementation plan. |
| **“Too formal” for early-stage ideas** | Use **lighter visual weight** for earlier lanes only if research confirms—copy stays operational, no playbook. |
| **CST snapshot / Excel export** | Tracked as **export** in §11; not required for v1 MVP. |
| **Financial / metric display bugs ($0)** | If Pipeline shows **value** fields later, only when **data-complete**; never placeholder zeros that read as truth. |
| **Link todos to engagements** | Implementation: allow **tasks/nudges** elsewhere to **link** to a pipeline row id when product supports it. |

## 13. Partner path — v1 guardrails (design review)

Busy-partner constraints folded from review: **low cognitive load**, **trust**, **mobile capture**, **CST escape hatch**, **no “surveillance” read**.

1. **Suggestion transparency** — Every recommendation line shows a **one-line “why”** (rule- or signal-based where possible; LLM may phrase but must not invent facts). **Dismiss** remains **always visible** on the line (not only inside a sheet). Partners can reject a wrong suggestion without opening a modal first.

2. **Progressive disclosure** — **Lane filters** and **theme/workstream tags** ship **collapsed by default** (e.g. single “Filter” / “Tags” control expanding a panel). Avoid a first screen that looks like a cockpit.

3. **Mark as seen** — Offer an explicit **“Mark updates as seen”** (or equivalent) in addition to idle/leave rules for `lastViewedAt` (§3.2). Partners who keep the tab open across meetings should not lose highlights unpredictably; conservative idle thresholds alone are insufficient for trust.

4. **Mobile voice** — Treat **voice capture for add** as **v1-required on mobile** (phone and tablet), not deferred to “implementation plan only,” unless product explicitly documents a pilot exception. Desktop voice can follow; **manual + upload** cover desktop if needed.

5. **Share / copy when export slips** — If full **export** (§11) misses v1, ship a **minimal escape hatch**: e.g. **“Copy summary to clipboard”** (plain text: lanes, counts, top N row titles + next steps) and/or a **read-only share link** for CST prep. Stops parallel Excel becoming the system of record.

6. **Copy tone for the highlight band** — Prefer **neutral-operational** headings (e.g. “**Updates**” or “**Changes since you were last here**”) over phrasing that can read as monitoring. Optional subtitle: “On your board only.”

---

## Spec self-review (inline)

- **Placeholders:** Open decisions listed in §11; none left as “TBD” inside locked scope without a home.
- **Consistency:** Surface avoids playbook and vs-target; backend may use playbook-shaped logic only for ranking/recommendations — stated explicitly.
- **Scope:** Single feature area (Pipeline page + capture + highlights); dashboard and briefing are touchpoints only.
- **Ambiguity:** Tab digits are **live counts** per partner per lane order; **2-4-8 / 4-8-16** are **not** shown on tabs — they remain internal targets for recommendations only. **§3.3** ties recommendation UX to the highlight band and Add flow. **§12** maps legacy Activate pilot feedback. **§13** locks busy-partner v1 guardrails from design review.

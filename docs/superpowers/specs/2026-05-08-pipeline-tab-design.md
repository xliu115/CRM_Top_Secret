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

## 4. Tab content (lanes)

### 4.1 Pipeline lens

- **Three lanes** (sections): active engagements · LOPs in discussion · serious discussions.
- Each lane: **sortable list** of rows (e.g. client, working title, next step, last touch). No aggregate “2/4/8” vs-target row in v1.
- Rows support **linked attachments** and provenance: `manual` | `system` | `voice` | `upload` for audit.

### 4.2 Clients lens

- **Three lanes:** active clients · warm relationships · under cultivation.
- Same list, attachment, and provenance behavior; copy tuned to **relationship / account** language, not methodology.

## 5. Rhythm in the product

| Cadence | Behavior |
|---------|----------|
| **Daily / weekly** | Do **not** push pipeline-building framing on relationship-first surfaces by default (briefing nudges optional and conservative). |
| **Monthly / quarterly** | Partners use `/pipeline` when they choose; external reminders or dashboard links may deep-link with `?lens=…`. No dedicated review wizard or playbook tutorial on this page in v1. |

## 6. Adding and updating data

### 6.1 Entry points

Primary **Add** affordance per tab opens a **chooser**:

- Recommendations for me (system-suggested rows or stage changes — **confirm to apply**).
- **Voice:** capture → transcript → **structured draft** → partner **confirms** before commit. (Platform scope: desktop and/or mobile to be decided in implementation plan; spec assumes both are allowed unless product narrows.)
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
- Retention and export rules follow org policy (detail in implementation plan).

## 9. Testing (acceptance-oriented)

- Lens switching + URL persistence; tab triples **update when board counts change** and match sum of confirmed rows per lane.
- Independent `lastViewedAt` per tab; highlight content differs when switching lenses after time passes.
- Add flows: manual, voice (confirm), upload (confirm), system (confirm); unconfirmed drafts never inflate lane counts used for summaries if any summary exists.
- Tab label triples **equal** confirmed row counts per lane (regression guard against drift).

## 10. Relationship to dashboard

- Optional **Pipeline Pulse** (or similar) dashboard card may deep-link to `/pipeline?lens=…`; card copy should remain **operational**, not methodological, and must not reintroduce vs-target on the dashboard unless product explicitly revisits.

## 11. Open decisions (implementation plan)

- Exact **idle threshold** for updating `lastViewedAt`.
- **Voice** capture reuse vs new component; ASR error handling and PII in transcripts.
- **Upload** allowed MIME types, max size, storage backend, and malware scanning.

---

## Spec self-review (inline)

- **Placeholders:** Open decisions listed in §11; none left as “TBD” inside locked scope without a home.
- **Consistency:** Surface avoids playbook and vs-target; backend may use playbook-shaped logic only for ranking/recommendations — stated explicitly.
- **Scope:** Single feature area (Pipeline page + capture + highlights); dashboard and briefing are touchpoints only.
- **Ambiguity:** Tab digits are **live counts** per partner per lane order; **2-4-8 / 4-8-16** are **not** shown on tabs — they remain internal targets for recommendations only.

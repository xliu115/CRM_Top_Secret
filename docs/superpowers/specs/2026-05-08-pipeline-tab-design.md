# Pipeline tab — design spec (ClientIQ)

**Status:** Draft for product/engineering review  
**Date:** 2026-05-08  
**Scope:** Replace placeholder `/pipeline` with the Pipeline experience aligned to partner workflow (study-level and client-level lenses). Playbook concepts inform **systems behavior only**, not user-visible copy or links.

---

## 1. Goals

- Give partners a **single place** to see and manage **pipeline** (study-level) and **client portfolio** (client-level) without exposing methodology, targets-vs-actuals, or internal documentation on the surface.
- Support **monthly** pipeline review in-product; align with **quarterly** ritual via entry points elsewhere (e.g. dashboard link) without teaching prose on this page.
- Allow **capture** through recommendations, **voice**, **uploads**, and **manual** entry, with confirmation before persisted changes affect official lists.

## 2. Non-goals (v1)

- Surfacing playbook text, iron laws, “vs. target” indicators, progress bars against 2-4-8 or 4-8-16 numeric targets, or links to internal methodology docs.
- Explaining Sven’s operating model in the UI.
- Auto-promoting items to “serious” / “cultivation” without an explicit partner confirmation step.

## 3. Information architecture

### 3.1 Tabs

| Tab label (user-visible) | Lens |
|---------------------------|------|
| **Pipeline (2-4-8)** | Study-level: active engagements, LOPs in discussion, serious discussions. **Digits in the tab name are labels only** — not paired with “target” UI on the page. |
| **Clients (4-8-16)** | Client-level: active clients, warm relationships, clients under cultivation. Same rule: **no vs-target** presentation. |

- **URL:** Persist selected lens, e.g. `?lens=pipeline|clients` (implementation may use stable slugs; labels above are canonical for UI).

### 3.2 Shared header (above tabs)

- **Monthly review** entry: start or resume the short monthly review flow (checkpoint, “what moved,” etc.). Copy is operational, not methodological.
- **Portfolio balance** (qualitative): surface **categories** — moonshots, strong candidates, good engagements — as **buckets or filters**, without numeric “you should have 1–2” coaching on the page. Backend may still use playbook-shaped logic for **recommendations only**.

### 3.3 “Since last view” (per tab)

- Each tab maintains its own **`lastViewedAt`** (and optionally `lastLens` is implicit per tab).
- **Update policy:** Set `lastViewedAt` when the user **leaves** `/pipeline` or after **idle** (configurable threshold) so switching tabs inside the page does not clear highlights prematurely.
- **Highlight band** under shared chrome / above tab content:
  - **Since your last visit** (relative time) for **this tab only**.
  - Content mix: **recommendations** (system-ranked using behind-the-scenes rules) + **factual deltas** (adds, removes, stage changes, drop-off reasons if captured).
  - **Ordering:** Recommendations first, then changes; cap visible items with **“Show more”** to avoid inbox fatigue.
  - **Dismiss:** Collapse or “Got it”; highlights are informational, not blocking.
- **First visit:** No highlights; concise empty guidance in **operational** language only (e.g. “Add your first item”).

## 4. Tab content (lanes)

### 4.1 Pipeline (2-4-8)

- **Three lanes** (sections): active engagements · LOPs in discussion · serious discussions.
- Each lane: **sortable list** of rows (e.g. client, working title, next step, last touch). No aggregate “2/4/8” vs-target row in v1.
- Rows support **linked attachments** and provenance: `manual` | `system` | `voice` | `upload` for audit.

### 4.2 Clients (4-8-16)

- **Three lanes:** active clients · warm relationships · under cultivation.
- Same list, attachment, and provenance behavior; copy tuned to **relationship / account** language, not methodology.

## 5. Rhythm in the product

| Cadence | Behavior |
|---------|----------|
| **Daily / weekly** | Do **not** push pipeline-building framing on relationship-first surfaces by default (briefing nudges optional and conservative). |
| **Monthly** | `/pipeline` is the home for the **short review** (with EA prep affordance if applicable). |
| **Quarterly** | External habit row or dashboard can **deep-link** into `/pipeline` with lens query; page does not host playbook tutorial. |

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

- Lens switching + URL persistence.
- Independent `lastViewedAt` per tab; highlight content differs when switching lenses after time passes.
- Add flows: manual, voice (confirm), upload (confirm), system (confirm); unconfirmed drafts never inflate lane counts used for summaries if any summary exists.
- No UI copy asserting playbook names, iron laws, or “target” framing; snapshot tests for sensitive routes optional.

## 10. Relationship to dashboard

- Optional **Pipeline Pulse** (or similar) dashboard card may deep-link to `/pipeline?lens=…`; card copy should remain **operational**, not methodological, and must not reintroduce vs-target on the dashboard unless product explicitly revisits.

## 11. Open decisions (implementation plan)

- Exact **idle threshold** for updating `lastViewedAt`.
- **Voice** capture reuse vs new component; ASR error handling and PII in transcripts.
- **Upload** allowed MIME types, max size, storage backend, and malware scanning.
- Whether **portfolio balance** buckets show **counts only** (no targets) or **presence** indicators only.

---

## Spec self-review (inline)

- **Placeholders:** Open decisions listed in §11; none left as “TBD” inside locked scope without a home.
- **Consistency:** Surface avoids playbook and vs-target; backend may use playbook-shaped logic only for ranking/recommendations — stated explicitly.
- **Scope:** Single feature area (Pipeline page + capture + highlights); dashboard and briefing are touchpoints only.
- **Ambiguity:** “Digits in tab names are labels only” clarifies that 2-4-8 / 4-8-16 appear as **names**, not live target meters.

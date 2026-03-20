# Activate CRM — Dashboard Conversational Layout Design

**Date:** 2026-03-19  
**Status:** Option D implemented (2026-03-19)

---

## Overview

Exploration of dashboard layout options that elevate **Ask Activate** (conversational assistant) to the top of the dashboard. Core tension: *Answer questions fast* vs *surface operational counts at a glance* vs *preserve scan patterns for Today's Nudges / Meeting Prep / News*.

---

## User-Specified Variant: Stat Strip → Chat Bar

**Source:** User feedback (2026-03-19)

**Concept:** Replace the **stat strip** (Open Nudges, Upcoming Meetings, Total Contacts) with a **chat bar**. Everything below stays the same.

### Current area being replaced

- **Header:** "Dashboard" + "Welcome back, [Name]. Here's what's happening today."
- **Stat strip:** Three cards — Open Nudges (28), Upcoming Meetings (9), Total Contacts (29)
- **Below (unchanged):** Two columns (Today's Top Nudges | Meeting Prep — Next 7 Days) + Client News timeline

### Proposed change

| Before | After |
|--------|-------|
| 3 stat cards in a row | Single chat bar (Ask Activate input + suggested prompts) |
| Metrics at a glance | Conversational entry point |

### Layout sketch

```
┌────────────┬─────────────────────────────────────────────────────────────┐
│ Sidebar    │  Dashboard                                                   │
│            │  Welcome back, Taylor Brooks. Here's what's happening today. │
│ Nudges (28)├─────────────────────────────────────────────────────────────┤
│ Meetings (9)│  Ask Activate                                                │
│ Contacts (29)│  ┌─────────────────────────────────────────────────────┐    │
│ ...        │  │ Ask about clients, nudges, or meetings…        [→]  │    │
│            │  └─────────────────────────────────────────────────────┘    │
│            │  [ Summarize my week ] [ Who needs follow-up? ] [ Prep for… ]│
│            ├─────────────────────────────────────────────────────────────┤
│            │  Today's Top Nudges    │  Meeting Prep — Next 7 Days         │
│            │  (below section)       │  (below section)                    │
│            ├─────────────────────────────────────────────────────────────┤
│            │  Client News timeline (below section)                        │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### Stats in sidebar (decided)

**Source:** User feedback (2026-03-19)

Show counts with the related nav item on the left side panel, e.g.:
- **Nudges (28)**
- **Meetings (9)**
- **Contacts (29)**

Stats remain glanceable without competing with the chat bar. Sidebar nav items become both navigation and status indicators.

### Chat flow: first question → Ask Anything

**Source:** User feedback (2026-03-19)

**Flow:** After the user enters their first question in the dashboard chat bar, **transition them to the Ask Anything tab** (`/chat`) to continue the conversational interaction.

- **Dashboard chat bar:** Quick entry point; suggested prompts; first question only.
- **Ask Anything tab:** Full chat experience; history; follow-up questions; sources.

**Rationale:** Keeps the dashboard chat minimal; avoids a split conversation context; Ask Anything becomes the canonical place for ongoing dialogue.

### Other considerations

- **Chat bar height:** ~120–180px resting (input + one row of chips).
- **Empty state:** Suggested prompts carry discovery; avoid a blank input only.

### Top section: confirmed

User feedback: "Think we are all good with the top section of dashboard."

- Header: "Dashboard" + "Welcome back, [Name]. Here's what's happening today."
- Chat bar: Ask Activate input + suggested prompts
- Stats: In sidebar nav (Nudges (28), Meetings (9), Contacts (29) )
- Chat flow: First question → transition to Ask Anything tab

---

## Below Section: Layout Alternatives

**Current layout:**
- Two columns 50/50: Today's Top Nudges (left) | Meeting Prep — Next 7 Days (right)
- Below fold: Client News timeline

**Question:** Is there a better way to rearrange the below section?

### Option A — Keep current (two columns + news below)

```
┌──────────────────────────────┬──────────────────────────────┐
│  Today's Top Nudges          │  Meeting Prep — Next 7 Days   │
│  (5 items)                   │  (Today / Tomorrow / Later)   │
└──────────────────────────────┴──────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Client News timeline                                        │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Simple; nudges and meetings are equal priority; news is contextual.  
**Cons:** Nudges and meetings are different types of tasks (act vs prepare); may compete for attention.

---

### Option B — Single column: Nudges → Meetings → News

Stack vertically for a clear reading order: act first (nudges), then prepare (meetings), then context (news).

```
┌─────────────────────────────────────────────────────────────┐
│  Today's Top Nudges                                         │
│  (full width, 3–5 cards)                                    │
├─────────────────────────────────────────────────────────────┤
│  Meeting Prep — Next 7 Days                                 │
│  (full width, grouped by Today / Tomorrow / Later)          │
├─────────────────────────────────────────────────────────────┤
│  Client News timeline                                       │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Clear hierarchy: action → preparation → context; single scroll path; easier mobile.  
**Cons:** More vertical scroll; meetings may feel less prominent if user cares more about prep.

---

### Option C — Tabs: Nudges | Meetings | News

One content area with three tabs; user selects focus.

```
┌─────────────────────────────────────────────────────────────┐
│  [ Nudges ]  [ Meetings ]  [ News ]                         │
├─────────────────────────────────────────────────────────────┤
│  (active tab content)                                       │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** User chooses; reduces cognitive load; cleaner above-the-fold.  
**Cons:** Nudges and meetings hidden by default; extra click to switch; harder to compare.

---

### Option D — Asymmetric: Nudges dominant (60%) | Meetings + News (40%)

Nudges get more space; meetings and news share a narrower column.

```
┌────────────────────────────────────┬────────────────────────┐
│  Today's Top Nudges                 │  Meeting Prep          │
│  (wider, 4–5 cards)                 │  (compact, 3–5 items)  │
│                                     ├────────────────────────┤
│                                     │  Client News            │
│                                     │  (compact, 3–5 items)   │
└────────────────────────────────────┴────────────────────────┘
```

**Pros:** Reflects "nudges = action" as primary; meetings and news as supporting context.  
**Cons:** Meetings and news may feel cramped; news timeline could truncate.

---

### Option E — Card grid: Nudges + Meetings side by side; News full width below

Same as current but with News as a distinct "section" below the fold.

```
┌──────────────────────────────┬──────────────────────────────┐
│  Today's Top Nudges          │  Meeting Prep — Next 7 Days   │
└──────────────────────────────┴──────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Client News                                                 │
│  (full width, timeline or grouped)                           │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Matches current; news is clearly secondary.  
**Cons:** Same as current; no structural change.

---

### Option F — Horizontal scroll: Nudges | Meetings | News

Three horizontal panels; user can scroll horizontally or use arrows.

```
┌──────────────┬──────────────┬──────────────┐
│   Nudges     │   Meetings   │    News      │
│   ← scroll → │              │              │
└──────────────┴──────────────┴──────────────┘
```

**Pros:** All three visible at once on wide screens; easy to compare.  
**Cons:** Horizontal scroll is less common; mobile may feel awkward; panels can feel narrow.

---

### Recommendation (for discussion)

| If primary job is… | Consider |
|--------------------|----------|
| **Act on nudges first** | Option B (single column) or Option D (nudges dominant) |
| **Balance act + prepare** | Option A (current) or Option E |
| **User chooses focus** | Option C (tabs) |
| **Compare all three** | Option F (horizontal) |

---

## Full Brainstorm: Other Layout Options (earlier)

### Option A — Conversational Hero (full treatment)

- Replace stat strip with prominent conversational workspace
- Stats: subtle strip below, right rail, or collapsed
- Size: ~240–360px vertical when resting

### Option B — Conversational Sidebar

- Chat as persistent right sidebar or slide-over
- Main dashboard unchanged; chat always one click away

### Option C — Hybrid (compact chat + condensed stats)

- One row: compact Ask bar (~40%) + condensed stats (~60%)
- Both above the fold

### Option D — Command Palette

- ⌘K opens Ask; answer appears as dismissible card

### Option E — Floating Prompt (FAB)

- "Ask Activate" pill bottom-right; expands to sheet

### Option F — Contextual Chat per Section

- "Ask about this section" in Nudges, Meetings, etc.

---

## Conversational Hero Sub-Variants (from brainstorm)

### Variant A — Full-width chat bar + suggested questions

```
┌─────────────────────────────────────────────────────────────┐
│  Ask Activate                                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Ask about clients, nudges, or meetings…        [→]  │    │
│  └─────────────────────────────────────────────────────┘    │
│  [ Summarize my week ] [ Who needs follow-up? ] [ Prep for… ]│
│  Recent: "Open tasks for Acme" · "Next meeting with Jordan"  │
└─────────────────────────────────────────────────────────────┘
```

### Variant B — Compact pill → expands

Resting: `[ 🔮 Ask Activate — questions about your book of business ]`  
Expanded: Same region grows to show input + chips

### Variant C — Split: chat left, stats right

```
┌──────────────────────────────┬──────────────────────────────┐
│ Ask Activate                 │  Today at a glance            │
│ [ Input… ]                   │  ┌──────┐ ┌──────┐ ┌──────┐  │
│ [chip] [chip] [chip]         │  │  12  │ │  3   │ │ 428  │  │
└──────────────────────────────┴──────────────────────────────┘
```

### Variant D — Chat primary; stats in subtle strip below

```
┌─────────────────────────────────────────────────────────────┐
│  Ask Activate                                                │
│  [ Input… ]                                                  │
├─────────────────────────────────────────────────────────────┤
│  12 open nudges   ·   3 meetings (7d)   ·   428 contacts  →  │
└─────────────────────────────────────────────────────────────┘
```

---

## Executive Anchoring (Nudges & News)

**Source:** User feedback (2026-03-19)

Nudges and news are anchored on the partner's contacts — real executives at client companies.

- **Nudges:** Generated only for contacts in the partner's book. Each nudge targets a specific executive.
- **News:** Tavily search queries include executive names (e.g. `Microsoft Satya Nadella Scott Guthrie latest news`) to bias results toward news relevant to our contacts. Company-level NEWS signals surface in the dashboard and drive COMPANY_NEWS nudges for contacts at that company.

Seed data uses real, verifiable executives (CEOs, SVPs, etc.) from company leadership pages and SEC filings.

---

## Accessibility and UX Considerations

- **Keyboard:** First tab to Ask or skip link; Enter/Space to expand; Esc to close
- **Screen readers:** `role="region"` + `aria-labelledby`; `aria-live="polite"` for streaming
- **Mobile:** Collapsible or sheet for long threads; sticky input
- **Empty vs history:** Lead with suggested questions; show last 1–2 interactions for returning users

---

## Next Steps

- [x] Stats placement: sidebar nav (Nudges (28), Meetings (9), Contacts (29))
- [x] Chat flow: first question → transition to Ask Anything tab
- [x] Top section: confirmed (header + chat bar)
- [x] Below section: Option D implemented (60% nudges | 40% meetings+news stacked)
- [ ] Validate chat bar height and expansion behavior
- [ ] Prototype and test with users

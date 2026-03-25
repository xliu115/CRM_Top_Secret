# Dashboard Settings Page & Sidebar Collapse

**Date:** 2026-03-25
**Status:** In progress

---

## Scope

Three workstreams:

1. **Sidebar collapse/expand** with localStorage persistence
2. **Dashboard Settings page** at `/dashboard/settings` with toggles for 9 cards
3. **Dashboard conditional rendering** — read preferences from localStorage and show/hide sections

---

## 1. Sidebar Collapse/Expand

**Files to change:**
- `src/components/layout/sidebar.tsx` — add collapsed state, toggle button, responsive layout
- `src/components/layout/dashboard-shell.tsx` — lift `collapsed` state here, pass to Sidebar, adjust main content area

**Approach:**
- Store `sidebar-collapsed` boolean in `localStorage`
- `DashboardShell` owns the state, passes `collapsed` + `onToggle` to `Sidebar`
- Collapsed sidebar: ~64px wide, shows only icons + tooltip on hover, logo collapses to icon-only
- Expand/collapse button: chevron icon at the bottom of the sidebar (or top near logo)
- Smooth CSS transition on `width` (~200ms ease)
- User profile section collapses to avatar-only

---

## 2. Dashboard Settings Page

**New file:** `src/app/dashboard/settings/page.tsx`

**Design:** Follow the same pattern as `src/app/nudges/settings/page.tsx` — client component, localStorage-backed (not API-backed since these are UI preferences), toggle switches for each card.

### Card toggle list (9 items)

| Key | Label | Description | Default |
|-----|-------|-------------|---------|
| `aiAssistant` | AI Assistant | Morning briefing and quick-ask input | ON |
| `topNudges` | Today's Top Nudges | Priority-sorted nudges and meeting prep cards | ON |
| `clientNews` | Client News | Recent signals grouped by client company | ON |
| `todaysMeetings` | Today's Meetings & Briefs | Compact list of today's/tomorrow's meetings with client name, time, and a one-line AI prep note or "prep needed" flag | OFF |
| `pipelinePulse` | Pipeline Pulse | Open opportunities sorted by stage gate, close date, or staleness — with next step and last touch | OFF |
| `relationshipRadar` | Relationship Radar | High-importance contacts and clients with no meaningful touch in N days, or declining interaction trends — prioritized by strategic importance | OFF |
| `campaignMomentum` | Campaign & Content Dissemination Momentum | Active campaigns with progress metrics (targets touched, replies, next wave) and recommended next actions | OFF |
| `whitespace` | Whitespace | Key clients with open pipeline, recent signals, and coverage gaps (e.g., single-threaded relationships, few senior contacts) | OFF |
| `recentTouchTimeline` | Recent Touch Timeline | Chronological strip of latest emails, calls, and meetings across priority contacts — filterable by client or time window | OFF |

**Storage:** `localStorage` key `dashboard-card-prefs` — JSON object of `Record<string, boolean>`.

**UI elements:**
- Page header with "Dashboard Settings" title and back link to `/dashboard`
- Single Card with all 9 toggle rows (icon + label + description + switch)
- "Reset to Defaults" button
- Settings gear icon link on the dashboard page header navigates to `/dashboard/settings`

---

## 3. Dashboard Conditional Rendering

**File to change:** `src/app/dashboard/page.tsx`

**Approach:**
- On mount, read `dashboard-card-prefs` from localStorage (with defaults: AI Assistant, Top Nudges, Client News = ON, rest = OFF)
- Wrap existing sections in conditionals
- New cards render as "Coming Soon" placeholders where backend data doesn't exist
- Add a small gear icon button in the dashboard header linking to `/dashboard/settings`

### New card feasibility (data availability)

- **Today's Meetings & Briefs**: Data exists (`meetingRepo.findUpcomingByPartnerId`). Can build fully.
- **Pipeline Pulse**: No pipeline repo/API exists. Placeholder only.
- **Relationship Radar**: Can approximate with `contactRepo.findByPartnerId` + `interactionRepo.findRecentByPartnerId`. Partially buildable.
- **Campaign & Content Dissemination Momentum**: No campaign repo exists. Placeholder only.
- **Whitespace**: Can partially build from `companyRepo` + `contactRepo`. Placeholder for now.
- **Recent Touch Timeline**: Data exists (`interactionRepo.findRecentByPartnerId`). Can build fully.

**For this implementation:** Build the toggle infrastructure for all 9. Fully implement cards where data exists (Today's Meetings, Recent Touch Timeline). Render "Coming Soon" placeholders for cards without backend support (Pipeline Pulse, Campaign & Content Dissemination Momentum, Whitespace). Partially implement Relationship Radar with available data.

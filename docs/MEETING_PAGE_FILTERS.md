# Meetings Page Filtering System

## Problem

Partners can have 100+ meetings/week. The current meetings page has zero filtering -- just a timeline with a show/hide past toggle. Partners need to cut through noise and focus on what matters.

## Data Sources

Each meeting carries rich filterable data through its attendees:

- **Contact importance tier** (CRITICAL / HIGH / MEDIUM / LOW) -- exists in DB, Prisma returns it but frontend type doesn't declare it yet
- **Company name** -- already returned
- **Meeting start time** -- already returned
- **Open MEETING_PREP nudges** -- exist in the nudges table, linkable by contactId
- **Required vs Optional attendance** -- NEW: requires adding `isRequired` boolean to `MeetingAttendee`

## Plan

### 0. Schema: Add `isRequired` to MeetingAttendee

**Files:**

- `prisma/schema.prisma` -- add `isRequired Boolean @default(true) @map("is_required")` to `MeetingAttendee`
- `prisma/seed-data/meetings.ts` -- update seed to return `attendeeContactIds` as `{ contactId, isRequired }[]` so ~70% of attendees are required and ~30% optional (seeded deterministically)
- `prisma/seed.ts` -- update the meeting create loop to pass `isRequired` into the attendee create

Run `npx prisma migrate dev` to generate the migration, then re-seed.

### 1. Backend: Include `importance` in meeting attendee data

**File:** `src/lib/repositories/prisma/meeting-repository.ts`

Prisma already returns all scalar fields including `importance` on contact and `isRequired` on attendee. No repository changes needed -- just update the frontend type.

### 2. Backend: Return open nudge contact IDs alongside meetings

**File:** `src/app/api/meetings/route.ts`

Fetch open MEETING_PREP nudges for the partner and return a `nudgeContactIds` set alongside the meetings array:

```
GET /api/meetings -> { meetings: [...], nudgeContactIds: string[] }
```

### 3. Frontend: Add filter bar to meetings page

**File:** `src/app/meetings/page.tsx`

Add a filter bar between the page header and the timeline, using existing UI patterns:

**Filter row 1 -- Smart views (button row, like nudges Status filter):**

- **All Meetings** (default)
- **Priority Meetings** -- meetings with at least one CRITICAL or HIGH attendee

**Filter row 2 -- Refinement filters:**

- **Date range** (button row): Today | This Week | Next 7 Days | Next 30 Days | All
- **Attendance** (button row): All | Required | Optional -- filters based on whether the partner's contact in the meeting is marked required or optional
- **Attendee tier** (multi-select chips): CRITICAL, HIGH, MEDIUM, LOW -- meeting matches if any attendee is in selected tier(s)
- **Needs Prep** (toggle): only meetings where an attendee has an open MEETING_PREP nudge
- **Company** (multi-select dropdown): derived from unique company names across attendees

**Active filter chips** with "Clear all" (reuse contacts page pattern).

**Meeting count** updates to reflect filtered results.

### 4. Frontend: Update Meeting type and TimelineMeetingCard

- Extend the `Meeting` type to include `contact.importance` and `isRequired` on attendees
- Add a small **tier indicator** on `TimelineMeetingCard` -- colored dot or badge when a meeting has a CRITICAL/HIGH attendee
- Add an **"Optional"** badge on meetings where the partner's attendee is optional, so it's visible at a glance

### 5. Default view

- **Time range:** This Week (reduces ~100 meetings to ~20-30)
- **Smart view:** All Meetings (not pre-filtered to priority)
- **Attendance:** All (shows both required and optional)
- **Past meetings:** Hidden by default (existing behavior)

This gives partners a manageable starting view while one-click "Priority Meetings" or "Required" instantly cuts further.

## Filter logic (all client-side)

```
meeting passes filter IF:
  (smartView === "all" OR meeting has CRITICAL/HIGH attendee)
  AND (dateRange matches startTime)
  AND (attendance === "all" OR any attendee.isRequired matches filter)
  AND (no tier selected OR any attendee in selected tiers)
  AND (needsPrep OFF OR any attendee contactId in nudgeContactIds)
  AND (no company selected OR any attendee company in selected companies)
```

## What is NOT in scope (Phase 2)

- Meeting type/category field (requires schema change + data entry UX)
- Full-text search across title/purpose/attendees
- Saved filter presets

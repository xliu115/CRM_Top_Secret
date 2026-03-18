# Activate CRM — Product Requirements: Four New Features

This document specifies detailed product requirements for four new features on the Activate CRM platform. It is written for developers to implement with minimal ambiguity. All references to existing code paths, models, and services are accurate as of the codebase exploration.

---

## Table of Contents

1. [Feature 1: Stale Contact Dashboard](#feature-1-stale-contact-dashboard)
2. [Feature 2: Company-Level View](#feature-2-company-level-view)
3. [Feature 3: Meeting Follow-Up Drafts](#feature-3-meeting-follow-up-drafts)
4. [Feature 4: Configurable Nudge Rules](#feature-4-configurable-nudge-rules)

---

## Feature 1: Stale Contact Dashboard

### Overview

A dedicated view (or dashboard enhancement) that surfaces contacts whose relationships are cooling, ranked by urgency. It acts as a "relationship health" view, working with the nudge engine's existing STALE_CONTACT rules and the Interaction data model.

### User Stories

1. **As a partner**, I want to see a list of contacts whose relationships are cooling (ordered by how long it's been since we last connected), so that I can prioritize who to reach out to first.
2. **As a partner**, I want to see how many days it's been since I last interacted with each contact, so that I know the urgency level.
3. **As a partner**, I want to distinguish between critical/high-priority contacts and medium/low ones when they're stale, so that I can focus on my most important relationships.
4. **As a partner**, I want to click a contact and go directly to their contact detail page, so that I can take action (e.g., draft an email) immediately.
5. **As a partner**, I want to access this view from the dashboard or navigation, so that it's part of my daily workflow.

### Detailed Functional Requirements

1. **Data source**
   - Use the same logic as `refreshNudgesForPartner` in `src/lib/services/nudge-engine.ts` for determining staleness.
   - Staleness is derived from the most recent `Interaction` per contact (by `Interaction.date` desc). If no interaction exists, treat as "never contacted" or use a very large `daysSince` (e.g., 999).
   - Apply the same tier logic:
     - **> 90 days**: Critical relationship risk (URGENT for CRITICAL importance, HIGH otherwise)
     - **> 60 days**: Relationship cooling (HIGH for CRITICAL/HIGH importance, MEDIUM otherwise)
     - **30–60 days**: Only for CRITICAL/HIGH importance contacts (MEDIUM priority)

2. **Display**
   - Show all contacts that meet at least one of the above staleness thresholds.
   - Display for each contact: name, title, company name, importance, days since last contact, last interaction type/date.
   - Rank by: (a) urgency tier (URGENT > HIGH > MEDIUM), (b) days since last contact (descending), (c) contact importance.
   - Support an optional filter: by importance (CRITICAL, HIGH, MEDIUM, LOW) and/or by staleness tier.

3. **Empty states**
   - If no contacts are stale: show a positive message such as "All relationships look healthy. No contacts need attention."

4. **Integration with nudges**
   - Contacts shown may or may not have an existing OPEN nudge. The stale view is independent of the nudge engine's output (it computes staleness in real time). Optionally, show a badge if the contact has an open STALE_CONTACT nudge.

### Data Model Changes

No Prisma schema changes required. Use existing models:
- `Contact` (with `company`, `importance`, `lastContacted` if populated)
- `Interaction` (for `date`, `type`, `summary`)

**Note:** The nudge engine uses `interactionsByContact` and derives `daysSince` from the most recent interaction. The Stale Contact view should compute the same metric for consistency. Optionally, we could add a computed/cached field later; for v1, compute on read.

### API Design

**Endpoint:** `GET /api/stale-contacts`

**Query parameters (optional):**
- `importance` — filter by Contact.importance: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- `tier` — filter by staleness tier: `critical` (>90d), `cooling` (60–90d), `at_risk` (30–60d for HIGH/CRITICAL only)
- `limit` — max items to return (default 50)

**Response:**
```json
{
  "contacts": [
    {
      "id": "string",
      "name": "string",
      "title": "string",
      "importance": "string",
      "company": { "id": "string", "name": "string" },
      "daysSinceLastContact": "number | null",
      "lastInteraction": {
        "id": "string",
        "type": "string",
        "date": "string (ISO8601)",
        "summary": "string"
      } | null,
      "staleTier": "critical" | "cooling" | "at_risk",
      "hasOpenStaleNudge": "boolean"
    }
  ]
}
```

### UI/UX Spec

**Option A (recommended): Dedicated page**
- **Route:** `/stale-contacts` or `/dashboard/stale-contacts`
- **Layout:** Use `DashboardShell` (same as `src/app/dashboard/page.tsx`).
- **Structure:**
  - Page title: "Stale Contacts" or "Relationship Health"
  - Subtitle: "Contacts whose relationships may be cooling — prioritize your outreach."
  - Optional filter bar (importance, tier) matching existing filter patterns on `src/app/nudges/page.tsx`.
  - Table or card list of stale contacts, each row/card: avatar, name, title, company, importance badge, days since last contact, last interaction summary, link to `/contacts/[id]`.
  - Sorted by urgency (URGENT first) then days since contact (highest first).

**Option B: Dashboard enhancement**
- Add a new card/section on `src/app/dashboard/page.tsx` titled "Relationships Needing Attention" that shows top 5–10 stale contacts, with a "View all" link to the dedicated page.
- The dedicated page can still exist for the full list.

**Navigation:**
- Add a sidebar nav item in `src/components/layout/sidebar.tsx`:
  - Label: "Stale Contacts" or "Relationship Health"
  - Icon: `TrendingDown` or `AlertTriangle` from lucide-react
  - Path: `/stale-contacts`

### Integration Points

- **Nudge engine:** Uses the same staleness logic as `src/lib/services/nudge-engine.ts` (lines 84–115). Consider extracting a shared `getStaleContactsForPartner(partnerId)` helper to avoid duplication.
- **Contact detail:** Each contact links to `/contacts/[id]` where the partner can use "Draft an Email" (`/api/contacts/[id]/draft-email`).
- **Dashboard:** Optional stat card or summary linking to the stale contacts page.
- **Auth:** Use `requirePartnerId()` from `src/lib/auth/get-current-partner.ts` for API auth.

### Edge Cases & Constraints

1. **No interactions:** If a contact has zero interactions, `daysSince` = 999. Include these in the list with a clear "Never contacted" or similar label.
2. **Contact.lastContacted:** The nudge engine derives staleness from `Interaction.date`. The UI may optionally display `contact.lastContacted` if it exists and differs (e.g., for contacts with no logged interactions but manual updates).
3. **Performance:** For partners with many contacts, ensure the API batches queries (contacts + interactions) efficiently. The nudge engine already does this pattern.
4. **Permissions:** Only show contacts belonging to the authenticated partner (`contact.partnerId`).

### Acceptance Criteria

1. ✅ Partner can navigate to a Stale Contacts page from the sidebar.
2. ✅ Page displays all contacts meeting staleness criteria, sorted by urgency and days since contact.
3. ✅ Each contact shows: name, title, company, importance, days since last contact, last interaction (if any).
4. ✅ Clicking a contact navigates to `/contacts/[id]`.
5. ✅ Optional filters (importance, tier) work correctly.
6. ✅ Empty state displays when no contacts are stale.
7. ✅ API returns 401 when unauthenticated.

---

## Feature 2: Company-Level View

### Overview

A company detail page that aggregates all contacts, signals, interactions, meetings, and engagement data for a single company. Partners manage accounts at the company level and need to see the full picture of a relationship with an organization, not just individual contacts.

### User Stories

1. **As a partner**, I want to view a company page that shows all my contacts at that company, so that I can see my full network there.
2. **As a partner**, I want to see all signals (news, events, job changes) associated with that company, so that I have context for outreach.
3. **As a partner**, I want to see a timeline of all interactions and meetings across my contacts at that company, so that I understand the overall engagement history.
4. **As a partner**, I want to see engagement data (events, articles, campaigns) for contacts at that company, so that I can assess relationship depth.
5. **As a partner**, I want to navigate to this company page from contacts, the dashboard, or the chat, so that it's easy to find.

### Detailed Functional Requirements

1. **Company selection**
   - Companies are derived from contacts: a partner has access to companies that have at least one contact they own (`Contact.partnerId`).
   - No company exists in isolation — we only show companies that the partner has contacts at.

2. **Company header**
   - Display: company name, industry, description, employee count, website (from `Company` model).
   - Link to website if present.

3. **Contacts tab/section**
   - List all contacts at this company owned by the partner.
   - For each: name, title, email, importance, last contacted, link to `/contacts/[id]`.
   - Sort by importance (CRITICAL, HIGH, MEDIUM, LOW) then name.

4. **Signals tab/section**
   - All `ExternalSignal` where `companyId = company.id` (company-level signals).
   - All `ExternalSignal` where `contactId` in partner's contacts at this company (contact-level signals for these contacts).
   - Display: type, date, content, url, confidence. Sorted by date desc.

5. **Interactions tab/section**
   - All `Interaction` for contacts at this company. Include contact name. Sorted by date desc.

6. **Meetings tab/section**
   - All `Meeting` where at least one attendee is a contact at this company.
   - Display: title, startTime, purpose, attendees (with company). Link to `/meetings/[id]`.
   - Split into upcoming vs past if useful.

7. **Engagement tab/section**
   - Events: `EventRegistration` for contacts at this company.
   - Articles: `ArticleEngagement` for contacts at this company.
   - Campaigns: `CampaignOutreach` for contacts at this company.
   - Use similar table layout as `src/app/contacts/[id]/page.tsx` Reach & Engagement tab.

8. **Summary stats**
   - Top of page: contact count, total interactions, open nudges (for this company's contacts), upcoming meetings (involving this company's contacts).

### Data Model Changes

No new Prisma models required. Existing `Company` model has:
- `id`, `name`, `industry`, `description`, `employeeCount`, `website`
- Relations: `contacts`, `signals`

We need a new **Company repository** (or equivalent service) to:
- Find companies by partner (companies that have at least one contact with `partnerId`).
- Find company by id with partner access check (company must have at least one contact owned by partner).

**Suggested repository interface** (add to `src/lib/repositories/interfaces/`):

```typescript
// company-repository.ts
import type { Company, Contact } from "@prisma/client";

export type CompanyWithContacts = Company & {
  contacts: (Contact & { /* optionally include last interaction summary */ })[];
};

export interface ICompanyRepository {
  findByPartnerId(partnerId: string): Promise<CompanyWithContacts[]>;
  findById(id: string, partnerId: string): Promise<CompanyWithContacts | null>;
}
```

Implementation: `PrismaCompanyRepository` in `src/lib/repositories/prisma/company-repository.ts` that:
- `findByPartnerId`: `prisma.company.findMany({ where: { contacts: { some: { partnerId } } }, include: { contacts: { where: { partnerId } } } })`
- `findById`: Same pattern with `id` filter and partner check.

### API Design

**Endpoint 1:** `GET /api/companies`

Returns companies the partner has contacts at.

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    "industry": "string",
    "contactCount": "number",
    "lastInteractionDate": "string | null"
  }
]
```

**Endpoint 2:** `GET /api/companies/[id]`

Returns full company detail with aggregated data. Partner must have at least one contact at this company.

**Response:**
```json
{
  "company": {
    "id": "string",
    "name": "string",
    "industry": "string",
    "description": "string",
    "employeeCount": "number",
    "website": "string"
  },
  "stats": {
    "contactCount": "number",
    "totalInteractions": "number",
    "openNudgeCount": "number",
    "upcomingMeetingCount": "number"
  },
  "contacts": [ /* ContactWithCompany[] */ ],
  "signals": [ /* ExternalSignal[] with optional contact/company info */ ],
  "interactions": [ /* Interaction[] with contact info */ ],
  "meetings": [ /* Meeting[] with attendees */ ],
  "engagements": {
    "events": [ /* EventRegistration[] */ ],
    "articles": [ /* ArticleEngagement[] */ ],
    "campaigns": [ /* CampaignOutreach[] */ ]
  }
}
```

### UI/UX Spec

**Route:** `/companies/[id]/page.tsx`

**Layout:** `DashboardShell`

**Structure:**
- Back button: "Back to Companies" or "Back to Contacts" (link to `/companies` or `/contacts`).
- Company header card: name, industry, description, website link, employee count.
- Stats row: 4 mini cards (Contacts, Interactions, Open Nudges, Upcoming Meetings) — reuse pattern from dashboard.
- Tabs (same component as contact detail): `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.
  - Tab 1: **Contacts** — list of contacts with avatar, name, title, importance, last contacted, link.
  - Tab 2: **Signals** — cards for each signal (type, date, content, url).
  - Tab 3: **Interactions** — timeline of interactions with contact name.
  - Tab 4: **Meetings** — list of meetings (upcoming first, then past) with attendees.
  - Tab 5: **Engagement** — events, articles, campaigns tables (mirror contact detail Reach & Engagement).

**Companies list page:** `/companies/page.tsx`
- List companies the partner has contacts at. Search by company name. Link each to `/companies/[id]`.
- Add sidebar nav: "Companies" with `Building2` icon, path `/companies`.

**Navigation:**
- Add to `src/components/layout/sidebar.tsx`: `{ href: "/companies", label: "Companies", icon: Building2 }`.
- From contact detail: add link on company name to `/companies/[companyId]`.
- From dashboard: optionally link company name in recent interactions to company page.

### Integration Points

- **Contact repository:** `contactRepo.findById`, `contactRepo.findByPartnerId` — filter by `companyId` for company-scoped lists.
- **Signal repository:** `signalRepo.findByCompanyId`, `signalRepo.findByContactIds` (for contact-level signals at this company).
- **Interaction repository:** `interactionRepo.findByContactIds` with company's contact ids.
- **Meeting repository:** `meetingRepo.findByPartnerId` then filter by attendee company.
- **Engagement repository:** `engagementRepo.findEventsByContactId`, etc., for each contact.
- **Nudge repository:** `nudgeRepo.findByPartnerId` then filter by contact companyId.
- **RAG/Chat:** Extend `rag-service.ts` so company-level queries can return company summary + contacts. Chat suggested questions could include "Show me my relationship with [Company]".

### Edge Cases & Constraints

1. **Company with no contacts:** Should not appear in partner's company list (we only show companies with partner's contacts).
2. **Orphaned companies:** If all contacts are removed from a company, the company may still exist but won't be accessible (no contacts → no access).
3. **Multiple contacts per company:** Very common. Ensure UI handles 1 or many contacts gracefully.
4. **Large companies:** Pagination or virtualization may be needed for signals/interactions if count is high. Start with limit (e.g., 50 most recent) and "Load more" if needed.
5. **Permission:** Always verify partner has at least one contact at the company before returning data.

### Acceptance Criteria

1. ✅ Partner can navigate to Companies from sidebar and see list of companies they have contacts at.
2. ✅ Partner can open a company detail page and see company info, stats, contacts, signals, interactions, meetings, and engagement.
3. ✅ Each contact links to `/contacts/[id]`.
4. ✅ Each meeting links to `/meetings/[id]`.
5. ✅ Company name on contact detail page links to `/companies/[companyId]`.
6. ✅ API returns 404 when company id is invalid or partner has no access.
7. ✅ API returns 401 when unauthenticated.

---

## Feature 3: Meeting Follow-Up Drafts

### Overview

After a meeting has occurred (past meetings), partners can generate a follow-up email draft (thank-you, next steps, action items). This integrates with the existing meeting brief, LLM service, and email draft patterns.

### User Stories

1. **As a partner**, I want to generate a follow-up email draft after a past meeting, so that I can quickly send thank-you notes and recap next steps.
2. **As a partner**, I want the draft to include a thank-you, meeting recap, and action items based on the meeting brief, so that it feels personalized and professional.
3. **As a partner**, I want to choose which attendee(s) to address in the email, so that I can send to one primary contact or multiple.
4. **As a partner**, I want to edit and copy the draft like the contact email draft, so that I can refine before sending.
5. **As a partner**, I want to access this from both the meeting detail page and the contact page (for past meetings), so that I have multiple entry points.

### Detailed Functional Requirements

1. **Eligibility**
   - Follow-up draft is only available for **past meetings** (`Meeting.startTime < now`).
   - Upcoming meetings do not show the "Draft Follow-Up" option.

2. **Inputs**
   - Meeting id (required).
   - Optional: `recipientContactIds` — array of contact ids (attendees) to address. Default: all attendees.
   - Optional: `tone` — "formal" | "friendly" | "brief" (for future extensibility; can be ignored in v1).

3. **LLM context**
   - Meeting: title, purpose, notes, `generatedBrief` (if available).
   - Attendees: name, title, company, recent interactions, signals (same as brief).
   - Partner name.
   - Instruction: Generate a follow-up email that thanks attendees, briefly recaps key points/outcomes, and lists agreed next steps or action items. Keep under 250 words. Use professional tone.

4. **Output**
   - `subject`: string (e.g., "Thank you — [Meeting title]")
   - `body`: string (email body, plain text or markdown)
   - Same shape as existing `generateEmail` response for consistency.

5. **UI entry points**
   - **Meeting detail page** (`/meetings/[id]`): Add "Draft Follow-Up" button when meeting is past. Opens a panel/card similar to contact's "Draft Email" panel.
   - **Contact detail page** (`/contacts/[id]`): In `MeetingCard` for past meetings, add "Draft Follow-Up" button next to "View Brief" / "Generate Brief".

6. **Panel behavior**
   - Editable subject and body (Input, Textarea).
   - "Copy to Clipboard" button.
   - "Regenerate" button to create a new draft.
   - Same UX patterns as `src/app/contacts/[id]/page.tsx` email draft panel (lines 318–395).

### Data Model Changes

No Prisma schema changes. Use existing:
- `Meeting` (id, title, purpose, notes, generatedBrief, startTime)
- `MeetingAttendee` (meetingId, contactId)
- `Contact`, `Interaction`, `ExternalSignal` for attendee context

Optional future: store generated follow-up drafts in a new table if we want history. For v1, generate on demand only.

### API Design

**Endpoint:** `POST /api/meetings/[id]/follow-up-draft`

**Request body:**
```json
{
  "recipientContactIds": ["string"] // optional; default all attendees
}
```

**Response:**
```json
{
  "subject": "string",
  "body": "string"
}
```

**Errors:**
- 404: Meeting not found or not owned by partner
- 400: Meeting is in the future (follow-up only for past meetings)

### LLM Service Extension

Add to `src/lib/services/llm-service.ts`:

```typescript
export interface MeetingFollowUpContext {
  partnerName: string;
  meetingTitle: string;
  meetingPurpose: string;
  meetingNotes: string | null;
  meetingBrief: string | null;
  recipients: {
    name: string;
    title: string;
    company: string;
    recentInteractions: string[];
    signals: string[];
  }[];
}

export async function generateMeetingFollowUp(ctx: MeetingFollowUpContext): Promise<{
  subject: string;
  body: string;
}> {
  // Use callLLM with a prompt that:
  // - Thanks the recipient(s)
  // - Recaps key outcomes from the meeting (from brief, purpose, notes)
  // - Lists next steps / action items
  // - Keeps it professional and under 250 words
  // - Returns JSON: { subject, body }
  // Fallback to generateFollowUpTemplate(ctx) if LLM fails
}
```

### UI/UX Spec

**Meeting detail page** (`src/app/meetings/[id]/page.tsx`):
- Below the Meeting Brief card, add a "Follow-Up Email" card.
- Only render when `new Date(meeting.startTime) < new Date()`.
- Button: "Draft Follow-Up Email". On click, call `POST /api/meetings/[id]/follow-up-draft`, show loading state, then display subject/body in editable fields with Copy and Regenerate buttons.
- Reuse the card/panel structure from contact detail's draft panel (bordered, with close/minimize if desired).

**Contact detail page** (`src/app/contacts/[id]/page.tsx`):
- In `MeetingCard` for past meetings (`isPast={true}`), add "Draft Follow-Up" button alongside "View Brief" / "Generate Brief".
- Click opens an inline panel or modal with the draft form. Alternatively, link to `/meetings/[id]` with a query param or hash to scroll to the follow-up section.

**Recommended:** Implement on meeting detail first; add a smaller "Draft Follow-Up" entry on contact page that navigates to meeting detail with focus on follow-up section, or opens a modal that fetches the draft.

### Integration Points

- **Meeting brief:** Use `meeting.generatedBrief` if present; if not, the prompt can note "No brief available" and rely on purpose/notes/attendee context.
- **LLM service:** New `generateMeetingFollowUp` function, parallel to `generateEmail` and `generateMeetingBrief`.
- **Meeting repository:** `meetingRepo.findById(id, partnerId)` for access check.
- **Interaction/Signal repos:** Same as brief generation for attendee context.
- **Email draft pattern:** Reuse Copy/Regenerate/Edit UX from contact draft panel.

### Edge Cases & Constraints

1. **No brief:** Meeting may not have `generatedBrief`. Prompt should still work with title, purpose, notes, attendee context.
2. **No attendees:** Unlikely (schema requires attendees), but handle gracefully.
3. **Future meeting:** API must return 400 if meeting hasn't occurred yet.
4. **Single vs multiple recipients:** Prompt should handle "Dear [Name]" vs "Dear [Name1] and [Name2]" or "Dear all" for multiple.
5. **LLM failure:** Fallback template (e.g., "Thank you for your time... Here are the next steps we discussed...") as in `generateEmailTemplate`.
6. **Long meetings:** Brief and notes might be long; truncate in prompt if needed (e.g., 500 chars of brief).

### Acceptance Criteria

1. ✅ "Draft Follow-Up" appears on past meeting detail page and on past meeting cards on contact page.
2. ✅ "Draft Follow-Up" does NOT appear for upcoming meetings.
3. ✅ API generates a subject and body including thank-you, recap, and next steps.
4. ✅ Partner can edit, copy, and regenerate the draft.
5. ✅ API returns 400 for future meetings.
6. ✅ API returns 404 for invalid/unauthorized meeting.
7. ✅ Fallback template works when LLM is unavailable.

---

## Feature 4: Configurable Nudge Rules

### Overview

Partners can customize which nudge rules are active and their thresholds (e.g., "alert me after 45 days instead of 60", "disable ARTICLE_READ nudges"). This integrates with the existing nudge engine without breaking the refresh pipeline.

### User Stories

1. **As a partner**, I want to change the staleness threshold for STALE_CONTACT (e.g., 45 days instead of 60), so that I get nudges earlier for my high-value relationships.
2. **As a partner**, I want to turn off specific rule types (e.g., ARTICLE_READ, COMPANY_NEWS), so that I'm not overwhelmed by nudges I don't care about.
3. **As a partner**, I want to see the current configuration with sensible defaults, so that I understand what's active.
4. **As a partner**, I want my custom rules to persist and apply on every nudge refresh, so that I don't have to reconfigure.
5. **As a partner**, I want to reset to defaults if I change my mind, so that I can start over.

### Detailed Functional Requirements

1. **Rule types to support (from nudge-engine.ts)**
   - `STALE_CONTACT` — thresholds: 90d, 60d, 30d (for HIGH/CRITICAL only)
   - `JOB_CHANGE` — window: 30 days
   - `COMPANY_NEWS` — window: 14 days
   - `UPCOMING_EVENT` — window: 0–21 days before event
   - `MEETING_PREP` — window: 0–3 days before meeting
   - `EVENT_ATTENDED` — window: 0–30 days after event
   - `EVENT_REGISTERED` — window: 0–14 days before event
   - `ARTICLE_READ` — window: 14 days after view

2. **Configurable parameters**
   - **Enabled/disabled:** Boolean per rule type. If disabled, that rule never generates nudges.
   - **STALE_CONTACT thresholds:** Override default days for each tier:
     - `staleCriticalDays` (default 90) — > this = URGENT/HIGH
     - `staleCoolingDays` (default 60) — 60–90 = HIGH/MEDIUM
     - `staleAtRiskDays` (default 30) — 30–60 for HIGH/CRITICAL only
   - **Other rules:** Optional threshold overrides (e.g., `jobChangeWindowDays`, `newsWindowDays`) for future extensibility. V1 can focus on STALE_CONTACT + enable/disable.

3. **Default configuration**
   - All rules enabled.
   - Default thresholds as in current nudge-engine (90, 60, 30 for STALE_CONTACT).

4. **Scope**
   - Configuration is per-partner. Stored in DB keyed by `partnerId`.

5. **Refresh pipeline**
   - `refreshNudgesForPartner` must read the partner's rule config before evaluating rules.
   - If a rule is disabled, skip that rule entirely.
   - If thresholds are overridden (e.g., `staleCoolingDays: 45`), use 45 instead of 60.

### Data Model Changes

**New model: `NudgeRuleConfig`**

```prisma
model NudgeRuleConfig {
  id                    String   @id @default(uuid())
  partnerId             String   @unique @map("partner_id")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  // Per-rule enable/disable
  staleContactEnabled   Boolean  @default(true) @map("stale_contact_enabled")
  jobChangeEnabled      Boolean  @default(true) @map("job_change_enabled")
  companyNewsEnabled    Boolean  @default(true) @map("company_news_enabled")
  upcomingEventEnabled  Boolean  @default(true) @map("upcoming_event_enabled")
  meetingPrepEnabled    Boolean  @default(true) @map("meeting_prep_enabled")
  eventAttendedEnabled  Boolean  @default(true) @map("event_attended_enabled")
  eventRegisteredEnabled Boolean @default(true) @map("event_registered_enabled")
  articleReadEnabled    Boolean  @default(true) @map("article_read_enabled")

  // STALE_CONTACT thresholds (days)
  staleCriticalDays     Int      @default(90) @map("stale_critical_days")
  staleCoolingDays      Int      @default(60) @map("stale_cooling_days")
  staleAtRiskDays       Int      @default(30) @map("stale_at_risk_days")

  partner               Partner  @relation(fields: [partnerId], references: [id], onDelete: Cascade)

  @@map("nudge_rule_configs")
}
```

**Partner model update:**
```prisma
model Partner {
  // ... existing fields
  nudgeRuleConfig NudgeRuleConfig?
}
```

**Migration:** Add the new table and `Partner` relation. Create default config for existing partners on first read (lazy init) or via migration script.

### API Design

**Endpoint 1:** `GET /api/nudge-rules`

Returns the partner's current nudge rule configuration. Creates default if none exists.

**Response:**
```json
{
  "id": "string",
  "staleContactEnabled": true,
  "jobChangeEnabled": true,
  "companyNewsEnabled": true,
  "upcomingEventEnabled": true,
  "meetingPrepEnabled": true,
  "eventAttendedEnabled": true,
  "eventRegisteredEnabled": true,
  "articleReadEnabled": true,
  "staleCriticalDays": 90,
  "staleCoolingDays": 60,
  "staleAtRiskDays": 30
}
```

**Endpoint 2:** `PATCH /api/nudge-rules`

Update the partner's configuration. Partial updates allowed.

**Request body:**
```json
{
  "staleContactEnabled": false,
  "staleCoolingDays": 45,
  "articleReadEnabled": false
}
```

**Response:** Updated config (same shape as GET).

**Endpoint 3:** `POST /api/nudge-rules/reset`

Reset to defaults. Request body: `{}` or none. Response: Updated config.

### Nudge Engine Integration

Refactor `src/lib/services/nudge-engine.ts`:

1. At start of `refreshNudgesForPartner(partnerId)`:
   - Call `nudgeRuleConfigRepo.findByPartnerId(partnerId)` or equivalent. If null, create default and persist.
   - Store config in a variable `config`.

2. For STALE_CONTACT:
   - Replace hardcoded 90, 60, 30 with `config.staleCriticalDays`, `config.staleCoolingDays`, `config.staleAtRiskDays`.
   - If `!config.staleContactEnabled`, skip the entire STALE_CONTACT block.

3. For each other rule (JOB_CHANGE, COMPANY_NEWS, etc.):
   - Wrap in `if (config.jobChangeEnabled)` etc. If disabled, skip.

4. No changes to `deleteOpenByPartnerId` or `createMany` — only the rule evaluation logic changes.

**Repository:** Add `NudgeRuleConfigRepository` with `findByPartnerId`, `upsert`, `resetToDefaults`.

### UI/UX Spec

**Route:** `/settings/nudge-rules` or `/nudges/settings` or under an existing Settings page.

**Layout:** `DashboardShell`

**Structure:**
- Page title: "Nudge Rules"
- Subtitle: "Customize which nudges you receive and when."
- Form or card-based UI:

  **Section 1: Rule toggles**
  - List each rule type with a switch/toggle:
    - Stale Contact (relationship cooling)
    - Job Change
    - Company News
    - Upcoming Event
    - Meeting Prep
    - Event Attended
    - Event Registered
    - Article Read
  - Each with a short description (e.g., "Alert when a contact hasn't been contacted in X days").

  **Section 2: Staleness thresholds**
  - Only visible when "Stale Contact" is enabled.
  - Three number inputs:
    - "Critical (days)" — default 90
    - "Cooling (days)" — default 60
    - "At risk (days)" — default 30 (for HIGH/CRITICAL contacts only)
  - Validation: critical > cooling > at_risk, all between 1 and 365.

  **Section 3: Actions**
  - "Save" button — PATCH /api/nudge-rules with form state.
  - "Reset to defaults" button — POST /api/nudge-rules/reset, then refetch.

**Navigation:**
- Add "Settings" or "Nudge Settings" link. Options:
  - Under Nudges page: "Nudge Settings" in header or filter bar.
  - Global Settings page: `/settings` with sub-page `/settings/nudge-rules`.
  - Sidebar: "Settings" with gear icon, or "Nudge Rules" under Nudges dropdown if we add one.

**Recommended:** Add a "Settings" or "Nudge Rules" link in the Nudges page header (`src/app/nudges/page.tsx`), next to "Refresh Nudges".

### Integration Points

- **Nudge engine:** Primary integration. Must read config at start of `refreshNudgesForPartner` and apply to all rule evaluation.
- **Refresh pipeline:** `POST /api/nudges/refresh` — no API change; the engine internally uses the new config.
- **Auth:** `requirePartnerId()` for all nudge-rules API routes.
- **Seed:** Optionally seed default configs for demo partners.

### Edge Cases & Constraints

1. **First-time config:** If no config exists, create default on first GET. Use upsert pattern for PATCH.
2. **Invalid thresholds:** Validate that staleCriticalDays > staleCoolingDays > staleAtRiskDays. Reject invalid PATCH with 400.
3. **All rules disabled:** Allow it. Partner may want to pause nudges entirely. Result: `refreshNudgesForPartner` creates 0 nudges.
4. **Backward compatibility:** Existing partners get default config on first refresh (lazy create) or via migration.
5. **Concurrent refresh:** Config is read at start of each refresh. No need for locking; last write wins.
6. **Rule type renames:** If we add new rules later, config model may need new columns or a JSON column for extensibility. V1 uses fixed columns.

### Acceptance Criteria

1. ✅ Partner can view current nudge rule configuration.
2. ✅ Partner can enable/disable each rule type.
3. ✅ Partner can change STALE_CONTACT thresholds (critical, cooling, at-risk days).
4. ✅ Partner can reset to defaults.
5. ✅ After saving, the next "Refresh Nudges" uses the new config.
6. ✅ Disabled rules produce no nudges.
7. ✅ Custom thresholds (e.g., 45 days) correctly change when STALE_CONTACT nudges are generated.
8. ✅ API validates threshold ordering and returns 400 for invalid input.
9. ✅ Unauthenticated requests return 401.

---

## Implementation Order Recommendation

1. **Feature 4 (Configurable Nudge Rules)** — Foundation for better control; relatively isolated.
2. **Feature 1 (Stale Contact Dashboard)** — High user value; can reuse/extract logic from nudge engine (which will then use config).
3. **Feature 2 (Company-Level View)** — Larger scope; needs new repo and pages.
4. **Feature 3 (Meeting Follow-Up Drafts)** — Builds on existing meeting/LLM patterns; good final piece.

---

*Document version: 1.0 | Last updated: 2025-03-17*

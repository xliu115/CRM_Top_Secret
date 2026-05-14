# Design: Your Campaigns — Content Sharing & Engagement Tracking

**Status:** APPROVED
**Date:** 2026-04-01
**Approach:** Campaign-First (new first-class entity)
**Effort:** L (human: ~2 weeks / CC: ~2-3 hours)

## Overview

Partners at McKinsey collectively refer to any bulk share of content — articles, events, or plain outreach emails — as "campaigns." This feature replaces the Campaigns tab placeholder with a full campaign management system where Partners can browse McKinsey articles and events, select content to share with their contacts, send AI-personalized campaign emails, and track engagement (opens, clicks, article reads, event registrations/attendance) both per-contact and in aggregate.

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Sending model | Hybrid — send from ClientIQ + import external campaigns via API | Partners need both: ClientIQ-sent for new campaigns, imported for historical/external data |
| Content library | System-managed, read-only for Partners | Articles fetched from mckinsey.com via Tavily web search (v1); events from seed data. Future: API integration with firm's content/event platforms |
| Tracking | Automatic open/click for ClientIQ-sent; imported data for external | Tracking pixel + link wrapping for ClientIQ campaigns; external campaigns bring their own engagement data |
| Contact selection | Manual pick + smart segments, reviewable before send | Full flexibility — pick individuals or define criteria, always review the final list |
| Email personalization | Base template with AI-personalized opening per recipient | Consistent core message with a personal touch using relationship context |
| Landing page | Campaign list view with sub-tabs for Articles and Events | Partners think "my campaigns" as the primary view, with content browsing as a secondary entry point |
| Campaign scope | Multi-content — zero, one, or many articles/events per campaign | A campaign can be a plain email, a single article share, or a mini newsletter |
| External import | API ingestion from marketing platform | Fully automated; CSV import deferred |
| Ownership | Partner-scoped — each Partner sees only their own campaigns | Consistent with existing `partnerId` scoping across the app |

## 1. Data Model

All models follow existing Prisma conventions: `@map("snake_case")` for fields, `@@map("table_name")` for tables, `@@index` on foreign keys and hot query paths. Enums stored as `String` (consistent with existing codebase pattern for flexibility).

### ContentItem — Shared content library

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| type | String | `ARTICLE` or `EVENT` |
| title | string | Display name |
| description | string? | Short summary |
| url | string? | Link to content (mckinsey.com article URL, event landing page) |
| imageUrl | string? | Thumbnail/hero image URL for display in cards |
| practice | string? | Practice area (AI, TMT, GEM, etc.) |
| publishedAt | DateTime? | Article publication date or event date |
| eventDate | DateTime? | Events only — when the event takes place |
| eventLocation | string? | Events only |
| eventType | string? | In-person / Virtual / Hybrid |
| sourceId | string? | External ID from the originating system (for deduplication on re-fetch) |
| createdAt | DateTime | |
| updatedAt | DateTime | For sync/ingestion freshness |

Indexes: `@@index([type])`, `@@index([practice])`, `@@index([sourceId])`
Table: `@@map("content_items")`

#### Content ingestion (v1 — articles)

Articles are fetched from mckinsey.com using the existing Tavily web search integration (`@tavily/core`, already in `package.json` and used by `news-ingestion-service.ts`). A new service `content-ingestion-service.ts` runs a Tavily search for recent McKinsey Insights articles, extracts title, URL, description, practice area, and publication date, and upserts into `ContentItem`. Deduplication via `sourceId` (derived from URL). This can run as a cron job (e.g., daily) or be triggered manually from an admin action.

#### Content ingestion (v1 — events)

Events are seeded from the existing `eventNames`, `practices`, `locations`, and `eventTypes` data in `prisma/seed-data/engagements.ts`. Future: API integration with the firm's event management platform.

#### Content ingestion (future)

Both articles and events will migrate to API integration with the firm's content and event platforms, replacing the Tavily fetch and seed data respectively.

### Campaign — First-class campaign entity

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| partnerId | string | FK to Partner (owner) |
| name | string | Partner-chosen campaign name |
| subject | string? | Email subject line |
| bodyTemplate | text? | Base email template (before personalization) |
| source | String | `ACTIVATE` or `IMPORTED` |
| status | String | `DRAFT`, `SENDING`, `SENT`, `FAILED` |
| segmentCriteria | String? | JSON — stored segment rules used to build recipient list, for reference only |
| sentAt | DateTime? | When the campaign was sent |
| sendStartedAt | DateTime? | When the send job started (for stuck-job detection) |
| lastError | String? | Error message on failure (partial or total) |
| importedFrom | string? | Source system name for imported campaigns |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Indexes: `@@index([partnerId])`, `@@index([partnerId, status])`, `@@index([status])`
Table: `@@map("campaigns")`

Status transitions: `DRAFT → SENDING → SENT` (happy path), `DRAFT → SENDING → FAILED` (total failure), `SENDING → SENT` with some recipients `FAILED` (partial). If `SENDING` persists for >10 minutes (based on `sendStartedAt`), the job is considered stuck and can be retried.

### CampaignContent — Join table: campaigns ↔ content items

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| campaignId | string | FK to Campaign |
| contentItemId | string | FK to ContentItem |
| position | int | Display order in the email |

Indexes: `@@index([campaignId])`, `@@index([contentItemId])`
Constraint: `@@unique([campaignId, contentItemId])`
Table: `@@map("campaign_contents")`

Note: Plain email campaigns (no content items) simply have zero `CampaignContent` rows. The join table is not used to model "no content."

### CampaignRecipient — Each contact in a campaign

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| campaignId | string | FK to Campaign |
| contactId | string? | FK to Contact (nullable for unmatched imported recipients) |
| unmatchedEmail | string? | Email address when contact can't be matched (imports only) |
| personalizedBody | text? | AI-personalized email body for this recipient |
| rsvpToken | string? | Unique opaque token for personalized RSVP link (event campaigns only) |
| rsvpStatus | String? | `PENDING`, `ACCEPTED`, `DECLINED` (event campaigns only) |
| rsvpRespondedAt | DateTime? | When the recipient responded to the RSVP |
| status | String | `PENDING`, `SENT`, `FAILED` |
| failureReason | String? | Error detail on send failure |
| sentAt | DateTime? | |

Indexes: `@@index([campaignId])`, `@@index([contactId])`, `@@index([campaignId, status])`, `@@index([rsvpToken])`
Constraint: `@@unique([campaignId, contactId])` (when `contactId` is non-null — prevents same contact twice in one campaign)
Table: `@@map("campaign_recipients")`

When a campaign includes an event content item, each recipient gets a unique `rsvpToken` generated at send time. The event card in the email includes a personalized RSVP link: `/api/track/rsvp/[rsvpToken]`. This gives ClientIQ native registration tracking for event invites.

### CampaignEngagement — Tracking events per recipient

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| recipientId | string | FK to CampaignRecipient |
| type | String | `OPENED`, `CLICKED`, `ARTICLE_READ`, `EVENT_REGISTERED`, `EVENT_ATTENDED` |
| contentItemId | string? | FK to ContentItem (which article/event was engaged with; null for OPENED events and plain-email clicks) |
| timestamp | DateTime | When the event occurred |
| metadata | string? | JSON — user agent, source, etc. |

Indexes: `@@index([recipientId])`, `@@index([recipientId, type])`, `@@index([contentItemId])`
Table: `@@map("campaign_engagements")`

Tracking-producible events: `OPENED` (tracking pixel), `CLICKED` (link redirect), `ARTICLE_READ` (alias for clicked article link), `EVENT_REGISTERED` (RSVP link accepted). `EVENT_ATTENDED` is import-only — attendance confirmation comes from the external event platform or manual update post-event.

### Migration: Existing CampaignOutreach

- Grouping key: `(partnerId derived from contact.partnerId, normalized outreach name)` — each unique `(partnerId, name)` pair becomes one `Campaign` with `source: IMPORTED`
- Each `CampaignOutreach` row becomes a `CampaignRecipient` + `CampaignEngagement` event based on its `status` (Sent → SENT recipient; Opened → OPENED engagement; Clicked → CLICKED engagement)
- Original `CampaignOutreach` table retained temporarily for backward compatibility, then dropped
- Update `GET /api/contacts/[id]/engagements` and `GET /api/contacts/[id]/full` to read from new tables instead of `CampaignOutreach`

## 2. API Routes

### Content Library (`/api/content-library`)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/content-library` | List content items, filterable by `type` (ARTICLE/EVENT), `practice`, search. Paginated. |

### Campaign CRUD (`/api/campaigns`)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/campaigns` | List Partner's campaigns. Filter by `status`, `source`. Includes summary stats (recipient count, open rate, click rate). |
| `POST` | `/api/campaigns` | Create a new campaign (DRAFT). Body: name, subject, bodyTemplate, content item IDs, recipient contact IDs or segment criteria. |
| `GET` | `/api/campaigns/[id]` | Campaign detail — recipients, per-recipient engagement, aggregate stats. |
| `PATCH` | `/api/campaigns/[id]` | Update draft campaign. Only while status is DRAFT. |
| `DELETE` | `/api/campaigns/[id]` | Delete a draft campaign. Cannot delete sent campaigns. |

### Campaign Actions (`/api/campaigns/[id]/...`)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/campaigns/[id]/preview` | Generate AI-personalized emails for all recipients. Returns preview data without sending. |
| `POST` | `/api/campaigns/[id]/send` | Send the campaign via Resend with tracking pixel + wrapped links. Updates status SENDING → SENT. |

### Tracking (`/api/track`)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/track/open/[recipientId]` | Tracking pixel endpoint. Returns 1x1 transparent GIF. Records OPENED event. |
| `GET` | `/api/track/click/[recipientId]` | Link redirect for plain email links (no content item). Records CLICKED event, 302-redirects to target URL (passed as `?url=` query param). |
| `GET` | `/api/track/click/[recipientId]/[contentItemId]` | Link redirect for content-item links. Records CLICKED/ARTICLE_READ event, 302-redirects to content URL. |
| `GET` | `/api/track/rsvp/[rsvpToken]` | Personalized RSVP endpoint. Looks up recipient by `rsvpToken`, records EVENT_REGISTERED engagement, sets `rsvpStatus: ACCEPTED`, renders a confirmation page (or redirects to event landing page). Supports `?response=decline` to decline. |

### Import (`/api/campaigns/import`)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/campaigns/import` | API ingestion from external marketing platform. Creates Campaign with `source: IMPORTED`, hydrates recipients and engagement. Matches contacts by email. |

### Campaign Follow-Up (`/api/campaigns/[id]/follow-up`)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/campaigns/[id]/follow-up` | Generate AI follow-up email drafts for selected recipients. Body: `{ recipientIds: string[] }`. Returns draft emails per recipient based on their engagement data. Drafts are reviewed in the campaign detail UI and sent as new interactions via the existing email send flow. |

### Content Library Stats (`/api/content-library/[id]/stats`)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/content-library/[id]/stats` | Aggregate engagement stats for a content item across all campaigns: times shared, total unique opens, total clicks. Used by Articles/Events sub-tab cards. |

### Design Notes

- `/preview` is separate from `/send` — Partners review personalized emails before committing
- Tracking endpoints are unauthenticated (embedded in external-facing emails) but use opaque UUIDs. Return 204 (no content) for invalid/unknown recipient IDs. Rate-limited to 10 requests/second per recipient ID to mitigate bot noise.
- Import endpoint is authenticated and validates against Partner's contact list
- Smart segments resolved server-side at creation time, producing concrete recipient rows. Segment criteria stored as JSON on `Campaign.segmentCriteria` for reference.
- Retry: `POST /api/campaigns/[id]/send` is idempotent — if campaign is in `FAILED` or `SENDING` (stuck), re-invoking retries only `PENDING` or `FAILED` recipients. Already-`SENT` recipients are skipped.

## 3. UI Design

### Tab Structure

The Campaigns page has three sub-tabs:

- **My Campaigns** — Campaign list and management (default)
- **Articles** — Browse and share articles
- **Events** — Browse and share events

### 3a. My Campaigns (`/campaigns`)

- **Header:** "Your Campaigns" title + "New Campaign" primary button
- **Filter bar:** `All` | `Sent` | `Draft` tabs, plus search
- **Campaign table:** Name (linked to detail), content type indicator (article/event/email icon), date sent (or "Draft" badge), recipient count, open rate, click rate
- **Empty state:** Illustration, "Share content with your contacts" headline, CTA to create first campaign or browse content

### 3b. Articles (`/campaigns/articles`)

- **Grid/list of articles:** Title, practice area, description preview, date added
- **Filters:** Practice, search
- **Per-article "Share" button:** Opens campaign builder pre-populated with that article
- **Per-article stats:** Aggregate engagement across all campaigns sharing this article (times shared, total opens, total clicks) — subtle stat line on card

### 3c. Events (`/campaigns/events`)

- **Grid/list of events:** Title, practice, date, location, type (In-person/Virtual/Hybrid)
- **Filters:** Practice, date range, event type, search
- **Per-event "Invite" button:** Opens campaign builder pre-populated with that event. Sharing an event sends an invite email with a personalized RSVP link per recipient.
- **Per-event stats:** Aggregate engagement across all campaigns sharing this event (invites sent, opens, RSVPs accepted/declined)

### 3d. Campaign Builder (`/campaigns/new`)

Single scrollable page with progressive sections. Two entry points:
1. "New Campaign" button from My Campaigns → starts empty
2. "Share" button from article/event card → starts with content pre-selected

**Step 1 — Content:** Browse content library in a modal/drawer. Filter by type, practice, search. Select zero or more items (removable chips/cards). "Skip — send a plain email" option.

**Step 2 — Recipients:** Two modes via toggle:
- *Manual pick:* Searchable contact list with checkboxes. Filter by company, importance.
- *Smart segment:* Rules builder ("Company is X" AND "Importance is HIGH" AND "Last contacted > 30 days ago"). Preview resolves to concrete list. Partner can add/remove individuals.

**Step 3 — Compose:** Subject field, rich text body template. "AI Draft" button generates base template from selected content + Partner context. Content items auto-inserted as styled cards.

**Step 4 — Preview & Send:** Scrollable list of personalized emails per recipient. Click into any to view/edit. "Send Campaign" button with confirmation dialog.

### 3e. Campaign Detail (`/campaigns/[id]`)

**Overview tab:**
- Summary cards: Total recipients, Open rate, Click rate, Article reads, RSVPs (accepted/declined/pending)
- Per-content engagement stats
- Engagement timeline (bar chart or sparkline)

**Recipients tab:**
- Table: Contact name, Company, Status (Sent/Opened/Clicked), Last engagement
- **"Draft Follow-Up" action per recipient** — AI-generated follow-up based on engagement:
  - Opened but didn't click → highlight the content again with different angle
  - Clicked/read article → reference it as conversation starter
  - Didn't open → suggest new subject line, shorter message
  - Event registered → acknowledge, offer to connect at the event
- **Bulk "Draft Follow-Ups"** — select multiple recipients, generate follow-ups for all
- Follow-up drafts generated via `POST /api/campaigns/[id]/follow-up`. Drafts are returned to the UI for review and sent through the existing `sendOutreachEmail` flow (creating an `Interaction` record on the contact).

### Integration Points

- **Contact detail page** (`/contacts/[id]`): Replace existing "Campaign Outreach" table in Engagement tab with richer view from new `CampaignRecipient` + `CampaignEngagement` data
- **Sidebar navigation:** Existing "Campaigns" link works as-is
- **Middleware:** Add `/campaigns` and `/api/campaigns` to `protectedPaths` and `config.matcher`

## 4. LLM Integration

### New service: `llm-campaign.ts`

**`generateCampaignTemplate(campaign)`**
Generates a base email template from the campaign's content items and Partner name. Includes placeholder for personalized opening. For plain email campaigns (no content), generates a generic outreach template.

**`personalizeCampaignEmail(template, contact, campaign)`**
Generates a personalized opening paragraph per contact using:
- Contact name, title, company
- Recent interaction history (last 3 interactions)
- Relationship context (time since last contact, open nudges)
- Content relevance (e.g., AI article → CTO's tech focus)

Falls back to "Hi [name]" greeting if LLM unavailable (existing template fallback pattern).

**`generateCampaignFollowUp(recipient, engagementData)`**
Generates engagement-aware follow-up draft:
- Opened but didn't click → highlight content with different angle
- Clicked/read article → reference as conversation hook
- Didn't open → new subject line, shorter message
- Event registered → acknowledge, offer to connect

### Email Construction (via `email-service.ts`)

New exports added to the existing email service (not a separate file):

- **`buildCampaignEmailHtml(recipient, campaign, contentItems)`** — Constructs the full HTML email: personalized opening, content item cards (article: title + description + "Read Article" CTA; event: name + date + location + personalized "RSVP" button pointing to `/api/track/rsvp/[rsvpToken]`), tracking pixel `<img>`, article URLs wrapped through `/api/track/click/` redirect.
- **`sendCampaignEmail(recipient, html)`** — Sends via Resend. Uses `llm-core.ts` `callLLM` for personalization (consistent with other LLM service modules). `from` address is the Partner's configured email or the default ClientIQ sender. `reply-to` is always the Partner's email.

## 5. Error Handling & Edge Cases

### Sending failures
- Partial failure: failed recipients marked `FAILED` with `failureReason`, campaign status `SENT` if any succeeded. Campaign detail shows failed recipients with "Retry" action. `Campaign.lastError` summarizes the failure count.
- Total failure: campaign status `FAILED`, `Campaign.lastError` contains the error message. Partner can retry via `POST /send` (idempotent — retries only failed/pending recipients).
- Stuck sends: if `sendStartedAt` is set but status remains `SENDING` for >10 minutes, the send is considered stuck. The `/send` endpoint can be re-invoked to resume.

### LLM failures
- Personalization failure → fall back to base template with "Hi [name]" greeting. Email still sends.
- Template generation failure → error toast, Partner writes template manually.

### Tracking edge cases
- Image-blocking email clients → open tracking is approximate. UI shows "at least X opens."
- Redirect endpoint down → email links include original URL as fallback.
- Duplicate events → record all, deduplicate for rate calculations. Open rate = unique openers / total recipients.

### Import edge cases
- Unmatched contacts → recipient row created with `contactId: null`, flagged as "unmatched." Partner can manually match or dismiss.
- Duplicate imports → match on campaign name + date to prevent doubles. Existing match → update engagement data.

### Smart segments
- Resolved at campaign creation time → concrete recipient rows. Segment criteria stored for reference but not live-updating.

### Permissions
- All campaign endpoints enforce `partnerId` scoping via existing `requirePartnerId` middleware pattern.
- Tracking endpoints are unauthenticated but use opaque UUIDs. No PII in tracking URLs.

## 6. File Structure

```
src/app/campaigns/
├── page.tsx                    # Campaigns tab with sub-tabs
├── new/page.tsx                # Campaign builder
├── [id]/page.tsx               # Campaign detail (overview + recipients)
├── articles/page.tsx           # Articles sub-tab (may be in-page)
└── events/page.tsx             # Events sub-tab (may be in-page)

src/app/api/
├── campaigns/
│   ├── route.ts                # GET (list), POST (create)
│   ├── [id]/
│   │   ├── route.ts            # GET (detail), PATCH (update), DELETE
│   │   ├── preview/route.ts    # POST (generate previews)
│   │   └── send/route.ts       # POST (send campaign)
│   └── import/route.ts         # POST (API ingestion)
├── content-library/
│   └── route.ts                # GET (list content items)
└── track/
    ├── open/[recipientId]/route.ts    # GET (tracking pixel)
    ├── click/[recipientId]/route.ts   # GET (plain link redirect)
    ├── click/[recipientId]/[contentItemId]/route.ts  # GET (content click redirect)
    └── rsvp/[rsvpToken]/route.ts      # GET (RSVP accept/decline + confirmation page)

src/lib/
├── repositories/
│   ├── interfaces/campaign-repository.ts
│   └── prisma/campaign-repository.ts
├── services/
│   ├── llm-campaign.ts                # Campaign email generation + personalization
│   └── content-ingestion-service.ts   # Tavily-based article fetching from mckinsey.com

prisma/
├── schema.prisma               # New models added
└── seed-data/
    └── content-library.ts      # Seed ContentItem for events from existing seed data
```

# Central Campaign Approval Flow — Implementation Plan

> **Status:** IMPLEMENTED
> **Date:** 2026-04-02
> **Spec:** `docs/designs/2026-04-01-campaigns-feature-design.md` (extends)
> **Depends on:** `docs/plans/2026-04-01-campaigns-feature.md`

**Goal:** Allow McKinsey partners to review and approve contacts for central campaigns where the partner is the sender but the campaign is organized by a central team. Partners see pending campaigns in "My Campaigns," review recipient lists, approve/reject individual contacts, and track engagement post-send.

**Architecture:** Extends the existing `Campaign` / `CampaignRecipient` models with approval fields. New `PENDING_APPROVAL` campaign status. Per-recipient approval tracking with `assignedPartnerId`, `approvalStatus`, and `approvalDeadline`. Nudge engine generates one `CAMPAIGN_APPROVAL` nudge per campaign per partner.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7 (SQLite), Tailwind CSS, shadcn/ui, Lucide icons

---

## File Structure

```
prisma/
├── schema.prisma                                    # Add approval fields to CampaignRecipient, pointOfContact to Campaign
├── seed.ts                                          # Add campaign approval nudge generation
└── seed-data/
    └── campaigns.ts                                 # Add central campaigns with approval data + personalizedBody

src/lib/
├── services/
│   ├── nudge-engine.ts                              # Add CAMPAIGN_APPROVAL rule
│   ├── campaign-approval.ts                         # NEW — Approval status transition logic
│   └── sms-service.ts                               # Add CAMPAIGN_APPROVAL to RULE_TYPE_LABEL
├── utils/
│   └── nudge-summary.ts                             # Add CAMPAIGN_APPROVAL summary fragments + parseCampaignApprovalNudgeDisplay
└── repositories/
    └── prisma/campaign-repository.ts                # Extend findByPartnerId with partner-scoped counts

src/app/
├── campaigns/
│   ├── page.tsx                                     # Update card to show partner-scoped recipient counts + deadline
│   └── [id]/page.tsx                                # Add ApprovalReviewSection, pointOfContact, displayRecipients
├── dashboard/page.tsx                               # Add campaign-centric nudge card for CAMPAIGN_APPROVAL
├── nudges/page.tsx                                  # Add campaign-centric NudgeCard branch
└── api/
    └── campaigns/
        ├── route.ts                                 # Enrich list with partner-scoped counts + deadlines
        ├── [id]/
        │   ├── route.ts                             # Return currentPartnerId + pointOfContact
        │   ├── send/route.ts                        # Auto-send on full approval
        │   └── bulk-approve/route.ts                # NEW — POST (bulk approve/reject)
        ├── recipients/[recipientId]/route.ts        # NEW — PATCH (individual approve/reject)
        └── import/route.ts                          # Extend to support CENTRAL source + approval fields
```

---

## 1. Schema Changes

### Campaign model additions

| Field | Type | Notes |
|-------|------|-------|
| pointOfContact | String? | Central team coordinator name/role, displayed on detail page |

### CampaignRecipient model additions

| Field | Type | Notes |
|-------|------|-------|
| assignedPartnerId | String? | FK to Partner — which partner "owns" this recipient for approval |
| approvalStatus | String? | `PENDING`, `APPROVED`, `REJECTED` — null for non-central campaigns |
| approvalDeadline | DateTime? | When the partner needs to approve by |

### Campaign status additions

| Status | Meaning |
|--------|---------|
| `PENDING_APPROVAL` | Central campaign awaiting partner review — not yet sendable |
| `DRAFT` | Partner-created campaign in progress |
| `IN_PROGRESS` | Approved and sending / sent for approved recipients |
| `SENT` | Fully sent |

**Status flow for central campaigns:** `PENDING_APPROVAL` → (all recipients resolved) → `IN_PROGRESS` → `SENT`

---

## 2. Campaign List API — Partner-Scoped Counts

The `GET /api/campaigns` endpoint enriches central campaigns with partner-specific data:

- **Recipient count** — `_count.recipients` overridden with count of recipients where `assignedPartnerId === currentPartner` (not the global total)
- **Pending approval count** — recipients with `approvalStatus === "PENDING"` for the current partner
- **Approval deadline** — earliest `approvalDeadline` for the current partner's pending recipients

This ensures the campaign card shows numbers consistent with what the partner sees on the detail page.

---

## 3. Campaign Detail Page

### Header
- Campaign name + status badge
- **Point of contact** (central campaigns only): displayed with User icon below the date line
- Deadline display for pending approval campaigns

### ApprovalReviewSection (central pending approval only)
- Summary bar: `X pending · Y approved · Z rejected · Due {date}`
- Bulk action buttons: "Approve All (N)" / "Reject All (N)" with confirmation dialog for reject
- Review table with columns: Contact, Company, Title, Status, Actions
- Expandable email preview per contact (click chevron to reveal `personalizedBody`)
- Sorted: PENDING first, then APPROVED, then REJECTED
- Filtered to `assignedPartnerId === currentPartnerId` only
- Success toast on action completion

### Engagement metrics
- Hidden for `PENDING_APPROVAL` status (no data yet)
- For `IN_PROGRESS` / `SENT`: scoped to current partner's recipients via `displayRecipients` memo

### Recipients table
- Hidden for `PENDING_APPROVAL` (replaced by ApprovalReviewSection)
- For other statuses: uses `displayRecipients` (filtered to current partner for central campaigns)

---

## 4. Approval API Endpoints

### `PATCH /api/campaigns/recipients/[recipientId]`
- Body: `{ approvalStatus: "APPROVED" | "REJECTED" }`
- Authorization: `recipient.assignedPartnerId === currentPartnerId`
- After update: check if all recipients for the campaign are resolved → auto-transition campaign to `IN_PROGRESS`

### `POST /api/campaigns/[id]/bulk-approve`
- Body: `{ recipientIds: string[], action: "APPROVED" | "REJECTED" }`
- Authorization: each recipient must have `assignedPartnerId === currentPartnerId`
- After update: same auto-transition check

---

## 5. Import API Extension

`POST /api/campaigns/import` extended to support:
- `source: "CENTRAL"` for central campaigns
- `pointOfContact` field
- Per-recipient `assignedPartnerId`, `approvalStatus`, `approvalDeadline`
- Campaign created with status `PENDING_APPROVAL` when source is `CENTRAL`

---

## 6. Nudge Engine Integration — `src/lib/services/nudge-engine.ts`

### CAMPAIGN_APPROVAL rule
- **Query:** `CampaignRecipient` where `assignedPartnerId === partnerId AND approvalStatus === "PENDING"`, joined with Campaign where `status === "PENDING_APPROVAL"`
- **Grouping:** One nudge per campaign (not per contact). Uses first contact with an ID as the nudge anchor.
- **Priority tiers:**
  - `URGENT` — deadline < 2 days away
  - `HIGH` — deadline < 7 days away
  - `MEDIUM` — deadline ≥ 7 days away
  - `LOW` — no deadline set
- **Reason format:** `Campaign "{name}" has {N} contacts pending your review (due {date}).`
- **Metadata JSON:** `{ insights: [...], campaignId, pendingCount, deadline }`
- **TYPE_RANK:** Position 2 (between `REPLY_NEEDED` at 1 and `FOLLOW_UP` at 3)

### SMS service
- Added `CAMPAIGN_APPROVAL: "Campaign Approval"` to `RULE_TYPE_LABEL` in `sms-service.ts`

---

## 7. Morning Brief + Dashboard — `src/app/dashboard/page.tsx`

### Campaign-centric nudge card
CAMPAIGN_APPROVAL nudges render a distinct card layout (not the default contact-centric card):

- **Icon:** Amber-ringed ShieldCheck circle (replaces contact avatar)
- **Title:** Campaign name (linked to `/campaigns/{campaignId}`)
- **Badges:** Priority + "Campaign Approval" (amber)
- **Metrics:** `{N} pending` + deadline inline
- **AI Summary:** Amber-tinted Sparkles header with campaign-specific text
- **CTA:** "Review campaign" link to campaign detail page
- **Visual accent:** `border-l-4 border-l-amber-400` (amber left border)

### Briefing service
CAMPAIGN_APPROVAL nudges flow into the morning brief via existing `openNudges` loading. The LLM narrative picks them up naturally.

---

## 8. Nudges Page — `src/app/nudges/page.tsx`

### NudgeCard campaign approval branch
Early return in `NudgeCard` when `ruleType === "CAMPAIGN_APPROVAL"`:

- Same campaign-centric layout as dashboard card (full version)
- Amber metrics panel with pending count + deadline (with icons)
- AI Summary with `NudgeSummary` component
- "Review Campaign" primary button
- Snooze / Done action buttons preserved

### Type config
```
CAMPAIGN_APPROVAL: { icon: ShieldCheck, label: "Campaign Approval", ctaLabel: "Review Campaign", ctaIcon: ShieldCheck, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/30" }
```

---

## 9. Nudge Summary — `src/lib/utils/nudge-summary.ts`

### TYPE_LABELS
```
CAMPAIGN_APPROVAL: "campaign approval"
```

### extractInsightSnippet
Extracts campaign name from `reason` via `/"([^"]+)"/` regex.

### buildSummaryFragments
Dedicated branch for `CAMPAIGN_APPROVAL` type:
> Campaign **{name}** has {N} contacts pending your approval by {date}. Review and approve so the campaign can go out on your behalf.

### parseCampaignApprovalNudgeDisplay
Shared helper exported for both dashboard and nudges page:
- Parses `campaignId`, `pendingCount`, `deadline` from metadata JSON
- Falls back to regex extraction from `reason` string
- Returns `{ campaignName, campaignHref, pendingCount, deadlineLabel }`

---

## 10. Seed Data

### Central campaigns (6 total)
| # | Campaign | Status | Point of Contact | Partners |
|---|----------|--------|-------------------|----------|
| 1 | McKinsey Global Energy Forum — Invite | PENDING_APPROVAL | Sarah Mitchell, Global Events Lead | Ava (5), Jordan (4), Morgan (3) |
| 2 | Q2 Thought Leadership: Digital Transformation | PENDING_APPROVAL | David Park, Content Marketing | Sam (5), Taylor (4) |
| 3 | AI Leaders Summit — Exclusive Invite | PENDING_APPROVAL | Sarah Mitchell, Global Events Lead | Ava (4), Sam (3), Jordan (2) |
| 4 | CFO Outlook Series — Personalized Invite | PENDING_APPROVAL | Rachel Foster, CFO Practice Marketing | Morgan (4), Taylor (4) |
| 5 | Cybersecurity Executive Roundtable — Invite | PENDING_APPROVAL | James Wu, Cybersecurity Practice Marketing | Jordan (4), Taylor (4) |
| 6 | Sustainability & ESG Insights — Personalized Share | IN_PROGRESS | Lisa Novak, Sustainability Practice Marketing | Morgan (3), Sam (3) |

Each recipient has:
- `assignedPartnerId` — which partner approves
- `approvalStatus` — mix of PENDING, APPROVED, REJECTED
- `approvalDeadline` — 3, 7, or 14 days from seed date
- `personalizedBody` — personalized email body using contact's first name and title

### Campaign approval nudges (12 total)
Generated dynamically during seed by querying `CampaignRecipient` for pending approvals and grouping by `assignedPartnerId + campaignId`. All 5 partners receive 2-3 nudges each.

---

## Design Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Approval granularity | Per-recipient (not per-campaign) | Partners may approve some contacts but reject others |
| Campaign status transition | Auto on full resolution | When all recipients are APPROVED or REJECTED, campaign moves to IN_PROGRESS and triggers send for approved recipients |
| Recipient count on cards | Partner-scoped for central campaigns | Partners should only see "their" contacts, not the global campaign size |
| Nudge grouping | One per campaign per partner | Avoids nudge spam — a campaign with 5 pending contacts produces 1 nudge, not 5 |
| Card layout | Campaign-centric for approval nudges | Contact avatar + name is misleading when the action is campaign-level |
| Email preview | Expandable in review table | Partners need to see what will be sent before approving, but shouldn't clutter the table |
| Point of contact | Campaign-level field | Partners need to know who to contact about the campaign |
| Reject confirmation | Window.confirm dialog | Destructive action (contacts won't receive campaign) needs explicit confirmation |

# Article Campaign Nudge — Design Spec

**Date:** 2026-04-06
**Status:** Approved

## Overview

A new nudge type (`ARTICLE_CAMPAIGN`) that detects newly published McKinsey articles in the `ContentItem` library, matches them to relevant contacts using a multi-signal relevance scorer, and nudges partners to review and send a pre-drafted campaign. The campaign (with per-contact personalized emails) is created lazily on first click, leveraging the existing campaign infrastructure.

## Architecture

```
ContentItem (new article)
        │
        ▼
Nudge Engine (refresh)
  ├─ Detect new articles (publishedAt < 14d, no existing campaign)
  ├─ Score contacts (industry + engagement + importance + recency)
  ├─ Create ARTICLE_CAMPAIGN nudge with metadata
  │     { contentItemId, matchedContactIds, matchCount }
  │
  ▼
Dashboard / Morning Brief
  ├─ Nudge card: "New article — 8 contacts matched"
  ├─ CTA: "View campaign" → /campaigns/draft?contentItemId=<id>
  │
  ▼
Draft Campaign Page (lazy creation)
  ├─ Check: campaign exists for this partner + contentItem?
  ├─ If no → POST /api/campaigns/from-article
  │     ├─ Create Campaign (DRAFT)
  │     ├─ Link ContentItem via CampaignContent
  │     ├─ Add matched contacts as CampaignRecipient
  │     ├─ Generate email template (LLM)
  │     └─ Personalize per recipient (existing flow)
  ├─ Redirect to /campaigns/[id]
  │
  ▼
Existing Campaign Detail Page
  ├─ Review matched contacts (add/remove)
  ├─ Edit email template
  ├─ Preview per-contact personalized drafts
  └─ Send
```

## Section 1: New Nudge Type — `ARTICLE_CAMPAIGN`

### Rule type

`ruleType: "ARTICLE_CAMPAIGN"`

### Nudge fields

| Field | Value |
|-------|-------|
| `ruleType` | `"ARTICLE_CAMPAIGN"` |
| `reason` | `New article "{title}" published — {N} contacts matched based on industry and engagement` |
| `contactId` | First matched contact (required by schema, used as anchor) |
| `priority` | `HIGH` if any matched contact is CRITICAL; otherwise `MEDIUM` |
| `metadata` | JSON: `{ insights: [...], contentItemId, matchedContactIds, matchCount }` |

### NudgeRuleConfig

Add `articleCampaignEnabled` (default `true`) to the `NudgeRuleConfig` model and the upsert defaults.

### Engine detection logic

During `refreshNudgesForPartner()`:

1. Query `ContentItem` rows where `type = "ARTICLE"` and `publishedAt` is within the last 14 days.
2. For each article, check if a `Campaign` already exists for this partner that links to the `ContentItem` via `CampaignContent`. If yes, skip.
3. Run the contact relevance scorer (Section 2) against the partner's contacts.
4. If matched contacts >= 1, create an `ARTICLE_CAMPAIGN` nudge with metadata.

### TYPE_RANK

Slot at rank 3 — after `CAMPAIGN_APPROVAL` (2), before `FOLLOW_UP` (3 → 4). Shift all subsequent ranks up by 1.

```
MEETING_PREP: 0
REPLY_NEEDED: 1
CAMPAIGN_APPROVAL: 2
ARTICLE_CAMPAIGN: 3    ← new
FOLLOW_UP: 4           ← was 3
STALE_CONTACT: 5       ← was 4
...
```

## Section 2: Contact Relevance Scoring

A deterministic, rule-based scorer — no LLM calls. Fast enough to run inline during nudge refresh.

### Scoring signals

| Signal | Max points | Logic |
|--------|-----------|-------|
| Industry match | 40 | Compare `ContentItem.practice` to `Company.industry` via `PRACTICE_INDUSTRY_MAP` |
| Past article engagement | 30 | Check `ArticleEngagement` rows for this contact; award points for views in same practice area |
| Contact importance | 20 | CRITICAL=20, HIGH=15, MEDIUM=10, LOW=5 |
| Interaction recency | 10 | Last interaction within 30 days = 10, within 60 = 5, else 0 |

### PRACTICE_INDUSTRY_MAP

A static dictionary mapping `ContentItem.practice` values to arrays of related `Company.industry` keyword patterns. Example:

```typescript
const PRACTICE_INDUSTRY_MAP: Record<string, string[]> = {
  "Technology": ["software", "information technology", "saas", "cloud", "data"],
  "Healthcare": ["healthcare", "pharmaceutical", "biotech", "medical", "health"],
  "Financial Services": ["banking", "finance", "insurance", "investment", "fintech"],
  "Strategy": [],  // universal — matches all industries (award 20 instead of 40)
  // ... extend as needed
};
```

When practice is "Strategy" or other universal topics, award half points (20) to all contacts.

### Thresholds

- **Minimum score:** 30 (ensures at least industry match OR strong engagement + importance)
- **Maximum contacts:** 15 per article campaign

### Sorting

Matched contacts sorted by score descending, then by importance rank, then by name.

## Section 3: Lazy Campaign Creation

### New API endpoint: `POST /api/campaigns/from-article`

**Request body:**

```json
{
  "contentItemId": "uuid"
}
```

`contactIds` are **not** passed by the client. The server re-runs the relevance scorer to determine recipients. This avoids stale metadata and keeps the client simple.

**Behavior:**

1. Validate `contentItemId` exists and is type `ARTICLE`.
2. Check if a campaign already exists for this partner + contentItem (via `CampaignContent` join). If yes, return `{ campaignId: "<existing>" }`.
3. Fetch the `ContentItem` (title, description, url, practice).
4. Run the contact relevance scorer (same logic as the nudge engine) to determine matched contacts.
5. Call `generateArticleCampaignEmail()` (new LLM function) to produce `subject` and `bodyTemplate`.
6. Create `Campaign` with `status: "DRAFT"`, `source: "ACTIVATE"`, `name: "Share: {title}"`.
7. Link `ContentItem` via `CampaignContent`.
8. Add matched contacts as `CampaignRecipient` rows.
9. Trigger per-contact personalization using existing `personalizeCampaignEmail` for each recipient.
10. Return `{ campaignId: "..." }`.

**Note:** The scoring logic is extracted into a shared utility (`scoreContactsForArticle`) used by both the nudge engine and this endpoint.

### New page: `/campaigns/draft`

A thin loader page:

1. Read `contentItemId` from URL search params.
2. Check if a campaign exists for this partner + `contentItemId` (GET request or inline query).
3. If not, call `POST /api/campaigns/from-article` with a loading UI ("Preparing your article campaign...").
4. Redirect to `/campaigns/[campaignId]` once ready.

If the partner navigates here a second time, step 2 finds the existing campaign and redirects immediately.

## Section 4: Dashboard & Morning Brief Integration

### Nudge card rendering

In `dashboard/page.tsx`, add an `ARTICLE_CAMPAIGN` branch alongside the existing `CAMPAIGN_APPROVAL` branch:

- **Icon:** `BookOpen` with blue accent border (`border-l-blue-400`)
- **Title:** Article name (from metadata or parsed from reason)
- **Badge:** "Article Campaign" (blue themed)
- **Summary:** The `reason` text
- **CTA:** "View campaign" → `/campaigns/draft?contentItemId=<id>`

### Morning brief

**`llm-briefing.ts` changes:**

- `NARRATIVE_SYSTEM_PROMPT`: Add "Article campaigns" as a section category — "New article published, X contacts matched — review and send."
- `generateNarrativeTemplate` fallback: Add article campaign section after campaign approvals.
- `resolveDeeplink`: For `ARTICLE_CAMPAIGN`, extract `contentItemId` from metadata and return `/campaigns/draft?contentItemId=<id>`.
- `buildFallbackActions`: Include article campaign nudges with actionLabel "Review article campaign".

**`dashboard/page.tsx` changes:**

- `RULE_TYPE_LABELS`: `ARTICLE_CAMPAIGN: "new article campaign"`
- `RULE_TYPE_CHAT_ACTION`: Not used — article campaign CTAs route directly to the draft page (like `CAMPAIGN_APPROVAL`), not to chat.
- `buildBriefingActionHref`: `ARTICLE_CAMPAIGN` deeplinks (starting with `/campaigns/draft`) pass through unchanged, same as `/campaigns/:id`.

### Email briefing

In `email-service.ts`, add `ARTICLE_CAMPAIGN` to the nudge-type label map so email briefings render the new nudge type correctly.

## Section 5: Email Generation

### New LLM function: `generateArticleCampaignEmail`

Located in `src/lib/services/llm-campaign.ts` alongside existing campaign LLM functions.

**Input:**

```typescript
{
  articleTitle: string;
  articleDescription: string;
  articleUrl: string;
  articlePractice: string;
  partnerName: string;
}
```

**Output:**

```typescript
{
  subject: string;  // e.g. "Thought you'd find this relevant: AI in Healthcare"
  body: string;     // Professional email template with article intro + CTA link
}
```

**Prompt direction:** Generate a short, professional email that introduces the article naturally — not a newsletter blast but a personal share. Tone: "I came across this piece from our team and thought of you given your work in [area]..." with a CTA link to the full article.

### Per-contact personalization

Uses the existing `personalizeCampaignEmail` flow. After the campaign is created with the template `bodyTemplate`, the API triggers personalization for each `CampaignRecipient`. The existing function takes the template + contact context (name, title, company, recent interactions) and tailors the email.

The partner sees ready-to-review personalized drafts when they land on the campaign detail page.

## Section 6: Seed Data & Edge Cases

### Seed data

Add 2-3 `ContentItem` rows to seed data:

- Type: `ARTICLE`, practice areas matching existing company industries
- `publishedAt`: within the last 7 days
- Realistic titles and descriptions (McKinsey-style articles)

### Edge cases

| Case | Handling |
|------|----------|
| Article already has a campaign for this partner | Engine skips — no nudge created |
| No contacts score above threshold | No nudge created for this article |
| Partner clicks nudge twice | Draft page finds existing campaign, redirects immediately |
| Nudge dismissed but CTA clicked later | Metadata still contains `contentItemId`, flow works |
| Article has no `practice` field | Industry-match signal scores 0; engagement + importance can still produce matches |
| Personalization LLM fails for a recipient | Recipient keeps `personalizedBody: null`; partner sees template version and can edit manually |
| `ContentItem` deleted after nudge created | Draft page shows error: "This article is no longer available" |

## Files to Change (Summary)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `articleCampaignEnabled` to `NudgeRuleConfig` |
| `src/lib/repositories/prisma/nudge-rule-config-repository.ts` | Add default for new field |
| `src/lib/services/nudge-engine.ts` | Add `ARTICLE_CAMPAIGN` detection, call shared scorer, nudge creation |
| `src/lib/services/article-relevance.ts` | New: shared contact relevance scorer (`scoreContactsForArticle`) |
| `src/lib/services/llm-campaign.ts` | Add `generateArticleCampaignEmail` |
| `src/app/api/campaigns/from-article/route.ts` | New endpoint for lazy campaign creation |
| `src/app/campaigns/draft/page.tsx` | New draft loader page |
| `src/app/dashboard/page.tsx` | Add nudge card rendering, briefing integration |
| `src/lib/services/llm-briefing.ts` | Add to prompt, template, deeplink resolution |
| `src/lib/services/email-service.ts` | Add nudge-type label |
| `src/lib/services/briefing-service.ts` | Include in briefing data |
| `prisma/seed-data/` | Add sample articles |

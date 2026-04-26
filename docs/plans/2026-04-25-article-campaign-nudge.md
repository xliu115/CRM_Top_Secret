---
name: Article Campaign Nudge
overview: "Implement the ARTICLE_CAMPAIGN nudge type end-to-end: schema migration, relevance scorer, nudge engine integration, lazy campaign creation API, draft campaign page, dashboard/briefing integration, seed data with real McKinsey articles, and dev server restart."
todos:
  - id: step1-schema
    content: "Schema + NudgeRuleConfig: add articleCampaignEnabled, run db push"
    status: completed
  - id: step2-seed
    content: Seed 3 recent McKinsey articles in content-library.ts, run db seed
    status: completed
  - id: step3-scorer
    content: Create article-relevance.ts with scoreContactsForArticle
    status: completed
  - id: step4-engine
    content: Add ARTICLE_CAMPAIGN to nudge engine (TYPE_RANK, detection, nudge creation)
    status: completed
  - id: step5-llm
    content: Add generateArticleCampaignEmail in llm-campaign.ts
    status: completed
  - id: step6-api
    content: Create POST /api/campaigns/from-article endpoint
    status: completed
  - id: step7-page
    content: Create /campaigns/draft page (loader + redirect)
    status: completed
  - id: step8-dashboard
    content: "Dashboard: nudge card, labels, deeplinks, structured view"
    status: completed
  - id: step9-brief
    content: "Morning brief: prompt, template, resolveDeeplink, fallback actions, briefing route"
    status: completed
  - id: step10-ship
    content: Commit, push, seed DB, restart dev server
    status: completed
isProject: false
---

# Article Campaign Nudge — Implementation Plan

Spec: [docs/specs/2026-04-06-article-campaign-nudge-design.md](docs/specs/2026-04-06-article-campaign-nudge-design.md)

## Files to Change

- [prisma/schema.prisma](prisma/schema.prisma) — add `articleCampaignEnabled` to `NudgeRuleConfig`
- [src/lib/repositories/prisma/nudge-rule-config-repository.ts](src/lib/repositories/prisma/nudge-rule-config-repository.ts) — add default
- [src/lib/services/article-relevance.ts](src/lib/services/article-relevance.ts) — **new**: shared contact relevance scorer
- [src/lib/services/nudge-engine.ts](src/lib/services/nudge-engine.ts) — add ARTICLE_CAMPAIGN detection + nudge creation
- [src/lib/services/llm-campaign.ts](src/lib/services/llm-campaign.ts) — add `generateArticleCampaignEmail`
- [src/app/api/campaigns/from-article/route.ts](src/app/api/campaigns/from-article/route.ts) — **new**: lazy campaign creation endpoint
- [src/app/campaigns/draft/page.tsx](src/app/campaigns/draft/page.tsx) — **new**: draft loader page
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) — nudge card, briefing labels, deeplink routing
- [src/lib/services/llm-briefing.ts](src/lib/services/llm-briefing.ts) — prompt, template, deeplink, fallback actions
- [src/lib/services/email-service.ts](src/lib/services/email-service.ts) — nudge-type label
- [src/lib/utils/nudge-summary.ts](src/lib/utils/nudge-summary.ts) — add parser for article campaign nudge display
- [prisma/seed-data/content-library.ts](prisma/seed-data/content-library.ts) — add 3 recent McKinsey articles
- [prisma/seed.ts](prisma/seed.ts) — no changes needed (already seeds all ContentItems)

## Step 1: Schema + Config

In [prisma/schema.prisma](prisma/schema.prisma), add to `NudgeRuleConfig` (after `linkedinActivityEnabled`):

```prisma
articleCampaignEnabled Boolean @default(true) @map("article_campaign_enabled")
```

In [src/lib/repositories/prisma/nudge-rule-config-repository.ts](src/lib/repositories/prisma/nudge-rule-config-repository.ts), add to `DEFAULTS`:

```typescript
articleCampaignEnabled: true,
```

Run `npx prisma db push` to sync the schema (SQLite, no formal migration needed).

## Step 2: Seed Recent Articles

In [prisma/seed-data/content-library.ts](prisma/seed-data/content-library.ts), add 3 new `ContentItem` articles with `publishedAt` dates within the last 7 days (relative to 2026-04-06). Use real McKinsey article topics with practices that match existing company industries:

- **Article 1:** "How AI is transforming the technology sector" — practice: `"Technology"` (matches Microsoft, Nvidia, Salesforce, etc.)
- **Article 2:** "The future of digital banking" — practice: `"Financial Services"` (matches JPMorgan Chase)
- **Article 3:** "Next-generation consumer engagement strategies" — practice: `"Consumer & Retail"` (matches Apple, Amazon, Nike, PepsiCo, Netflix)

IDs: `ci-art-013`, `ci-art-014`, `ci-art-015`. URLs: realistic mckinsey.com slugs. `publishedAt`: April 1-4, 2026.

Then run `npx prisma db seed` to populate.

## Step 3: Article Relevance Scorer

Create [src/lib/services/article-relevance.ts](src/lib/services/article-relevance.ts):

- `PRACTICE_INDUSTRY_MAP` — maps ContentItem practice strings to Company.industry keyword patterns. Cover all seed practices: `"Technology"` -> `["technology", "software", "saas", "cloud", "semiconductors", "enterprise software"]`, `"Financial Services"` -> `["financial", "banking", "fintech"]`, `"Consumer & Retail"` -> `["consumer", "e-commerce", "apparel", "food", "beverage", "streaming", "entertainment"]`, etc. Universal practices (like `"Strategy"`) match all at half points.
- `IMPORTANCE_SCORE` — `{ CRITICAL: 20, HIGH: 15, MEDIUM: 10, LOW: 5 }`
- `scoreContactsForArticle(params)` — takes article practice, partner's contacts (with company.industry, importance, lastContacted), and article engagements grouped by contact. Returns sorted array of `{ contactId, score }` above threshold (30), capped at 15.

Scoring logic (per contact):
1. **Industry match (0-40):** case-insensitive keyword match of `company.industry` against `PRACTICE_INDUSTRY_MAP[practice]`. Universal = 20.
2. **Engagement history (0-30):** contact has `ArticleEngagement` rows with `views > 0` = 15 base + min(15, views * 3).
3. **Importance (5-20):** from `IMPORTANCE_SCORE`.
4. **Recency (0-10):** `lastContacted` within 30 days = 10, within 60 = 5.

## Step 4: Nudge Engine Integration

In [src/lib/services/nudge-engine.ts](src/lib/services/nudge-engine.ts):

- Add `ARTICLE_CAMPAIGN: 3` to `TYPE_RANK`, bump `FOLLOW_UP` to 4, `STALE_CONTACT` to 5, etc.
- Add `"ARTICLE_CAMPAIGN": "new article campaign"` to `buildReason`'s `typeLabels`.
- After the per-contact loop (line ~472) and before the CAMPAIGN_APPROVAL section (line ~474), add the ARTICLE_CAMPAIGN block:

```
if (config.articleCampaignEnabled) {
  // 1. Fetch recent articles (publishedAt within 14 days)
  const recentArticles = await prisma.contentItem.findMany({
    where: { type: "ARTICLE", publishedAt: { gte: subDays(now, 14) } },
  });

  // 2. For each, check if partner already has a campaign for it
  for (const article of recentArticles) {
    const existingCampaign = await prisma.campaignContent.findFirst({
      where: { contentItemId: article.id, campaign: { partnerId } },
    });
    if (existingCampaign) continue;

    // 3. Score contacts
    const scored = scoreContactsForArticle({
      practice: article.practice,
      contacts,
      articlesByContact,
      now,
    });
    if (scored.length === 0) continue;

    // 4. Create ARTICLE_CAMPAIGN nudge
    const hasCritical = scored.some(s => contacts.find(c => c.id === s.contactId)?.importance === "CRITICAL");
    candidates.push({
      contactId: scored[0].contactId,
      ruleType: "ARTICLE_CAMPAIGN",
      reason: `New article "${article.title}" published — ${scored.length} contact${scored.length !== 1 ? "s" : ""} matched based on industry and engagement`,
      priority: hasCritical ? "HIGH" : "MEDIUM",
      metadata: JSON.stringify({
        insights: [{ type: "ARTICLE_CAMPAIGN", reason: `...`, priority: hasCritical ? "HIGH" : "MEDIUM" }],
        contentItemId: article.id,
        matchedContactIds: scored.map(s => s.contactId),
        matchCount: scored.length,
        articleTitle: article.title,
      }),
    });
  }
}
```

Import `scoreContactsForArticle` from `./article-relevance` and `subDays` from `date-fns`.

## Step 5: LLM Email Generation

In [src/lib/services/llm-campaign.ts](src/lib/services/llm-campaign.ts), add `generateArticleCampaignEmail`:

```typescript
export async function generateArticleCampaignEmail(params: {
  articleTitle: string;
  articleDescription: string;
  articleUrl: string;
  articlePractice: string;
  partnerName: string;
}): Promise<{ subject: string; body: string }> {
  // LLM call with prompt for personal-share tone
  // Fallback: template with article title + URL
}
```

Pattern follows existing `generateCampaignTemplate` — uses `callLLM` + `parseJsonSubjectBody` + fallback.

## Step 6: Lazy Campaign Creation API

Create [src/app/api/campaigns/from-article/route.ts](src/app/api/campaigns/from-article/route.ts):

- `POST`, requires `partnerId`
- Reads `contentItemId` from body
- Checks for existing campaign via `prisma.campaignContent.findFirst({ where: { contentItemId, campaign: { partnerId } }, include: { campaign: true } })`
- If exists, return `{ campaignId }`
- Otherwise: fetch ContentItem, run `scoreContactsForArticle`, call `generateArticleCampaignEmail`, create Campaign (DRAFT, ACTIVATE), link via `campaignRepo.addContent`, add recipients via `campaignRepo.addRecipients`, trigger personalization loop (same as preview route), return `{ campaignId }`

## Step 7: Draft Campaign Page

Create [src/app/campaigns/draft/page.tsx](src/app/campaigns/draft/page.tsx):

- Client component wrapped in `Suspense`
- Reads `contentItemId` from `useSearchParams()`
- On mount: `POST /api/campaigns/from-article` with the contentItemId
- Shows loading state: "Preparing your article campaign..." with spinner
- On success: `router.replace(/campaigns/${campaignId})`
- On error: show error message with link back to dashboard

## Step 8: Dashboard Integration

In [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx):

**Helper additions:**
- `RULE_TYPE_LABELS`: add `ARTICLE_CAMPAIGN: "new article campaign"`
- `buildBriefingActionHref`: article campaign deeplinks (starting with `/campaigns/draft`) pass through unchanged

**Nudge card rendering** (in the nudge list, after the `CAMPAIGN_APPROVAL` branch at line ~1265):
- Add `if (nudge.ruleType === "ARTICLE_CAMPAIGN")` branch
- Parse metadata to extract `contentItemId`, `matchCount`, `articleTitle`
- Render card with `BookOpen` icon, blue accent border (`border-l-blue-400`), article title, "Article Campaign" badge, match count, and "View campaign" CTA linking to `/campaigns/draft?contentItemId=<id>`

**StructuredBriefingView** (line ~510 area): add article campaign nudges alongside campaign approvals in the briefing sections.

In [src/lib/utils/nudge-summary.ts](src/lib/utils/nudge-summary.ts): add `parseArticleCampaignNudgeDisplay` helper (parallel to `parseCampaignApprovalNudgeDisplay`).

## Step 9: Morning Brief Integration

In [src/lib/services/llm-briefing.ts](src/lib/services/llm-briefing.ts):

- `NARRATIVE_SYSTEM_PROMPT` (line 97): Add `**Article campaigns**` as a section category after campaign approvals — "article title, matched contact count — review and send."
- `generateNarrativeTemplate` (line ~270): Add article campaign section after campaign approvals, filtering `ctx.nudges` by `ruleType === "ARTICLE_CAMPAIGN"`.
- `resolveDeeplink` (line ~183): For `ARTICLE_CAMPAIGN`, extract `contentItemId` from metadata and return `/campaigns/draft?contentItemId=<id>`.
- `buildFallbackActions` (line ~230): Add `ARTICLE_CAMPAIGN: "Review article campaign"` to `ruleLabels`.

In [src/lib/services/email-service.ts](src/lib/services/email-service.ts): add `ARTICLE_CAMPAIGN` to any nudge-type label maps.

In [src/app/api/dashboard/briefing/route.ts](src/app/api/dashboard/briefing/route.ts): update the nudge filtering at line 30-33 to also prioritize `ARTICLE_CAMPAIGN` nudges alongside `CAMPAIGN_APPROVAL`.

## Step 10: Seed, Restart, Verify

- Run `npx prisma db push` (schema sync)
- Run `npx prisma db seed` (populate new articles)
- Restart the dev server so changes are immediately visible

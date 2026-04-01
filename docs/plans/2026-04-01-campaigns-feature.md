# Your Campaigns — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full "Your Campaigns" feature under the Campaigns tab — content library, campaign builder, AI-personalized send, tracking, and analytics — with mock data showcasing the entire functionality.

**Architecture:** New first-class `Campaign` entity with related models (`ContentItem`, `CampaignContent`, `CampaignRecipient`, `CampaignEngagement`). Content library populated via Tavily article fetch from mckinsey.com and seeded events. Campaign send via Resend with tracking pixel + link wrapping + personalized RSVP links for events. Repository pattern matching existing codebase.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7 (SQLite), Radix UI Tabs, Resend, Tavily, OpenAI (via `llm-core.ts`)

**Spec:** `docs/designs/2026-04-01-campaigns-feature-design.md`

---

## File Structure

```
prisma/
├── schema.prisma                                    # Add 5 new models
├── seed.ts                                          # Add campaign seed orchestration
└── seed-data/
    ├── content-library.ts                           # NEW — ContentItem seed (articles + events)
    └── campaigns.ts                                 # NEW — Mock campaigns, recipients, engagements

src/lib/
├── repositories/
│   ├── interfaces/campaign-repository.ts            # NEW — ICampaignRepository interface
│   ├── prisma/campaign-repository.ts                # NEW — Prisma implementation
│   └── index.ts                                     # Add campaignRepo export
├── services/
│   ├── content-ingestion-service.ts                 # NEW — Tavily article fetch
│   ├── llm-campaign.ts                              # NEW — Campaign email generation
│   └── email-service.ts                             # Add buildCampaignEmailHtml, sendCampaignEmail

src/app/
├── campaigns/
│   ├── page.tsx                                     # REPLACE — Campaigns tab with sub-tabs
│   ├── new/page.tsx                                 # NEW — Campaign builder
│   └── [id]/page.tsx                                # NEW — Campaign detail
├── api/
│   ├── campaigns/
│   │   ├── route.ts                                 # NEW — GET (list), POST (create)
│   │   ├── [id]/
│   │   │   ├── route.ts                             # NEW — GET (detail), PATCH, DELETE
│   │   │   ├── preview/route.ts                     # NEW — POST (generate previews)
│   │   │   ├── send/route.ts                        # NEW — POST (send campaign)
│   │   │   └── follow-up/route.ts                   # NEW — POST (follow-up drafts)
│   │   └── import/route.ts                          # NEW — POST (API ingestion)
│   ├── content-library/
│   │   ├── route.ts                                 # NEW — GET (list)
│   │   └── [id]/
│   │       └── stats/route.ts                       # NEW — GET (content stats)
│   └── track/
│       ├── open/[recipientId]/route.ts              # NEW — GET (tracking pixel)
│       ├── click/[recipientId]/route.ts             # NEW — GET (plain link redirect)
│       ├── click/[recipientId]/[contentItemId]/route.ts  # NEW — GET (content click redirect)
│       └── rsvp/[rsvpToken]/route.ts                # NEW — GET (RSVP accept/decline)

src/middleware.ts                                     # Add /campaigns, /api/campaigns to protected paths
```

---

## Task 1: Prisma Schema — Add 5 New Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add ContentItem model to schema.prisma**

Append after the `CampaignOutreach` model:

```prisma
model ContentItem {
  id            String    @id @default(uuid())
  type          String
  title         String
  description   String?
  url           String?
  imageUrl      String?   @map("image_url")
  practice      String?
  publishedAt   DateTime? @map("published_at")
  eventDate     DateTime? @map("event_date")
  eventLocation String?   @map("event_location")
  eventType     String?   @map("event_type")
  sourceId      String?   @map("source_id")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  campaignContents CampaignContent[]
  engagements      CampaignEngagement[]

  @@index([type])
  @@index([practice])
  @@index([sourceId])
  @@map("content_items")
}
```

- [ ] **Step 2: Add Campaign model**

```prisma
model Campaign {
  id              String    @id @default(uuid())
  partnerId       String    @map("partner_id")
  name            String
  subject         String?
  bodyTemplate    String?   @map("body_template")
  source          String    @default("ACTIVATE")
  status          String    @default("DRAFT")
  segmentCriteria String?   @map("segment_criteria")
  sentAt          DateTime? @map("sent_at")
  sendStartedAt   DateTime? @map("send_started_at")
  lastError       String?   @map("last_error")
  importedFrom    String?   @map("imported_from")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  partner    Partner             @relation(fields: [partnerId], references: [id])
  contents   CampaignContent[]
  recipients CampaignRecipient[]

  @@index([partnerId])
  @@index([partnerId, status])
  @@index([status])
  @@map("campaigns")
}
```

Add `campaigns Campaign[]` to the `Partner` model's relations.

- [ ] **Step 3: Add CampaignContent join model**

```prisma
model CampaignContent {
  id            String @id @default(uuid())
  campaignId    String @map("campaign_id")
  contentItemId String @map("content_item_id")
  position      Int    @default(0)

  campaign    Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contentItem ContentItem @relation(fields: [contentItemId], references: [id])

  @@unique([campaignId, contentItemId])
  @@index([campaignId])
  @@index([contentItemId])
  @@map("campaign_contents")
}
```

- [ ] **Step 4: Add CampaignRecipient model**

```prisma
model CampaignRecipient {
  id              String    @id @default(uuid())
  campaignId      String    @map("campaign_id")
  contactId       String?   @map("contact_id")
  unmatchedEmail  String?   @map("unmatched_email")
  personalizedBody String?  @map("personalized_body")
  rsvpToken       String?   @map("rsvp_token")
  rsvpStatus      String?   @map("rsvp_status")
  rsvpRespondedAt DateTime? @map("rsvp_responded_at")
  status          String    @default("PENDING")
  failureReason   String?   @map("failure_reason")
  sentAt          DateTime? @map("sent_at")

  campaign    Campaign             @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contact     Contact?             @relation(fields: [contactId], references: [id])
  engagements CampaignEngagement[]

  @@unique([campaignId, contactId])
  @@index([campaignId])
  @@index([contactId])
  @@index([campaignId, status])
  @@index([rsvpToken])
  @@map("campaign_recipients")
}
```

Add `campaignRecipients CampaignRecipient[]` to the `Contact` model's relations.

- [ ] **Step 5: Add CampaignEngagement model**

```prisma
model CampaignEngagement {
  id            String    @id @default(uuid())
  recipientId   String    @map("recipient_id")
  type          String
  contentItemId String?   @map("content_item_id")
  timestamp     DateTime  @default(now())
  metadata      String?

  recipient   CampaignRecipient @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  contentItem ContentItem?      @relation(fields: [contentItemId], references: [id])

  @@index([recipientId])
  @@index([recipientId, type])
  @@index([contentItemId])
  @@map("campaign_engagements")
}
```

- [ ] **Step 6: Run migration**

```bash
npx prisma migrate dev --name add_campaigns_feature
```

Expected: Migration creates 5 new tables. Existing tables untouched.

- [ ] **Step 7: Verify Prisma client generates correctly**

```bash
npx prisma generate
```

- [ ] **Step 8: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add Campaign, ContentItem, CampaignContent, CampaignRecipient, CampaignEngagement models"
```

---

## Task 2: Content Library Seed Data + Campaign Mock Data

**Files:**
- Create: `prisma/seed-data/content-library.ts`
- Create: `prisma/seed-data/campaigns.ts`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Create content-library.ts with article and event ContentItems**

Create `prisma/seed-data/content-library.ts`. Use the existing `articleNames` from `engagements.ts` and `eventNames` / `practices` / `locations` / `eventTypes` to populate the shared library. Generate 12 articles and 8 events.

```typescript
const articles = [
  { id: "ci-art-001", type: "ARTICLE", title: "The economic potential of generative AI: The next productivity frontier", description: "Our latest research suggests generative AI could add $2.6–$4.4 trillion annually to the global economy.", url: "https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/the-economic-potential-of-generative-ai-the-next-productivity-frontier", practice: "Digital & Analytics", publishedAt: new Date("2025-06-14") },
  { id: "ci-art-002", type: "ARTICLE", title: "What every CEO should know about generative AI", description: "A practical guide for senior leaders navigating AI transformation.", url: "https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/what-every-ceo-should-know-about-generative-ai", practice: "Strategy & Corporate Finance", publishedAt: new Date("2025-05-21") },
  { id: "ci-art-003", type: "ARTICLE", title: "The state of AI: How organizations are rewiring to capture value", description: "Our annual survey shows organizations that have adopted AI are seeing measurable business impact.", url: "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai", practice: "AI", publishedAt: new Date("2025-08-01") },
  { id: "ci-art-004", type: "ARTICLE", title: "Agentic AI: The next frontier of generative AI", description: "Agentic systems that can plan, reason, and act autonomously represent the next wave of AI capability.", url: "https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/agentic-ai", practice: "AI", publishedAt: new Date("2025-11-15") },
  { id: "ci-art-005", type: "ARTICLE", title: "Supercharging the value of generative AI in banking", description: "Banks that move quickly on gen AI could see a 20-30% improvement in key operational metrics.", url: "https://www.mckinsey.com/industries/financial-services/our-insights/supercharging-genai-in-banking", practice: "Financial Services", publishedAt: new Date("2025-07-10") },
  { id: "ci-art-006", type: "ARTICLE", title: "Building resilient supply chains in a volatile world", description: "Companies that invest in supply chain resilience outperform peers during disruptions.", url: "https://www.mckinsey.com/capabilities/operations/our-insights/building-resilient-supply-chains", practice: "Operations", publishedAt: new Date("2025-09-20") },
  { id: "ci-art-007", type: "ARTICLE", title: "Rethinking solar project delivery for a clean-energy future", description: "Scaling solar requires a fundamental rethink of how projects are developed and delivered.", url: "https://www.mckinsey.com/industries/electric-power-and-natural-gas/our-insights/rethinking-solar", practice: "GEM (Global Energy & Materials)", publishedAt: new Date("2025-04-05") },
  { id: "ci-art-008", type: "ARTICLE", title: "McKinsey Technology Trends Outlook 2025", description: "Our annual assessment of the development, potential, and progress of key technology trends.", url: "https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/technology-trends-outlook-2025", practice: "TMT", publishedAt: new Date("2025-07-25") },
  { id: "ci-art-009", type: "ARTICLE", title: "How to future-proof your technology operating model", description: "Five shifts CIOs must make to create a technology function fit for the AI era.", url: "https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/future-proof-tech-operating-model", practice: "TMT", publishedAt: new Date("2025-10-01") },
  { id: "ci-art-010", type: "ARTICLE", title: "Cybersecurity in the age of generative AI", description: "Generative AI creates new attack vectors and new defense capabilities. Here's how to stay ahead.", url: "https://www.mckinsey.com/capabilities/risk-and-resilience/our-insights/cybersecurity-genai", practice: "Risk & Resilience", publishedAt: new Date("2025-12-10") },
  { id: "ci-art-011", type: "ARTICLE", title: "Navigating the AI era: A CEO's guide to strategy and execution", description: "CEOs who treat AI as a strategic priority rather than a technology project see 3x the impact.", url: "https://www.mckinsey.com/featured-insights/navigating-the-ai-era", practice: "Strategy & Corporate Finance", publishedAt: new Date("2026-01-15") },
  { id: "ci-art-012", type: "ARTICLE", title: "From potential to profit: Closing the AI impact gap", description: "Most organizations capture less than a third of AI's potential value. Here's how to close the gap.", url: "https://www.mckinsey.com/capabilities/quantumblack/our-insights/closing-the-ai-impact-gap", practice: "AI", publishedAt: new Date("2026-02-01") },
];

const events = [
  { id: "ci-evt-001", type: "EVENT", title: "McKinsey AI & Analytics Summit", description: "Annual summit bringing together technology leaders to explore the latest in AI and analytics.", practice: "AI", eventDate: new Date("2026-05-15"), eventLocation: "New York", eventType: "In-person" },
  { id: "ci-evt-002", type: "EVENT", title: "McKinsey Transformation Summit", description: "A gathering of CXOs focused on enterprise-wide transformation strategies.", practice: "Implementation", eventDate: new Date("2026-06-10"), eventLocation: "Chicago", eventType: "In-person" },
  { id: "ci-evt-003", type: "EVENT", title: "McKinsey CDO Forum Caserta", description: "Intimate forum for Chief Digital Officers at a historic Italian venue.", practice: "Digital & Analytics", eventDate: new Date("2026-07-08"), eventLocation: "Caserta, Italy", eventType: "In-person" },
  { id: "ci-evt-004", type: "EVENT", title: "McKinsey GenAI Executive Briefing", description: "Half-day virtual briefing on practical GenAI applications for senior executives.", practice: "AI", eventDate: new Date("2026-04-22"), eventLocation: "Virtual", eventType: "Virtual" },
  { id: "ci-evt-005", type: "EVENT", title: "McKinsey CEO Leadership Forum", description: "Annual forum for CEOs to discuss leadership challenges and strategic priorities.", practice: "Strategy & Corporate Finance", eventDate: new Date("2026-09-18"), eventLocation: "Washington, DC", eventType: "In-person" },
  { id: "ci-evt-006", type: "EVENT", title: "McKinsey CFO Forum", description: "Deep-dive sessions on financial strategy, capital allocation, and value creation.", practice: "Strategy & Corporate Finance", eventDate: new Date("2026-08-05"), eventLocation: "Boston", eventType: "Hybrid" },
  { id: "ci-evt-007", type: "EVENT", title: "McKinsey Private Equity Operating Partners Summit", description: "PE operating partners share insights on portfolio company value creation.", practice: "Private Capital", eventDate: new Date("2026-10-12"), eventLocation: "Stamford", eventType: "In-person" },
  { id: "ci-evt-008", type: "EVENT", title: "McKinsey Supply Chain Leaders Forum", description: "Senior supply chain leaders explore resilience, sustainability, and digital transformation.", practice: "Operations", eventDate: new Date("2026-05-28"), eventLocation: "Atlanta", eventType: "In-person" },
];

export function generateContentLibrary() {
  return { articles, events };
}
```

- [ ] **Step 2: Create campaigns.ts with mock sent campaigns**

Create `prisma/seed-data/campaigns.ts`. Generate mock campaigns for ALL 5 partners — a mix of article shares, event invites, and plain emails. Each partner gets 3-6 campaigns with 4-8 recipients drawn from their own contacts, with realistic engagement data (opens, clicks, RSVPs). Include drafts and imported campaigns across partners.

Partners: Ava Patel (`p-ava-patel`), Jordan Kim (`p-jordan-kim`), Sam Rivera (`p-sam-rivera`), Morgan Chen (`p-morgan-chen`), Taylor Brooks (`p-taylor-brooks`).

Distribution: Ava Patel gets 6 campaigns (showcased in detail below). Jordan Kim gets 4 campaigns (2 article, 1 event invite, 1 draft). Sam Rivera gets 3 campaigns (1 article, 1 event, 1 imported). Morgan Chen gets 4 campaigns (2 article, 1 plain email, 1 event invite). Taylor Brooks gets 3 campaigns (1 article, 1 event, 1 draft).

```typescript
import { v4 as uuidv4 } from "uuid";

interface ContactRef {
  id: string;
  name: string;
  companyId: string;
  partnerId: string;
  title: string;
}

export function generateMockCampaigns(contacts: ContactRef[]) {
  const avaContacts = contacts.filter(c => c.partnerId === "p-ava-patel");
  // Pick subsets for each campaign
  const campaigns: any[] = [];
  const campaignContents: any[] = [];
  const recipients: any[] = [];
  const engagements: any[] = [];

  // Campaign 1: AI article share — SENT, 6 recipients
  const c1Id = "camp-mock-001";
  campaigns.push({
    id: c1Id, partnerId: "p-ava-patel",
    name: "AI Strategy Insights — Q1 2026",
    subject: "Thought you'd find this valuable — AI strategy insights",
    bodyTemplate: "Hi {{name}},\n\nI came across this piece on AI strategy and immediately thought of your work at {{company}}. The insights on executive decision-making around AI investments are particularly relevant given what we discussed last time.\n\nWould love to hear your perspective.",
    source: "ACTIVATE", status: "SENT",
    sentAt: new Date("2026-03-15T09:00:00Z"),
    sendStartedAt: new Date("2026-03-15T08:59:50Z"),
    createdAt: new Date("2026-03-14T16:00:00Z"),
    updatedAt: new Date("2026-03-15T09:00:00Z"),
  });
  campaignContents.push({ id: "cc-001", campaignId: c1Id, contentItemId: "ci-art-011", position: 0 });
  campaignContents.push({ id: "cc-002", campaignId: c1Id, contentItemId: "ci-art-004", position: 1 });
  const c1Recipients = avaContacts.slice(0, 6);
  for (let i = 0; i < c1Recipients.length; i++) {
    const rId = `cr-001-${i}`;
    recipients.push({
      id: rId, campaignId: c1Id, contactId: c1Recipients[i].id,
      status: "SENT", sentAt: new Date("2026-03-15T09:00:00Z"),
    });
    // 4 of 6 opened, 3 clicked
    if (i < 4) engagements.push({ id: `ce-001-${i}-open`, recipientId: rId, type: "OPENED", timestamp: new Date(`2026-03-15T${10 + i}:30:00Z`) });
    if (i < 3) engagements.push({ id: `ce-001-${i}-click`, recipientId: rId, type: "CLICKED", contentItemId: "ci-art-011", timestamp: new Date(`2026-03-15T${11 + i}:00:00Z`) });
  }

  // Campaign 2: Event invite — SENT, 5 recipients, RSVP data
  const c2Id = "camp-mock-002";
  campaigns.push({
    id: c2Id, partnerId: "p-ava-patel",
    name: "GenAI Executive Briefing — Invite",
    subject: "You're invited: McKinsey GenAI Executive Briefing (Apr 22)",
    bodyTemplate: "Hi {{name}},\n\nI'd like to personally invite you to our upcoming GenAI Executive Briefing. Given your role at {{company}}, I think you'd find the practical application sessions especially relevant.\n\nPlease RSVP using the link below.",
    source: "ACTIVATE", status: "SENT",
    sentAt: new Date("2026-03-20T10:00:00Z"),
    sendStartedAt: new Date("2026-03-20T09:59:50Z"),
    createdAt: new Date("2026-03-19T14:00:00Z"),
    updatedAt: new Date("2026-03-20T10:00:00Z"),
  });
  campaignContents.push({ id: "cc-003", campaignId: c2Id, contentItemId: "ci-evt-004", position: 0 });
  const c2Recipients = avaContacts.slice(2, 7);
  const rsvpStatuses = ["ACCEPTED", "ACCEPTED", "ACCEPTED", "DECLINED", null];
  for (let i = 0; i < c2Recipients.length; i++) {
    const rId = `cr-002-${i}`;
    const token = `rsvp-${c2Id}-${i}`;
    recipients.push({
      id: rId, campaignId: c2Id, contactId: c2Recipients[i].id,
      status: "SENT", sentAt: new Date("2026-03-20T10:00:00Z"),
      rsvpToken: token,
      rsvpStatus: rsvpStatuses[i] || undefined,
      rsvpRespondedAt: rsvpStatuses[i] ? new Date(`2026-03-2${1 + i}T14:00:00Z`) : undefined,
    });
    if (i < 4) engagements.push({ id: `ce-002-${i}-open`, recipientId: rId, type: "OPENED", timestamp: new Date(`2026-03-20T${12 + i}:00:00Z`) });
    if (rsvpStatuses[i] === "ACCEPTED") {
      engagements.push({ id: `ce-002-${i}-rsvp`, recipientId: rId, type: "EVENT_REGISTERED", contentItemId: "ci-evt-004", timestamp: new Date(`2026-03-2${1 + i}T14:00:00Z`) });
    }
  }

  // Campaign 3: Supply chain article — SENT, 4 recipients
  const c3Id = "camp-mock-003";
  campaigns.push({
    id: c3Id, partnerId: "p-ava-patel",
    name: "Supply Chain Resilience Insights",
    subject: "New research on supply chain resilience — relevant for your team",
    bodyTemplate: "Hi {{name}},\n\nOur latest research on building resilient supply chains has some findings I think would resonate with what {{company}} is navigating.\n\nHappy to discuss further.",
    source: "ACTIVATE", status: "SENT",
    sentAt: new Date("2026-03-25T08:30:00Z"),
    sendStartedAt: new Date("2026-03-25T08:29:50Z"),
    createdAt: new Date("2026-03-24T17:00:00Z"),
    updatedAt: new Date("2026-03-25T08:30:00Z"),
  });
  campaignContents.push({ id: "cc-004", campaignId: c3Id, contentItemId: "ci-art-006", position: 0 });
  const c3Recipients = avaContacts.slice(5, 9);
  for (let i = 0; i < c3Recipients.length; i++) {
    const rId = `cr-003-${i}`;
    recipients.push({
      id: rId, campaignId: c3Id, contactId: c3Recipients[i].id,
      status: "SENT", sentAt: new Date("2026-03-25T08:30:00Z"),
    });
    if (i < 3) engagements.push({ id: `ce-003-${i}-open`, recipientId: rId, type: "OPENED", timestamp: new Date(`2026-03-25T${10 + i}:00:00Z`) });
    if (i < 2) engagements.push({ id: `ce-003-${i}-click`, recipientId: rId, type: "ARTICLE_READ", contentItemId: "ci-art-006", timestamp: new Date(`2026-03-25T${11 + i}:30:00Z`) });
  }

  // Campaign 4: Plain outreach email — SENT, 3 recipients
  const c4Id = "camp-mock-004";
  campaigns.push({
    id: c4Id, partnerId: "p-ava-patel",
    name: "Q2 Check-in Outreach",
    subject: "Quick check-in as we head into Q2",
    bodyTemplate: "Hi {{name}},\n\nAs we head into Q2, I wanted to reach out and see how things are going at {{company}}. Would love to catch up over coffee or a quick call.\n\nBest,\nAva",
    source: "ACTIVATE", status: "SENT",
    sentAt: new Date("2026-03-28T11:00:00Z"),
    sendStartedAt: new Date("2026-03-28T10:59:50Z"),
    createdAt: new Date("2026-03-28T10:00:00Z"),
    updatedAt: new Date("2026-03-28T11:00:00Z"),
  });
  const c4Recipients = avaContacts.slice(0, 3);
  for (let i = 0; i < c4Recipients.length; i++) {
    const rId = `cr-004-${i}`;
    recipients.push({
      id: rId, campaignId: c4Id, contactId: c4Recipients[i].id,
      status: "SENT", sentAt: new Date("2026-03-28T11:00:00Z"),
    });
    if (i < 2) engagements.push({ id: `ce-004-${i}-open`, recipientId: rId, type: "OPENED", timestamp: new Date(`2026-03-28T${13 + i}:00:00Z`) });
  }

  // Campaign 5: AI Summit invite — DRAFT (not sent yet)
  const c5Id = "camp-mock-005";
  campaigns.push({
    id: c5Id, partnerId: "p-ava-patel",
    name: "AI & Analytics Summit — May Invite",
    subject: "Save the date: McKinsey AI & Analytics Summit (May 15)",
    bodyTemplate: "Hi {{name}},\n\nI'm excited to invite you to our AI & Analytics Summit in New York this May. It's shaping up to be an exceptional lineup.\n\nWould love to see you there.",
    source: "ACTIVATE", status: "DRAFT",
    createdAt: new Date("2026-03-30T15:00:00Z"),
    updatedAt: new Date("2026-03-30T15:00:00Z"),
  });
  campaignContents.push({ id: "cc-005", campaignId: c5Id, contentItemId: "ci-evt-001", position: 0 });
  const c5Recipients = avaContacts.slice(0, 8);
  for (let i = 0; i < c5Recipients.length; i++) {
    recipients.push({
      id: `cr-005-${i}`, campaignId: c5Id, contactId: c5Recipients[i].id,
      status: "PENDING",
    });
  }

  // Campaign 6: Imported from external system
  const c6Id = "camp-mock-006";
  campaigns.push({
    id: c6Id, partnerId: "p-ava-patel",
    name: "DNA-NA--Event In Person-CDO Forum Caserta",
    source: "IMPORTED", status: "SENT",
    importedFrom: "Marketo",
    sentAt: new Date("2026-02-10T09:00:00Z"),
    createdAt: new Date("2026-02-10T09:00:00Z"),
    updatedAt: new Date("2026-02-10T09:00:00Z"),
  });
  campaignContents.push({ id: "cc-006", campaignId: c6Id, contentItemId: "ci-evt-003", position: 0 });
  const c6Recipients = avaContacts.slice(1, 5);
  for (let i = 0; i < c6Recipients.length; i++) {
    const rId = `cr-006-${i}`;
    recipients.push({
      id: rId, campaignId: c6Id, contactId: c6Recipients[i].id,
      status: "SENT", sentAt: new Date("2026-02-10T09:00:00Z"),
    });
    if (i < 3) engagements.push({ id: `ce-006-${i}-open`, recipientId: rId, type: "OPENED", timestamp: new Date(`2026-02-10T${14 + i}:00:00Z`) });
    if (i < 2) engagements.push({ id: `ce-006-${i}-click`, recipientId: rId, type: "CLICKED", contentItemId: "ci-evt-003", timestamp: new Date(`2026-02-11T${10 + i}:00:00Z`) });
  }

  return { campaigns, campaignContents, recipients, engagements };
}
```

- [ ] **Step 3: Update seed.ts to include content library and campaign data**

In `prisma/seed.ts`:
1. Import `generateContentLibrary` from `./seed-data/content-library` and `generateMockCampaigns` from `./seed-data/campaigns`
2. Add `await prisma.campaignEngagement.deleteMany()` and `await prisma.campaignRecipient.deleteMany()` and `await prisma.campaignContent.deleteMany()` and `await prisma.campaign.deleteMany()` and `await prisma.contentItem.deleteMany()` at the top of the clear section (before `campaignOutreach.deleteMany()`)
3. After creating campaign outreaches, add:

```typescript
// Content Library
const { articles: contentArticles, events: contentEvents } = generateContentLibrary();
const allContentItems = [...contentArticles, ...contentEvents];
console.log(`Creating ${allContentItems.length} content library items...`);
for (const batch of chunk(allContentItems, 50)) {
  await prisma.contentItem.createMany({ data: batch });
}

// Mock Campaigns
const mockCampaignData = generateMockCampaigns(contactRefs);
console.log(`Creating ${mockCampaignData.campaigns.length} mock campaigns...`);
for (const c of mockCampaignData.campaigns) {
  await prisma.campaign.create({ data: c });
}
for (const batch of chunk(mockCampaignData.campaignContents, 50)) {
  await prisma.campaignContent.createMany({ data: batch });
}
console.log(`Creating ${mockCampaignData.recipients.length} campaign recipients...`);
for (const batch of chunk(mockCampaignData.recipients, 50)) {
  await prisma.campaignRecipient.createMany({ data: batch });
}
console.log(`Creating ${mockCampaignData.engagements.length} campaign engagements...`);
for (const batch of chunk(mockCampaignData.engagements, 50)) {
  await prisma.campaignEngagement.createMany({ data: batch });
}
```

4. Add summary lines at the bottom.

- [ ] **Step 4: Run seed to verify**

```bash
npx prisma db seed
```

Expected: Seed completes with content items and mock campaigns created without errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(seed): add content library and mock campaign data with engagement tracking"
```

---

## Task 3: Campaign Repository (Interface + Prisma Implementation)

**Files:**
- Create: `src/lib/repositories/interfaces/campaign-repository.ts`
- Create: `src/lib/repositories/prisma/campaign-repository.ts`
- Modify: `src/lib/repositories/index.ts`

- [ ] **Step 1: Create the interface**

Create `src/lib/repositories/interfaces/campaign-repository.ts`:

```typescript
import type {
  Campaign,
  CampaignRecipient,
  CampaignEngagement,
  ContentItem,
} from "@prisma/client";

export type CampaignWithStats = Campaign & {
  _count: { recipients: number };
  contents: { contentItem: ContentItem }[];
  stats: { openRate: number; clickRate: number };
};

export type CampaignDetail = Campaign & {
  contents: { contentItem: ContentItem; position: number }[];
  recipients: (CampaignRecipient & {
    contact: { id: string; name: string; title: string; company: { name: string } } | null;
    engagements: CampaignEngagement[];
  })[];
};

export interface ICampaignRepository {
  findByPartnerId(partnerId: string, filters?: { status?: string; source?: string }): Promise<CampaignWithStats[]>;
  findById(id: string, partnerId: string): Promise<CampaignDetail | null>;
  create(data: Omit<Campaign, "id" | "createdAt" | "updatedAt">): Promise<Campaign>;
  update(id: string, partnerId: string, data: Partial<Campaign>): Promise<Campaign>;
  delete(id: string, partnerId: string): Promise<void>;
  addRecipients(campaignId: string, contactIds: string[]): Promise<void>;
  addContent(campaignId: string, contentItemIds: string[]): Promise<void>;
  findRecipientsByRsvpToken(rsvpToken: string): Promise<CampaignRecipient | null>;
  recordEngagement(recipientId: string, type: string, contentItemId?: string, metadata?: string): Promise<void>;
  getContentItemStats(contentItemId: string): Promise<{ timesShared: number; uniqueOpens: number; totalClicks: number }>;
}
```

- [ ] **Step 2: Create the Prisma implementation**

Create `src/lib/repositories/prisma/campaign-repository.ts` implementing `ICampaignRepository`. Follow the same pattern as `PrismaEngagementRepository` — import `prisma` from `@/lib/db/prisma`, implement each method with Prisma queries. Key methods:

- `findByPartnerId`: Query campaigns with `_count` on recipients, compute open/click rates via subquery on engagements
- `findById`: Include `contents.contentItem`, `recipients.contact`, `recipients.engagements`
- `recordEngagement`: Simple `prisma.campaignEngagement.create`
- `getContentItemStats`: Aggregate across all campaigns containing that content item

- [ ] **Step 3: Export from index.ts**

Add to `src/lib/repositories/index.ts`:

```typescript
import { PrismaCampaignRepository } from "./prisma/campaign-repository";
export const campaignRepo = new PrismaCampaignRepository();
```

Add `ICampaignRepository, CampaignWithStats, CampaignDetail` to the type exports.

- [ ] **Step 4: Commit**

```bash
git add src/lib/repositories/
git commit -m "feat(repo): add campaign repository with interface and Prisma implementation"
```

---

## Task 4: Content Ingestion Service (Tavily Article Fetch)

**Files:**
- Create: `src/lib/services/content-ingestion-service.ts`

- [ ] **Step 1: Create content-ingestion-service.ts**

Follow the pattern of `news-ingestion-service.ts`. Use `tavily({ apiKey })` with `client.search()` to find recent McKinsey articles. Upsert into `ContentItem` matching on `sourceId` (derived from URL).

```typescript
import { tavily } from "@tavily/core";
import { prisma } from "@/lib/db/prisma";

interface FetchedArticle {
  title: string;
  description: string;
  url: string;
}

async function fetchMcKinseyArticles(maxResults = 10): Promise<FetchedArticle[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const client = tavily({ apiKey });
    const response = await client.search("McKinsey insights latest articles site:mckinsey.com", {
      maxResults,
      searchDepth: "basic",
    });

    return (response.results ?? []).map((r) => ({
      title: r.title,
      description: r.content?.slice(0, 300) ?? "",
      url: r.url,
    }));
  } catch (err) {
    console.error("[content-ingestion] Tavily search failed:", err);
    return [];
  }
}

export async function ingestArticles(): Promise<number> {
  const articles = await fetchMcKinseyArticles(15);
  if (articles.length === 0) return 0;

  let created = 0;
  for (const article of articles) {
    const sourceId = article.url;
    const existing = await prisma.contentItem.findFirst({ where: { sourceId } });
    if (!existing) {
      await prisma.contentItem.create({
        data: {
          type: "ARTICLE",
          title: article.title,
          description: article.description,
          url: article.url,
          sourceId,
          practice: inferPractice(article.title),
          publishedAt: new Date(),
        },
      });
      created++;
    }
  }

  console.log(`[content-ingestion] Ingested ${created} new articles`);
  return created;
}

function inferPractice(title: string): string | null {
  const lower = title.toLowerCase();
  if (lower.includes("ai") || lower.includes("generative") || lower.includes("agentic")) return "AI";
  if (lower.includes("banking") || lower.includes("financial")) return "Financial Services";
  if (lower.includes("supply chain") || lower.includes("operations")) return "Operations";
  if (lower.includes("energy") || lower.includes("solar") || lower.includes("climate")) return "GEM (Global Energy & Materials)";
  if (lower.includes("technology") || lower.includes("digital") || lower.includes("cyber")) return "TMT";
  if (lower.includes("ceo") || lower.includes("strategy") || lower.includes("transformation")) return "Strategy & Corporate Finance";
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/content-ingestion-service.ts
git commit -m "feat(service): add content ingestion service for Tavily article fetching"
```

---

## Task 5: LLM Campaign Service

**Files:**
- Create: `src/lib/services/llm-campaign.ts`

- [ ] **Step 1: Create llm-campaign.ts**

Follow the pattern of `llm-email.ts`. Three functions: `generateCampaignTemplate`, `personalizeCampaignEmail`, `generateCampaignFollowUp`. Each uses `callLLM` from `llm-core.ts` with JSON parsing and template fallbacks.

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/llm-campaign.ts
git commit -m "feat(service): add LLM campaign service for template generation, personalization, and follow-ups"
```

---

## Task 6: Email Service — Campaign Email Builder

**Files:**
- Modify: `src/lib/services/email-service.ts`

- [ ] **Step 1: Add buildCampaignEmailHtml function**

Add at the end of `email-service.ts`. Constructs HTML email with personalized opening, content item cards (article cards with "Read Article" CTA, event cards with RSVP button), and tracking pixel. Follow the existing `escHtml` + inline-style HTML pattern.

- [ ] **Step 2: Add sendCampaignEmail function**

Wraps `resend.emails.send()` with campaign-specific `from` (Partner name) and `reply-to` (Partner email). Returns `{ sent, error, messageId }` matching the `sendOutreachEmail` pattern.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/email-service.ts
git commit -m "feat(email): add campaign email builder and sender with tracking pixel and RSVP links"
```

---

## Task 7: Tracking API Routes (Open, Click, RSVP)

**Files:**
- Create: `src/app/api/track/open/[recipientId]/route.ts`
- Create: `src/app/api/track/click/[recipientId]/route.ts`
- Create: `src/app/api/track/click/[recipientId]/[contentItemId]/route.ts`
- Create: `src/app/api/track/rsvp/[rsvpToken]/route.ts`

- [ ] **Step 1: Create open tracking endpoint**

Returns a 1x1 transparent GIF. Records `OPENED` engagement. Unauthenticated. Returns 204 for invalid IDs.

- [ ] **Step 2: Create click tracking endpoints**

Plain link variant reads `?url=` query param. Content variant looks up `ContentItem.url`. Both record `CLICKED` (or `ARTICLE_READ` for articles) and 302-redirect.

- [ ] **Step 3: Create RSVP endpoint**

Looks up recipient by `rsvpToken`. Records `EVENT_REGISTERED` engagement, sets `rsvpStatus`. Renders a simple confirmation HTML page. Supports `?response=decline`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/track/
git commit -m "feat(api): add tracking endpoints for campaign opens, clicks, and RSVP"
```

---

## Task 8: Content Library API Route

**Files:**
- Create: `src/app/api/content-library/route.ts`
- Create: `src/app/api/content-library/[id]/stats/route.ts`

- [ ] **Step 1: Create GET /api/content-library**

Authenticated. Returns paginated content items filterable by `type`, `practice`, `search` query params. Uses `prisma.contentItem.findMany()`.

- [ ] **Step 2: Create GET /api/content-library/[id]/stats**

Returns aggregate engagement stats for a content item: times shared, unique opens, total clicks. Uses `campaignRepo.getContentItemStats()`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/content-library/
git commit -m "feat(api): add content library list and stats endpoints"
```

---

## Task 9: Campaign CRUD API Routes

**Files:**
- Create: `src/app/api/campaigns/route.ts`
- Create: `src/app/api/campaigns/[id]/route.ts`

- [ ] **Step 1: Create GET /api/campaigns (list) and POST /api/campaigns (create)**

`GET`: Authenticated, returns `campaignRepo.findByPartnerId()` with filters.
`POST`: Creates DRAFT campaign. Resolves segment criteria to concrete recipient rows. Validates contact ownership.

- [ ] **Step 2: Create GET/PATCH/DELETE /api/campaigns/[id]**

`GET`: Returns `campaignRepo.findById()` with full detail.
`PATCH`: Updates draft only. Validates `status === "DRAFT"`.
`DELETE`: Deletes draft only.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/campaigns/
git commit -m "feat(api): add campaign CRUD routes"
```

---

## Task 10: Campaign Action Routes (Preview, Send, Follow-Up, Import)

**Files:**
- Create: `src/app/api/campaigns/[id]/preview/route.ts`
- Create: `src/app/api/campaigns/[id]/send/route.ts`
- Create: `src/app/api/campaigns/[id]/follow-up/route.ts`
- Create: `src/app/api/campaigns/import/route.ts`

- [ ] **Step 1: Create POST /api/campaigns/[id]/preview**

Generates personalized emails for all recipients using `llm-campaign.ts`. Stores `personalizedBody` on each `CampaignRecipient`. Returns preview data.

- [ ] **Step 2: Create POST /api/campaigns/[id]/send**

Idempotent. Sets `sendStartedAt`, status `SENDING`. Iterates recipients with `Promise.allSettled`, calls `sendCampaignEmail` per recipient. Updates status to `SENT` or `FAILED`. Skips already-`SENT` recipients on retry.

- [ ] **Step 3: Create POST /api/campaigns/[id]/follow-up**

Accepts `{ recipientIds }`. For each recipient, retrieves engagement data, calls `generateCampaignFollowUp()`, returns draft emails.

- [ ] **Step 4: Create POST /api/campaigns/import**

Accepts external campaign data. Creates Campaign with `source: IMPORTED`. Matches contacts by email. Creates recipients and engagements.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/campaigns/
git commit -m "feat(api): add campaign preview, send, follow-up, and import routes"
```

---

## Task 11: Middleware — Protect Campaign Routes

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Add campaign paths to protectedPaths and matcher**

Add to `protectedPaths`:
```typescript
"/campaigns",
"/api/campaigns",
"/api/content-library",
```

Add to `config.matcher`:
```typescript
"/campaigns/:path*",
"/api/campaigns/:path*",
"/api/content-library/:path*",
```

Note: `/api/track` endpoints are intentionally NOT protected (they're embedded in emails).

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): add campaign and content library routes to middleware protection"
```

---

## Task 12: Campaigns Page — Sub-Tabs (My Campaigns, Articles, Events)

**Files:**
- Modify: `src/app/campaigns/page.tsx`

- [ ] **Step 1: Replace the Coming Soon placeholder**

Replace the entire content of `src/app/campaigns/page.tsx` with a tabbed layout using `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`. Three tabs: "My Campaigns" (default), "Articles", "Events".

**My Campaigns tab:** Fetch `GET /api/campaigns`, display in a table with name, content type icon, date, recipients, open rate, click rate. Filter bar with All/Sent/Draft tabs and search. "New Campaign" button links to `/campaigns/new`. Empty state for no campaigns.

**Articles tab:** Fetch `GET /api/content-library?type=ARTICLE`, display as cards with title, practice, description, "Share" button (links to `/campaigns/new?contentId=xxx`). Show per-article stats.

**Events tab:** Fetch `GET /api/content-library?type=EVENT`, display as cards with title, date, location, type, "Invite" button (links to `/campaigns/new?contentId=xxx`). Show per-event stats (invites, RSVPs).

- [ ] **Step 2: Commit**

```bash
git add src/app/campaigns/page.tsx
git commit -m "feat(ui): replace campaigns placeholder with tabbed layout — My Campaigns, Articles, Events"
```

---

## Task 13: Campaign Builder Page

**Files:**
- Create: `src/app/campaigns/new/page.tsx`

- [ ] **Step 1: Build the campaign creation page**

Progressive single-page form with 4 sections:
1. **Content** — content library browser (modal/drawer) with type/practice filter. Pre-populate from `?contentId=` query param. Selected items as removable chips.
2. **Recipients** — toggle between manual pick (searchable contact list) and smart segment (rules builder). Resolved list with add/remove.
3. **Compose** — subject field, body template textarea. "AI Draft" button calls LLM. Content items auto-rendered as preview cards.
4. **Preview & Send** — calls `POST /api/campaigns/[id]/preview`, shows personalized emails. "Send Campaign" button with confirmation dialog calls `POST /api/campaigns/[id]/send`.

Uses existing components: `DashboardShell`, `Card`, `Badge`, `Button`, `Input`, `Tabs`.

- [ ] **Step 2: Commit**

```bash
git add src/app/campaigns/new/
git commit -m "feat(ui): add campaign builder page with content selection, recipients, compose, and preview"
```

---

## Task 14: Campaign Detail Page

**Files:**
- Create: `src/app/campaigns/[id]/page.tsx`

- [ ] **Step 1: Build the campaign detail page**

Fetches `GET /api/campaigns/[id]`. Two in-page tabs:

**Overview tab:** Summary cards (total recipients, open rate, click rate, article reads, RSVPs). Per-content stats. Engagement timeline.

**Recipients tab:** Table with contact name, company, status, last engagement. "Draft Follow-Up" action per row and bulk action. Follow-up calls `POST /api/campaigns/[id]/follow-up`.

- [ ] **Step 2: Commit**

```bash
git add src/app/campaigns/[id]/
git commit -m "feat(ui): add campaign detail page with overview stats and recipient tracking"
```

---

## Task 15: Update Contact Detail — Campaign Engagement

**Files:**
- Modify: `src/app/contacts/[id]/page.tsx`
- Modify: `src/lib/repositories/prisma/engagement-repository.ts`
- Modify: `src/lib/repositories/interfaces/engagement-repository.ts`
- Modify: `src/app/api/contacts/[id]/engagements/route.ts`

- [ ] **Step 1: Add campaign engagement query to engagement repository**

Add `findCampaignEngagementsByContactId(contactId)` method that queries `CampaignRecipient` where `contactId` matches, includes `campaign`, `engagements`, and `campaign.contents.contentItem`. Returns richer data than the old `findCampaignsByContactId`.

- [ ] **Step 2: Update engagements API route**

In `src/app/api/contacts/[id]/engagements/route.ts`, add the new campaign engagement data alongside existing data. Return both old `campaigns` (for backward compat) and new `campaignEngagements`.

- [ ] **Step 3: Update contact detail page Campaign Outreach section**

Replace the flat `CampaignOutreach` table (lines ~1821-1874 in `src/app/contacts/[id]/page.tsx`) with richer campaign engagement display: campaign name (linked to `/campaigns/[id]`), content shared, engagement status (Opened/Clicked/RSVP'd), date. Keep the same card/table visual pattern.

- [ ] **Step 4: Commit**

```bash
git add src/app/contacts/ src/lib/repositories/ src/app/api/contacts/
git commit -m "feat(ui): update contact detail with rich campaign engagement data"
```

---

## Task 16: Content Ingestion Cron Route

**Files:**
- Create: `src/app/api/cron/content-ingestion/route.ts`
- Modify: `vercel.json` (add cron schedule)

- [ ] **Step 1: Create the cron route**

Create `src/app/api/cron/content-ingestion/route.ts`. Follow the pattern of existing cron routes (`nudge-refresh`, `morning-briefing`). Use `verifyCronSecret()` from `@/lib/utils/cron-auth` for authentication. Call `ingestArticles()` from `content-ingestion-service.ts`.

```typescript
import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { ingestArticles } from "@/lib/services/content-ingestion-service";

export async function POST(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const count = await ingestArticles();
    return NextResponse.json({ success: true, articlesIngested: count });
  } catch (err) {
    console.error("[cron/content-ingestion] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Add to vercel.json cron config**

Add to the existing `crons` array in `vercel.json`:

```json
{
  "path": "/api/cron/content-ingestion",
  "schedule": "0 6 * * *"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/content-ingestion/ vercel.json
git commit -m "feat(cron): add content ingestion cron route for daily article fetching"
```

---

## Task 17: Update Contact Full API and Company API for New Campaign Data

**Files:**
- Modify: `src/app/api/contacts/[id]/full/route.ts`
- Modify: `src/app/api/companies/[id]/route.ts`
- Modify: `src/lib/repositories/interfaces/engagement-repository.ts`
- Modify: `src/lib/repositories/prisma/engagement-repository.ts`

- [ ] **Step 1: Add findCampaignEngagementsByContactId to engagement repository**

Add to the interface (`interfaces/engagement-repository.ts`) and implementation (`prisma/engagement-repository.ts`):

```typescript
// Interface
findCampaignEngagementsByContactId(contactId: string): Promise<any[]>;

// Implementation
async findCampaignEngagementsByContactId(contactId: string) {
  return prisma.campaignRecipient.findMany({
    where: { contactId },
    include: {
      campaign: {
        include: { contents: { include: { contentItem: true } } },
      },
      engagements: true,
    },
    orderBy: { campaign: { sentAt: "desc" } },
  });
}
```

- [ ] **Step 2: Update /api/contacts/[id]/full/route.ts**

At line 30-34, add `campaignEngagements` to the `Promise.all` engagements block:

```typescript
const [events, articles, campaigns, campaignEngagements] = await Promise.all([
  engagementRepo.findEventsByContactId(id),
  engagementRepo.findArticlesByContactId(id),
  engagementRepo.findCampaignsByContactId(id),
  engagementRepo.findCampaignEngagementsByContactId(id),
]);
```

Return `campaignEngagements` in the response alongside existing `campaigns` for backward compatibility.

- [ ] **Step 3: Update /api/companies/[id]/route.ts**

This route aggregates engagement data per company contact. Find where it calls `engagementRepo.findCampaignsByContactId` and add `findCampaignEngagementsByContactId` alongside it. Include the new data in the company response under `engagements.campaignEngagements`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/contacts/ src/app/api/companies/ src/lib/repositories/
git commit -m "feat(api): update contact full and company routes with new campaign engagement data"
```

---

## Task 18: CampaignOutreach Migration Script

**Files:**
- Create: `prisma/scripts/migrate-campaign-outreach.ts`

- [ ] **Step 1: Create migration script**

Write a standalone script that:
1. Reads all `CampaignOutreach` rows grouped by `(contact.partnerId, name)`
2. For each group, creates a `Campaign` with `source: IMPORTED`
3. Maps each outreach row to a `CampaignRecipient` + `CampaignEngagement` (Sent → `SENT` recipient; Opened → `OPENED` engagement; Clicked → `CLICKED` engagement)
4. Logs progress and handles errors per-group

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function migrate() {
  const outreaches = await prisma.campaignOutreach.findMany({
    include: { contact: { select: { partnerId: true } } },
  });

  const groups = new Map<string, typeof outreaches>();
  for (const o of outreaches) {
    const key = `${o.contact.partnerId}::${o.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }

  console.log(`Migrating ${groups.size} campaign groups from ${outreaches.length} outreach rows...`);

  for (const [key, rows] of groups) {
    const [partnerId] = key.split("::");
    const name = rows[0].name;
    const earliest = rows.reduce((min, r) => r.statusDate < min ? r.statusDate : min, rows[0].statusDate);

    try {
      await prisma.$transaction(async (tx) => {
        const campaign = await tx.campaign.create({
          data: {
            partnerId, name, source: "IMPORTED", status: "SENT",
            importedFrom: "CampaignOutreach migration",
            sentAt: earliest, createdAt: earliest,
          },
        });

        for (const row of rows) {
          const recipient = await tx.campaignRecipient.create({
            data: {
              campaignId: campaign.id, contactId: row.contactId,
              status: "SENT", sentAt: row.statusDate,
            },
          });

          if (row.status === "Opened" || row.status === "Clicked") {
            await tx.campaignEngagement.create({
              data: { recipientId: recipient.id, type: "OPENED", timestamp: row.statusDate },
            });
          }
          if (row.status === "Clicked") {
            await tx.campaignEngagement.create({
              data: { recipientId: recipient.id, type: "CLICKED", timestamp: row.statusDate },
            });
          }
        }
      });
    } catch (err) {
      console.error(`Failed to migrate group "${name}" for partner ${partnerId}:`, err);
    }
  }

  console.log("Migration complete.");
}

migrate().catch(console.error).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run migration (development only for now)**

```bash
npx tsx prisma/scripts/migrate-campaign-outreach.ts
```

Note: In production, this would run as a one-time migration step. The old `CampaignOutreach` table is retained until the migration is verified.

- [ ] **Step 3: Commit**

```bash
git add prisma/scripts/
git commit -m "feat(migration): add CampaignOutreach to Campaign migration script"
```

---

## Task 19: Final Verification

- [ ] **Step 1: Run the full seed and verify data**

```bash
npx prisma db seed
```

Expected: All content items (12 articles, 8 events), ~20 mock campaigns across all 5 partners, recipients, and engagements created without errors.

- [ ] **Step 2: Start the dev server and manually verify**

```bash
npm run dev
```

Log in as Ava Patel. Verify each surface:

**Campaigns tab — My Campaigns:**
- As Ava Patel: should see 6 campaigns (4 sent, 1 draft, 1 imported) with engagement stats
- Switch to other partners (Jordan Kim, Sam Rivera, etc.) and verify they each see their own campaigns (3-4 each)
- "AI Strategy Insights — Q1 2026": 6 recipients, ~67% open rate, 50% click rate
- "GenAI Executive Briefing — Invite": 5 recipients, RSVP data (3 accepted, 1 declined, 1 pending)
- "Q2 Check-in Outreach": plain email, no content items
- "AI & Analytics Summit — May Invite": DRAFT status, no engagement data
- "DNA-NA--Event In Person-CDO Forum Caserta": IMPORTED badge

**Campaigns tab — Articles:**
- Should see 12 articles with "Share" buttons and aggregate stats
- Articles that were shared in campaigns should show stats (times shared, opens, clicks)

**Campaigns tab — Events:**
- Should see 8 events with "Invite" buttons and RSVP stats
- "McKinsey GenAI Executive Briefing" should show 3 RSVPs accepted

**Campaign detail:**
- Click into "AI Strategy Insights — Q1 2026" — Overview tab shows summary cards, per-content stats
- Recipients tab shows 6 contacts with Sent/Opened/Clicked status per row

**Contact detail:**
- Navigate to a contact who received campaigns — Engagement tab should show campaign data from new tables with links to campaign detail pages

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final adjustments from manual verification"
```

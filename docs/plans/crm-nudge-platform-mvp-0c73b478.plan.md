---
name: CRM Nudge Platform MVP
overview: Build a full-stack TypeScript CRM platform with Next.js, Postgres/pgvector, featuring nudge generation, meeting briefs, and RAG-powered chat - all with seeded mock data and a clear path to Snowflake integration.
todos:
  - id: phase-1-setup
    content: "Project setup: Next.js, Docker, Prisma schema, repository abstraction"
    status: completed
  - id: phase-2-seed
    content: Comprehensive seed data generation (5 partners, 12 companies, 80+ contacts, 350+ interactions, 200+ signals)
    status: completed
  - id: phase-3-auth
    content: NextAuth setup with partner-scoped data access
    status: completed
  - id: phase-4-services
    content: "Core services: Nudge engine, LLM service, RAG service, embedding service"
    status: completed
  - id: phase-5-api
    content: API routes for nudges, contacts, meetings, chat
    status: completed
  - id: phase-6-layout
    content: Frontend layout, navigation, shadcn/ui setup
    status: completed
  - id: phase-7-dashboard-nudges
    content: Dashboard and Nudges pages
    status: completed
  - id: phase-8-contacts
    content: Contacts list and detail pages with email drafting
    status: completed
  - id: phase-9-meetings
    content: Meetings list and brief generation
    status: completed
  - id: phase-10-chat
    content: RAG-powered chat interface
    status: completed
  - id: phase-11-testing-docs
    content: Tests, README, and Snowflake integration docs
    status: completed
isProject: false
---

# CRM Nudge Platform MVP Implementation Plan

## Architecture Overview

```mermaid
graph TB
    subgraph frontend [Frontend - Next.js App Router]
        Dashboard[Dashboard Page]
        Nudges[Nudges Page]
        Contacts[Contacts Page]
        ContactDetail[Contact Detail]
        Meetings[Meetings Page]
        MeetingDetail[Meeting Detail]
        Chat[Chat Interface]
    end
    
    subgraph backend [Backend - Next.js API Routes]
        AuthAPI[Auth API]
        NudgeAPI[Nudge API]
        ContactAPI[Contact API]
        MeetingAPI[Meeting API]
        ChatAPI[Chat API]
        LLMService[LLM Service]
        RAGService[RAG Service]
    end
    
    subgraph data [Data Layer]
        Repository[Repository Abstraction]
        PrismaImpl[Prisma Implementation]
        SnowflakeImpl[Snowflake Interface - Future]
    end
    
    subgraph storage [Storage]
        Postgres[(PostgreSQL)]
        pgvector[(pgvector)]
    end
    
    frontend --> backend
    backend --> Repository
    Repository --> PrismaImpl
    PrismaImpl --> Postgres
    RAGService --> pgvector
```



## Project Structure

```
crm-nudge-platform/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── nudges/
│   │   │   ├── contacts/
│   │   │   ├── meetings/
│   │   │   └── chat/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── nudges/
│   │   │   ├── contacts/
│   │   │   ├── meetings/
│   │   │   ├── chat/
│   │   │   └── signals/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── nudges/
│   │   ├── contacts/
│   │   ├── meetings/
│   │   └── chat/
│   ├── lib/
│   │   ├── db/
│   │   │   └── prisma.ts
│   │   ├── repositories/       # Data access abstraction
│   │   │   ├── interfaces/
│   │   │   ├── prisma/
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── nudge-engine.ts
│   │   │   ├── llm-service.ts
│   │   │   ├── rag-service.ts
│   │   │   └── embedding-service.ts
│   │   ├── auth/
│   │   └── utils/
│   └── types/
├── docs/
│   └── snowflake-integration.md
├── tests/
│   ├── nudge-engine.test.ts
│   ├── permissions.test.ts
│   └── rag-retrieval.test.ts
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

## Database Schema (Core Entities)

```mermaid
erDiagram
    Partner ||--o{ Contact : manages
    Partner ||--o{ Meeting : attends
    Company ||--o{ Contact : employs
    Contact ||--o{ Interaction : has
    Contact ||--o{ ExternalSignal : receives
    Contact ||--o{ Nudge : triggers
    Contact }o--o{ Meeting : attends
    Company ||--o{ ExternalSignal : receives
    Meeting ||--o{ MeetingBrief : generates
    
    Partner {
        uuid id PK
        string email
        string name
        string avatar_url
        timestamp created_at
    }
    
    Company {
        uuid id PK
        string name
        string industry
        string description
        int employee_count
        string website
    }
    
    Contact {
        uuid id PK
        uuid partner_id FK
        uuid company_id FK
        string name
        string email
        string title
        string phone
        enum importance
        text notes
        timestamp last_contacted
    }
    
    Interaction {
        uuid id PK
        uuid contact_id FK
        enum type
        timestamp date
        text summary
        enum sentiment
        text next_step
        vector embedding
    }
    
    ExternalSignal {
        uuid id PK
        uuid contact_id FK
        uuid company_id FK
        enum type
        timestamp date
        text content
        string url
        float confidence
        vector embedding
    }
    
    Nudge {
        uuid id PK
        uuid contact_id FK
        uuid signal_id FK
        text reason
        enum priority
        enum status
        text generated_email
        timestamp created_at
    }
    
    Meeting {
        uuid id PK
        uuid partner_id FK
        timestamp start_time
        string title
        text purpose
        text notes
        text generated_brief
    }
```



## Implementation Phases

### Phase 1: Project Setup and Database Foundation

- Initialize Next.js project with TypeScript, Tailwind, shadcn/ui
- Set up Docker Compose with PostgreSQL + pgvector
- Create Prisma schema with all entities
- Implement repository abstraction layer with interfaces
- Create Prisma-based repository implementations

**Key Files:**

- `package.json` - Dependencies including next, prisma, @prisma/client, openai, tailwindcss
- `docker-compose.yml` - PostgreSQL with pgvector extension
- `prisma/schema.prisma` - Full schema with vector fields
- `src/lib/repositories/interfaces/*.ts` - Repository interfaces
- `src/lib/repositories/prisma/*.ts` - Prisma implementations

### Phase 2: Seed Data Generation

- Create comprehensive seed script with realistic data
- 5 Partners with distinct personas
- 12 Companies (Microsoft, Apple, Amazon, JPMorgan, Google, Meta, Nvidia, Salesforce, Adobe, Netflix, Nike, PepsiCo)
- 80+ Contacts with realistic titles distributed across companies
- 350+ Interactions over 12 months with varied types and sentiments
- 50+ Meetings (past and upcoming)
- 200+ External Signals (news, events, job changes, LinkedIn activity)

**Key Files:**

- `prisma/seed.ts` - Main seed orchestrator
- `prisma/seed-data/partners.ts` - Partner definitions
- `prisma/seed-data/companies.ts` - Company definitions
- `prisma/seed-data/contacts.ts` - Contact generator
- `prisma/seed-data/interactions.ts` - Interaction generator
- `prisma/seed-data/signals.ts` - Signal generator
- `prisma/seed-data/meetings.ts` - Meeting generator

### Phase 3: Authentication and Authorization

- Implement NextAuth with simple credentials provider (dev auth)
- Create auth middleware for API routes
- Implement partner-scoped data access (multi-tenant filtering)
- Add session management and protected routes

**Key Files:**

- `src/lib/auth/auth-options.ts` - NextAuth configuration
- `src/app/api/auth/[...nextauth]/route.ts` - Auth API route
- `src/middleware.ts` - Route protection middleware
- `src/lib/auth/get-current-partner.ts` - Session helper

### Phase 4: Core Services

- **Nudge Engine**: Rule-based nudge generation
  - No interaction in 30/60/90 days rule
  - Job change signal rule
  - Company news rule
  - Upcoming event rule
  - Meeting prep rule
- **LLM Service**: OpenAI integration with template fallback
- **Embedding Service**: Generate embeddings for RAG
- **RAG Service**: Vector search + context assembly

**Key Files:**

- `src/lib/services/nudge-engine.ts` - Nudge generation logic
- `src/lib/services/llm-service.ts` - LLM abstraction with fallback
- `src/lib/services/embedding-service.ts` - Embedding generation
- `src/lib/services/rag-service.ts` - RAG retrieval and context

### Phase 5: API Routes

- `/api/nudges` - CRUD + refresh endpoint
- `/api/contacts` - List, detail, search
- `/api/contacts/[id]/interactions` - Interaction timeline
- `/api/contacts/[id]/signals` - Related signals
- `/api/contacts/[id]/draft-email` - Email generation
- `/api/meetings` - List upcoming meetings
- `/api/meetings/[id]/brief` - Generate meeting brief
- `/api/chat` - RAG-powered Q&A

**Key Files:**

- `src/app/api/nudges/route.ts`
- `src/app/api/nudges/refresh/route.ts`
- `src/app/api/contacts/route.ts`
- `src/app/api/contacts/[id]/route.ts`
- `src/app/api/contacts/[id]/draft-email/route.ts`
- `src/app/api/meetings/route.ts`
- `src/app/api/meetings/[id]/brief/route.ts`
- `src/app/api/chat/route.ts`

### Phase 6: Frontend - Layout and Navigation

- App shell with sidebar navigation
- Partner avatar and logout
- Responsive design with Tailwind
- shadcn/ui component setup

**Key Files:**

- `src/app/(dashboard)/layout.tsx` - Dashboard layout with sidebar
- `src/components/ui/*.tsx` - shadcn/ui components
- `src/components/layout/sidebar.tsx`
- `src/components/layout/header.tsx`

### Phase 7: Frontend - Dashboard and Nudges

- Dashboard with summary metrics (contacts, pending nudges, upcoming meetings)
- Today's top nudges preview
- Nudges list page with filters (priority, status, signal type)
- Nudge cards showing reason, contact, company, and signal source

**Key Files:**

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/nudges/page.tsx`
- `src/components/nudges/nudge-card.tsx`
- `src/components/nudges/nudge-filters.tsx`

### Phase 8: Frontend - Contacts

- Contacts table with search, sort, filter by company
- Contact detail page with:
  - Profile header (name, title, company, importance)
  - Interaction timeline (chronological)
  - Related signals panel
  - Active nudges for this contact
  - "Draft Outreach Email" panel with editable subject/body and copy button

**Key Files:**

- `src/app/(dashboard)/contacts/page.tsx`
- `src/app/(dashboard)/contacts/[id]/page.tsx`
- `src/components/contacts/contact-table.tsx`
- `src/components/contacts/contact-profile.tsx`
- `src/components/contacts/interaction-timeline.tsx`
- `src/components/contacts/email-draft-panel.tsx`

### Phase 9: Frontend - Meetings

- Upcoming meetings list with attendee previews
- Meeting detail page with:
  - Attendees list with roles and companies
  - Recent signals for attendees
  - Open opportunities (mock)
  - Last interactions summary
  - Generated brief with sections: Context, Agenda, Questions, Risks
  - Export/copy brief button

**Key Files:**

- `src/app/(dashboard)/meetings/page.tsx`
- `src/app/(dashboard)/meetings/[id]/page.tsx`
- `src/components/meetings/meeting-card.tsx`
- `src/components/meetings/meeting-brief.tsx`
- `src/components/meetings/attendee-insights.tsx`

### Phase 10: Frontend - Chat Interface

- Chat UI with message history
- Streaming responses (if LLM available)
- Source citations in responses
- Suggested questions
- Clear conversation button

**Key Files:**

- `src/app/(dashboard)/chat/page.tsx`
- `src/components/chat/chat-interface.tsx`
- `src/components/chat/message-bubble.tsx`
- `src/components/chat/citation-link.tsx`

### Phase 11: Testing and Documentation

- Unit tests for nudge engine rules
- Tests for permission/scoping logic
- Tests for RAG retrieval accuracy
- README with setup instructions
- Snowflake integration documentation

**Key Files:**

- `tests/nudge-engine.test.ts`
- `tests/permissions.test.ts`
- `tests/rag-retrieval.test.ts`
- `README.md`
- `docs/snowflake-integration.md`

## Key Technical Decisions

### Repository Abstraction Pattern

```typescript
// src/lib/repositories/interfaces/contact-repository.ts
export interface IContactRepository {
  findByPartnerId(partnerId: string): Promise<Contact[]>;
  findById(id: string, partnerId: string): Promise<Contact | null>;
  search(query: string, partnerId: string): Promise<Contact[]>;
}

// src/lib/repositories/prisma/contact-repository.ts
export class PrismaContactRepository implements IContactRepository {
  // Prisma implementation
}

// Future: src/lib/repositories/snowflake/contact-repository.ts
export class SnowflakeContactRepository implements IContactRepository {
  // Snowflake implementation
}
```

### LLM Fallback Strategy

```typescript
// src/lib/services/llm-service.ts
export async function generateEmail(context: EmailContext): Promise<string> {
  if (process.env.OPENAI_API_KEY) {
    return await generateWithOpenAI(context);
  }
  return generateWithTemplate(context); // Deterministic fallback
}
```

### Nudge Engine Rules

```typescript
// src/lib/services/nudge-engine.ts
const NUDGE_RULES = [
  { name: 'stale_contact_30', check: (c) => daysSinceContact(c) > 30 && c.importance === 'HIGH' },
  { name: 'stale_contact_60', check: (c) => daysSinceContact(c) > 60 },
  { name: 'job_change', check: (c, signals) => hasRecentJobChange(signals) },
  { name: 'company_news', check: (c, signals) => hasRecentCompanyNews(signals) },
  { name: 'upcoming_event', check: (c, signals) => hasUpcomingEvent(signals) },
  { name: 'meeting_prep', check: (c, meetings) => hasMeetingWithin(meetings, 3) },
];
```

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_nudge"

# Auth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# LLM (optional - falls back to templates)
OPENAI_API_KEY="sk-..."

# App
NODE_ENV="development"
```

## Commands to Run

```bash
# 1. Start database
docker compose up -d

# 2. Install dependencies
npm install

# 3. Run migrations
npx prisma migrate dev

# 4. Seed database
npx prisma db seed

# 5. Generate embeddings (if OPENAI_API_KEY set)
npm run generate-embeddings

# 6. Start development server
npm run dev
```

## Mock Data Disclaimer

The UI footer and README will include:

> "All company names, contacts, and data shown are entirely fictional and for demonstration purposes only. Any resemblance to real persons or actual events is coincidental."


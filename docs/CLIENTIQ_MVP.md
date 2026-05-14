# ClientIQ MVP Implementation Plan

## Architecture Overview

The platform is built with:

- **Frontend**: Next.js App Router — Dashboard, Nudges, Contacts, Contact Detail, Meetings, Meeting Detail, Chat
- **Backend**: Next.js API Routes — Auth, Nudge, Contact, Meeting, Chat APIs with LLM and RAG services
- **Data Layer**: Repository abstraction with Prisma implementation (SQLite/PostgreSQL), Snowflake interface for future
- **Storage**: PostgreSQL with pgvector (or SQLite for dev)

## Project Structure

```
clientiq/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/login/
│   │   ├── dashboard/
│   │   ├── nudges/
│   │   ├── contacts/
│   │   ├── meetings/
│   │   └── chat/
│   ├── api/
│   │   ├── auth/
│   │   ├── nudges/
│   │   ├── contacts/
│   │   ├── meetings/
│   │   └── chat/
│   ├── lib/
│   │   ├── db/
│   │   ├── repositories/       # Data access abstraction
│   │   ├── services/
│   │   │   ├── nudge-engine.ts
│   │   │   ├── llm-service.ts
│   │   │   ├── rag-service.ts
│   │   │   └── embedding-service.ts
│   │   └── auth/
│   └── components/
├── docs/
├── tests/
└── README.md
```

## Implementation Phases (Completed)

### Phase 1: Project Setup and Database Foundation
- Next.js with TypeScript, Tailwind, shadcn/ui
- Prisma schema with all entities
- Repository abstraction layer

### Phase 2: Seed Data Generation
- 5 Partners, 12 Companies, 80+ Contacts
- 350+ Interactions, 50+ Meetings, 200+ External Signals

### Phase 3: Authentication and Authorization
- NextAuth with partner-scoped data access
- Session management and protected routes

### Phase 4: Core Services
- Nudge Engine (rule-based generation)
- LLM Service (OpenAI with template fallback)
- Embedding Service, RAG Service

### Phase 5: API Routes
- Nudges, Contacts, Meetings, Chat APIs
- Email draft and meeting brief generation

### Phase 6: Frontend Layout and Navigation
- App shell with sidebar
- shadcn/ui components

### Phase 7: Dashboard and Nudges
- Summary metrics, top nudges preview
- Nudges list with filters

### Phase 8: Contacts
- Contacts table with search, sort, filter
- Contact detail with interaction timeline, signals, email drafting

### Phase 9: Meetings
- Upcoming meetings list
- Meeting detail with brief generation

### Phase 10: Chat Interface
- RAG-powered Q&A with source citations

### Phase 11: Testing and Documentation
- Unit tests for nudge engine, permissions, RAG
- README, Snowflake integration docs

## Key Technical Decisions

### Repository Abstraction Pattern

Interfaces define the contract; Prisma and (future) Snowflake provide implementations. Enables swapping data stores without changing application logic.

### LLM Fallback Strategy

When OPENAI_API_KEY is not set, the LLM service falls back to deterministic templates so the app remains functional.

### Nudge Engine Rules

Rule-based nudge generation with configurable thresholds, signal caps, and consolidated card model (one nudge per contact).

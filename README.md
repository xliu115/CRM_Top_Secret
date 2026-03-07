# Chirp

A proactive relationship management platform that helps Partners manage contacts, receive AI-powered nudges, generate meeting briefs, draft outreach emails, and ask anything about their clients.

> **Disclaimer:** All company names, contacts, and data shown are entirely fictional and for demonstration purposes only. Any resemblance to real persons or actual events is coincidental.

## Features

- **Dashboard** — Summary metrics, today's top nudges, and recent activity.
- **Nudges** — Proactive alerts explaining why you should reach out, with priority and signal context
- **Contacts** — Full contact directory with search, interaction timeline, and signals
- **Email Drafting** — AI-generated outreach emails using relationship context and signals
- **Meeting Briefs** — Structured 1-pager briefs with attendee insights, agenda, and suggested questions
- **Ask Anything** — RAG-powered chat to query your client data with source citations

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env if needed (defaults work out of the box with SQLite)

# 3. Run database migrations
npx prisma migrate dev

# 4. Seed the database with demo data
npx prisma db seed

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and select a partner to sign in.

### Optional: Enable AI Features

Set your OpenAI API key in `.env` for AI-powered email drafting, meeting briefs, and chat:

```env
OPENAI_API_KEY=sk-your-key-here
```

Without the key, the platform falls back to deterministic template-based generation.

### Production Setup (PostgreSQL + Docker)

For production or team development, use PostgreSQL with pgvector:

```bash
# Update .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chirp"

# Start PostgreSQL
docker compose up -d

# Update prisma/schema.prisma datasource provider to "postgresql"
# Run migrations and seed
npx prisma migrate dev
npx prisma db seed
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Database connection string (SQLite or PostgreSQL) |
| `NEXTAUTH_SECRET` | Yes | Secret for NextAuth JWT signing |
| `NEXTAUTH_URL` | Yes | Application URL (default: http://localhost:3000) |
| `OPENAI_API_KEY` | No | OpenAI API key for AI features (falls back to templates) |
| `RESEND_API_KEY` | No | [Resend](https://resend.com) API key for nudge digest emails |
| `RESEND_FROM` | No | Sender address (default: `Chirp <onboarding@resend.dev>`) |
| `NUDGE_EMAIL_TO` | No | Override recipient for all nudge emails (useful for demo) |

## Architecture

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/                # REST API endpoints
│   ├── dashboard/          # Dashboard page
│   ├── nudges/             # Nudges list page
│   ├── contacts/           # Contacts list and detail pages
│   ├── meetings/           # Meetings list and detail pages
│   ├── chat/               # Ask Anything chat interface
│   └── login/              # Partner selection login
├── components/
│   ├── ui/                 # Reusable UI components (Button, Card, Badge, etc.)
│   ├── layout/             # Sidebar, DashboardShell
│   └── providers/          # Session provider
└── lib/
    ├── auth/               # NextAuth configuration
    ├── db/                 # Prisma client singleton
    ├── repositories/       # Data access abstraction layer
    │   ├── interfaces/     # Repository interfaces (swap-friendly)
    │   └── prisma/         # Prisma implementations
    └── services/           # Business logic
        ├── nudge-engine.ts # Rule-based nudge generation
        ├── llm-service.ts  # LLM integration with template fallback
        └── rag-service.ts  # RAG retrieval for chat
```

### Data Access Layer

The repository pattern abstracts all database access behind interfaces. To swap from SQLite/Postgres to Snowflake (or any other data source), implement the interfaces in `src/lib/repositories/interfaces/` and update the factory in `src/lib/repositories/index.ts`.

See [docs/snowflake-integration.md](docs/snowflake-integration.md) for the Snowflake migration guide.

## Seeded Demo Data

The seed script creates:

| Entity | Count | Description |
|--------|-------|-------------|
| Partners | 5 | Ava Patel, Jordan Kim, Sam Rivera, Morgan Chen, Taylor Brooks |
| Companies | 12 | Microsoft, Apple, Amazon, JPMorgan, Google, Meta, Nvidia, Salesforce, Adobe, Netflix, Nike, PepsiCo |
| Contacts | 66 | Realistic titles (CIO, VP Eng, Head of Procurement, etc.) |
| Interactions | 367 | Emails, calls, meetings, notes over 12 months |
| External Signals | 196 | News, events, job changes, LinkedIn activity |
| Meetings | 71 | Past and upcoming with attendees |
| Event Registrations | 265 | Registered, Invited, Attended across practices and locations |
| Article Engagements | 264 | Article sends, views, and reader engagement |
| Campaign Outreaches | 278 | Sent, Opened, Clicked campaign records |

## Nudge Engine Rules

| Rule | Trigger | Priority |
|------|---------|----------|
| Stale Contact (90+ days) | No interaction in 90+ days | URGENT (CRITICAL) / HIGH |
| Stale Contact (60+ days) | No interaction in 60+ days | HIGH / MEDIUM |
| Stale Contact (30+ days) | No interaction in 30+ days (HIGH/CRITICAL only) | MEDIUM |
| Job Change | Contact had a role change in last 30 days | HIGH |
| Company News | Company in the news in last 14 days | MEDIUM |
| Upcoming Event | Event signal within 21 days | MEDIUM |
| Meeting Prep | Meeting within 3 days | HIGH |
| Event Attended | Contact attended an event in last 30 days | HIGH (CRITICAL) / MEDIUM |
| Event Registered | Contact registered for event within 14 days | MEDIUM |
| Article Read | Contact viewed an article in last 14 days | HIGH (CRITICAL/HIGH) / MEDIUM |

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

Tests cover:
- Nudge engine rule logic (15 tests)
- Permission/access control scoping (8 tests)
- RAG keyword extraction and document matching (11 tests)

## Tech Stack

- **Frontend:** Next.js 16 (App Router), Tailwind CSS v4, Radix UI primitives
- **Backend:** Next.js API Routes
- **Database:** SQLite (dev) / PostgreSQL + pgvector (production)
- **ORM:** Prisma 7
- **Auth:** NextAuth.js (credentials provider)
- **AI:** OpenAI GPT-4o-mini (optional, with template fallback)
- **Testing:** Vitest

## License

MIT

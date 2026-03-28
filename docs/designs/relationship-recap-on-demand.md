# Relationship Recap on Demand

**Status:** SHIPPED (evolved into Contact 360)
**Origin:** CEO Review Phase 2 — Candidate #1 (Accepted)
**Effort:** S (human: ~4h / CC: ~15min)
**Competitive Reference:** Folk CRM's Recap Assistant

## Overview

Relationship Recap on Demand was the initial concept: a structured AI-generated summary of a Partner's relationship with a specific contact, available on demand via the "Ask Anything" chat interface.

During planning, the scope was explicitly expanded by the user to include education, employment background, firm-wide relationship summaries, recent news, and job changes — transforming it from a simple recap into a full **Contact 360** intelligence platform.

## Original Scope

- Structured relationship summary via RAG + new prompt template
- Leverages existing "Ask Anything" chat pipeline
- CRM data: interactions, meetings, nudges, signals
- Output: prose narrative summarizing the relationship history

## Expansion to Contact 360

The user requested: _"not only including my relationship with a contact, but also adding in this person's education and employee background, their high-level relationship summary with other partners at the firm, recent news and job changes, etc. to make it a contact360 query."_

This expansion led to the [Contact 360 Intelligence Platform](./contact-360-intelligence-platform.md), which supersedes the original Relationship Recap concept.

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Scope | Expanded to Contact 360 | Simple recap insufficient — Partners need holistic intelligence |
| Data sources | CRM + Web search (Tavily) | Web enrichment provides education, news, job changes |
| Delivery | Chat, UI card, morning briefing | Multiple touchpoints maximize value |
| Implementation | Monolithic (single PR) | Interdependent components, faster to ship together |

## Relationship to Other Features

- **Superseded by:** Contact 360 Intelligence Platform
- **Depends on:** RAG service (`rag-service.ts`), LLM pipeline (`llm-core.ts`)
- **Feeds into:** Morning Briefing (mini-360 snippets), Ask Anything chat (Quick 360)

## Architecture

The original recap concept is preserved as the `generateMini360()` function — a lightweight 3-section variant used in morning briefing emails:

```
src/lib/services/llm-contact360.ts
├── generateContact360()   — Full 7-section dossier (UI card)
├── generateMini360()      — 3-section snippet (morning briefing email)
├── generateQuick360()     — Insight + talking points (chat thread)
└── Template fallbacks     — For when LLM is unavailable
```

## Competitive Context

Every major competitor in the relationship intelligence space offers some form of contact recap:

- **Folk CRM** — Recap Assistant generates relationship summaries
- **Dreamteam** — Rachel provides pre-meeting intelligence
- **Attio** — Relationship mapping with interaction history

Activate's Contact 360 goes further by combining CRM data with live web intelligence, firm-wide relationship mapping, and actionable talking points — delivering strategic briefings rather than simple summaries.

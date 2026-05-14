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

## The six sections

1. **Person Profile** — Name, title, company, industry. Education and career background synthesized from web results. Key facts: tenure at current company, previous roles, notable achievements.
2. **Relationship Overview** — How long you've known them (first interaction date), total interactions, last contact date, overall relationship health assessment, sentiment trend across interactions.
3. **Communication Timeline** — Last 5-8 significant interactions in reverse chronological order. Type (email/call/meeting), date, summary, sentiment. Highlights key moments (first meeting, last outreach, any negative sentiment).
4. **Firm-Wide Connections** — Which other partners at the firm know this person, their interaction intensity (Very High/High/Medium/Light), last contact dates, and how many contacts each partner has at the same company. Sourced from the existing firm-relationships query.
5. **News and Signals** — Recent company news (from ExternalSignal type=NEWS), job changes (type=JOB_CHANGE), LinkedIn activity (type=LINKEDIN_ACTIVITY), plus fresh web search results for this person + company. Highlights anything actionable.
6. **Open Threads and Recommendations** — Active nudges, unreplied emails, pending follow-ups, upcoming meetings, active outreach sequences. Then 2-3 specific strategic recommendations based on all the above data.

## Expansion to Contact 360

The user requested: *"not only including my relationship with a contact, but also adding in this person's education and employee background, their high-level relationship summary with other partners at the firm, recent news and job changes, etc. to make it a contact360 query."*

This expansion led to the [Contact 360 Intelligence Platform](./contact-360-intelligence-platform.md), which supersedes the original Relationship Recap concept.

## Key Decisions


| Decision       | Choice                          | Reasoning                                                       |
| -------------- | ------------------------------- | --------------------------------------------------------------- |
| Scope          | Expanded to Contact 360         | Simple recap insufficient — Partners need holistic intelligence |
| Data sources   | CRM + Web search (Tavily)       | Web enrichment provides education, news, job changes            |
| Delivery       | Chat, UI card, morning briefing | Multiple touchpoints maximize value                             |
| Implementation | Monolithic (single PR)          | Interdependent components, faster to ship together              |


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

ClientIQ's Contact 360 goes further by combining CRM data with live web intelligence, firm-wide relationship mapping, and actionable talking points — delivering strategic briefings rather than simple summaries.



## LLM prompt design

System prompt instructs the LLM to produce exactly 6 sections separated by `---SECTIONS---`:

```
You are a senior intelligence analyst preparing a 360-degree contact dossier
for a consulting Partner who is about to meet this person. Your tone is crisp,
specific, and strategic — like a briefing from a trusted chief of staff.

Rules:
- Write each section as 2-4 sentences of flowing prose. NO bullet points.
- Use **bold** for names, companies, dates, and key numbers.
- If web background is available, synthesize it naturally — don't just list search results.
- If web background is unavailable, focus on what the CRM tells us about this person.
- For the firm-wide section, highlight overlap and coordination opportunities.
- End with 2-3 specific, actionable recommendations.
- Be honest about gaps: "No recent interactions" is better than fabricating.

Output format:
<one-line summary: who they are and the single most important thing to know>
---SECTIONS---
[
  {"id":"profile","title":"Person Profile","content":"..."},
  {"id":"relationship","title":"Relationship Overview","content":"..."},
  {"id":"timeline","title":"Communication Timeline","content":"..."},
  {"id":"firm","title":"Firm-Wide Connections","content":"..."},
  {"id":"signals","title":"News and Signals","content":"..."},
  {"id":"actions","title":"Open Threads and Recommendations","content":"..."}
]
```


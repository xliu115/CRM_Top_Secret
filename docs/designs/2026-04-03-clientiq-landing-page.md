# Design: ClientIQ Executive Landing Page

Status: APPROVED
Date: 2026-04-03
Type: Standalone static website (separate repo)
Audience: Internal — firm leadership and executives

## 1. Overview

A single-scroll, executive-polished landing page that pitches ClientIQ to firm leadership. Pure static HTML/CSS/JS — zero dependencies, single `index.html`, deployable anywhere. No screenshots, no CTA buttons. The content and design authority do the persuading.

The page reads like a strategy brief brought to life: McKinsey-quality visual language, structured visual elements (icon-paired cards, comparison grids, flow diagrams), and subtle scroll animations — all in CSS with minimal vanilla JS.

## 2. Audience

Internal firm leadership: practice leaders, senior leadership, managing directors. People who approve budgets, assign pilot Partners, and decide whether ClientIQ becomes a firm-wide initiative. They value substance, credibility, and clear articulation of business impact. They do not want a SaaS marketing page.

## 3. Visual Design System

### Palette

Drawn from the MDS email palette already used in ClientIQ:

| Role | Color | Hex |
|------|-------|-----|
| Hero / section backgrounds | Deep Blue | `#051C2C` |
| Section labels / secondary accent | Blue | `#0070AD` |
| Highlight accent (sparingly) | Electric Blue | `#2251FF` |
| Body copy | Text | `#2D2D2D` |
| Secondary / caption text | Text Light | `#64748b` |
| Alternating section background | Background Light | `#F5F5F5` |
| Card / primary section background | White | `#FFFFFF` |
| Subtle dividers | Border | `#E0E0E0` |

### Typography

- **Headings:** Georgia, serif — the McKinsey signature. Large, weighted, authoritative.
- **Body:** System UI sans-serif stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) — clean, modern, readable.
- **Scale:** Hero title ~48px, section titles ~32px, subsection ~20px, body 17px, captions 14px.
- **Line-height:** 1.6 for body text, 1.2 for headings.

### Layout

- Max content width: 960px, centered.
- Vertical section padding: 80-120px.
- No sidebar, no navigation bar — continuous scroll only.
- "ClientIQ" wordmark at top (Georgia, text-only, not an image).
- Alternating white / light grey (`#F5F5F5`) section backgrounds for visual rhythm.

### Animation

- Subtle fade-in-up on scroll using CSS `@keyframes` and a lightweight `IntersectionObserver` (~20 lines of vanilla JS).
- No animation libraries. Elements fade in as the viewer scrolls to them.
- Restrained: only section headings and cards animate; body text does not.

## 4. Page Structure — 8 Sections

### Section 1: Hero — "The Opening Statement"

- **Background:** Deep Blue (`#051C2C`), full-width.
- **Top-left:** "ClientIQ" wordmark (Georgia, white, ~20px).
- **Headline (centered, white, Georgia, ~48px):** "Proactive Relationship Intelligence for Partners"
- **Subtitle (centered, white/80% opacity, sans-serif, ~20px):** "Surfacing who to contact, when, and why — with AI-drafted outreach ready to send and no relationship left to go cold."
- **No CTA, no image.** Just the statement.

### Section 2: The Problem — "Why This Matters"

- **Background:** White.
- **Section label:** Small caps "THE CHALLENGE" in Blue (`#0070AD`), 12px, letter-spacing 2px.
- **Headline (Georgia, ~32px):** "Relationship intelligence is fragmented. Adoption is failing."
- **Body (3 short paragraphs):**
  1. Partners cross-reference 5+ disconnected systems (Salesforce, Excel, PowerPoint, MS Planner, email threads, personal notes) to assemble a coherent picture of any client relationship.
  2. The firm invested in Salesforce, but adoption is near-zero. CRM adoption failure in professional services is widely cited at ~70%. The root cause: these systems are built for management visibility, not Partner productivity.
  3. When a Partner is busy, relationships go cold silently. When a Partner leaves, institutional knowledge walks out the door. Every insight requires manual effort to surface and manual entry to record.
- **3-column stat row** (centered, large numbers in Electric Blue, caption below each):
  - "5+" / "tools cross-referenced per meeting"
  - "~70%" / "CRM adoption failure in professional services"
  - "0" / "systematic relationship monitoring today"

### Section 3: Design Principles — "How ClientIQ Thinks"

- **Background:** Light Grey (`#F5F5F5`).
- **Section label:** "DESIGN PRINCIPLES"
- **6 principle cards** in a vertical list, each with a bold Georgia heading and one-sentence explanation:

1. **Zero-Effort Value** — Every interaction must deliver more than it asks. The morning briefing email is the proof: open it, read it, tap send. Done.
2. **Push Beats Pull** — The existing CRM failed because it waited for Partners to come to it. ClientIQ goes to the Partner. Email first, notification second, app third.
3. **Insights Over Data** — Partners don't want a table of interactions. They want a story: who to contact, why now, and a draft ready to send. Context, not columns.
4. **One Contact, One Truth** — Contact 360 is the canonical view. Every surface — dashboard, chat, email, mobile — draws from the same intelligence graph.
5. **The System Thinks, The Partner Decides** — ClientIQ recommends, drafts, sequences, and surfaces signals. The Partner retains full control. All AI content is presented as a draft for human review.
6. **Proper Visibility** — Information is scoped to what each Partner should see. Sensitive relationship data, coverage maps, and client intelligence respect firm access boundaries. No one sees what they shouldn't.

### Section 4: Capabilities — "Five Pillars"

- **Background:** White.
- **Section label:** "CAPABILITIES"
- **Headline (Georgia, ~32px):** "Five pillars of relationship intelligence"
- **5 feature blocks**, each with:
  - A simple CSS icon (a circle with a minimal line-drawn symbol)
  - A Georgia heading (~20px)
  - 2-3 sentences of description (sans-serif, 17px)

1. **Proactive Insights Delivery** — AI-generated morning briefing email weaving nudges, meetings, news, and relationship context into a 2-minute daily read. A 9-signal nudge engine (stale contact, missed meeting, news trigger, job change, sentiment shift, engagement drop, opportunity signal, relationship decay, custom) prioritized and delivered as actionable cards. Value delivered before the Partner ever opens the app.

2. **Deep Client360** — Contact 360: a 7-section AI dossier combining CRM data with live web intelligence — profile, relationship history, communication timeline, firm connections, news and signals, action items, and talking points. Company 360: 5-section company intelligence covering overview, coverage map, relationship health, signals, and strategic recommendations. Quick 360: summarized insight and talking points delivered inline in chat.

3. **Conversational AI + On-the-Go** — Ask Anything: natural language queries across all CRM data and web intelligence with RAG-powered retrieval. Contextual quick actions in every response. Intent detection for structured queries — relationship recap, meeting prep, contact search, nudge configuration. Voice input for hands-free queries and voice-over briefings for Partners on the move.

4. **Outreach Support** — Context-aware email drafting pre-loaded with relationship history, recent interactions, and relevant news. Cadence engine for multi-step relationship workflows: initial outreach, follow-up on no response, angle adjustment, escalation. Draft emails ready to review from the morning briefing, nudge cards, or chat. The Partner decides what to send.

5. **Multi-Channel Access** — Desktop dashboard with full-featured web application. Mobile conversational interface: chat-first design where the briefing is the homepage. Email: morning briefings, mini-360 snippets, and shareable dossiers delivered directly to the inbox. Primary value requires no app login.

### Section 5: Use Cases — "A Day with ClientIQ"

- **Background:** Light Grey (`#F5F5F5`).
- **Section label:** "USE CASES"
- **4 scenario cards**, each a short narrative (2-3 sentences) with a bold scenario title:

1. **The Morning Briefing** — A Partner opens their email over morning coffee. ClientIQ tells them: top contacts to reach out to today with reasons, upcoming meetings with context, and client news they should know about. They tap "send" on a pre-drafted note to a contact they haven't spoken to in 3 weeks. No CRM login required.

2. **Pre-Meeting Intelligence** — A Partner has a client meeting in 30 minutes. They open Contact 360 on their phone: a 7-section dossier covering background, relationship history, firm connections, recent news, and AI-generated talking points. They walk in prepared. The contact notices.

3. **"Ask Anything"** — A Partner remembers a contact but can't recall the details. They open the chat and ask "What's the latest with Sarah Chen?" ClientIQ returns a Quick 360: insight summary, talking points, and quick actions. They tap "Draft Email" and a context-aware message is generated. No page navigation.

4. **Automated Cadence** — A Partner initiated outreach to a prospect 5 days ago with no response. The cadence engine generates a follow-up with a different angle. If the contact responds, the sequence pauses. If no response after 3 touches, it escalates with a suggested warm introduction. The Partner never has to remember to follow up.

### Section 6: Channels — "Insights Delivered Where Partners Already Are"

- **Background:** White.
- **Section label:** "DELIVERY CHANNELS"
- **Horizontal flow diagram** (pure CSS — boxes connected by lines/arrows):
  - **Email** (primary, largest box, Electric Blue border) → **Notification** → **Desktop Web** → **Mobile Chat**
- **Body paragraph below the diagram:** "Primary value is push-based. The morning briefing and nudge notifications require no app login. The web dashboard and mobile interface are power surfaces for Partners who want to go deeper. ClientIQ goes to the Partner — the Partner never has to come to ClientIQ."

### Section 7: The Delta — "Status Quo vs. ClientIQ"

- **Background:** Light Grey (`#F5F5F5`).
- **Section label:** "THE DIFFERENCE"
- **Comparison grid** (CSS grid, no images):
  - Left column header: "Status Quo" (muted text)
  - Right column header: "With ClientIQ" (Electric Blue left-border accent)
  - Rows:

| Dimension | Status Quo | With ClientIQ |
|-----------|-----------|---------------|
| Meeting prep | Manual research across 5+ isolated tools | Single Contact 360 briefing with talking points |
| Relationship monitoring | Reactive — notice when it's too late | Proactive — nudged before it goes cold |
| Follow-up tracking | Manual to-do lists, often forgotten | Cadence sequences that persist until resolved |
| Client news awareness | Sporadic LinkedIn checking | Aggregated daily in morning briefing |
| Cross-partner coordination | None — duplicate outreach happens | Firm-wide coverage map per client |
| Manual effort | High — data entry, cross-referencing, tracking | Near-zero — primary value via email |

### Section 8: Closing — "The Assignment"

- **Background:** Deep Blue (`#051C2C`), full-width (mirrors hero).
- **Centered text (white, Georgia, ~28px):** "ClientIQ is ready for one Partner to start using it daily. The question is not whether this should exist. The question is who goes first."
- **Below:** "ClientIQ" wordmark centered, white, ~16px, with generous bottom padding.

## 5. Technical Spec

### Project Structure

```
clientiq-landing/
├── index.html          # Single HTML file with all content
├── styles.css          # All styles (could be inlined, but separate for maintainability)
├── script.js           # IntersectionObserver for scroll animations (~20 lines)
├── README.md           # Project description and deploy instructions
└── .gitignore
```

### Constraints

- **Zero dependencies.** No npm, no build step, no framework.
- **Single page.** All content in `index.html` or loaded via the two companion files.
- **No images.** All visual elements (icons, diagrams, flow arrows) are CSS-only.
- **No external requests.** No CDN fonts — system font stack for body, Georgia (universally installed) for headings.
- **Responsive.** Must read well on laptop screens (primary) and tablets. Mobile is secondary but should degrade gracefully (stack columns, reduce padding).
- **Accessibility.** Semantic HTML (`<header>`, `<section>`, `<footer>`), proper heading hierarchy, sufficient color contrast (all palette combinations pass WCAG AA), `prefers-reduced-motion` media query disables animations.
- **Performance.** Under 50KB total. Loads instantly.

### Browser Support

Modern browsers only (firm executives will be on Chrome, Edge, or Safari). No IE11 support needed.

## 6. Content Source

All copy is derived from the approved executive product document (`docs/designs/Xinyu_Liu-main-design-20260331-083116.md`). The landing page distills and restructures this content for a scrollable visual narrative rather than a document format. No new claims are introduced — every statement traces back to the exec doc.

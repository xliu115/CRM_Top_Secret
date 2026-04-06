# Dashboard CTA Reroute to Chat — Design Spec

**Date:** 2026-04-06
**Status:** Draft

## Problem

Dashboard CTAs ("Take action", "View more", briefing action buttons) route users to contact detail pages or meeting detail pages. The experience is fragmented — users leave the dashboard, land on a detail page, and then need to find the draft panel or brief. Instead, these actions should route into the **Ask Anything** chat interface, where the email draft or meeting brief is delivered conversationally with the full AI context.

## Goal

Reroute all dashboard CTAs (except campaign approvals) to `/chat` with a natural-language message and structured context params, so the chat AI can generate the email draft or meeting brief inline.

## Scope

**In scope:**
- Nudge card "Take action" links
- Meeting prep card "View more" links
- Briefing action buttons (narrative + structured views)

**Out of scope (unchanged):**
- Campaign approval CTAs — still link to `/campaigns/:id`
- Contact detail page (`/contacts/:id`) — still works as-is
- Meeting detail page (`/meetings/:id`) — still works as-is
- Chat general Q&A — unchanged
- Quick 360 buttons — already route to chat

## Design

### URL Schema

Dashboard CTAs navigate to `/chat` with query params:

- `q` — natural-language user message (displayed as the user's chat message)
- `nudgeId` — (optional) ID for direct nudge lookup
- `contactId` — (optional) ID for direct contact lookup
- `meetingId` — (optional) ID for direct meeting lookup

**CTA → URL mapping:**

| CTA | `q` | Extra params |
|-----|-----|--------------|
| Nudge "Take action" | `"Draft a {action} to {name} at {company}"` | `nudgeId`, `contactId` |
| Meeting "View more" | `"Prep me for my {title} meeting"` | `meetingId` |
| Briefing action (contact) | `"{actionLabel} for {contactName} at {company}"` | `nudgeId`, `contactId` |
| Briefing action (meeting) | `"Prep me for {meetingTitle}"` | `meetingId` |

The `q` message maps nudge `ruleType` to a natural action phrase:
- `STALE_CONTACT` → "Draft a check-in email to"
- `JOB_CHANGE` → "Draft a congratulations email to"
- `COMPANY_NEWS` → "Draft a news follow-up email to"
- `UPCOMING_EVENT` → "Draft a pre-event email to"
- `MEETING_PREP` → "Review meeting brief for"
- `EVENT_ATTENDED` → "Draft an event follow-up email to"
- `EVENT_REGISTERED` → "Draft an event outreach email to"
- `ARTICLE_READ` → "Draft a content follow-up email to"
- `LINKEDIN_ACTIVITY` → "Draft a LinkedIn follow-up email to"

### Changes

#### 1. Dashboard page (`src/app/dashboard/page.tsx`)

Add a helper `buildChatUrl(params)` that constructs the `/chat?q=...&nudgeId=...` URL.

**Nudge card "Take action"** (line ~1307):
- Current: `href={/contacts/${nudge.contact.id}?nudge=${nudge.id}}`
- New: `href={buildChatUrl({ q: "Draft a ... to {name} at {company}", nudgeId: nudge.id, contactId: nudge.contact.id })}`

**Meeting card "View more"** (line ~1192):
- Current: `href={/meetings/${meeting.id}}`
- New: `href={buildChatUrl({ q: "Prep me for my {title} meeting", meetingId: meeting.id })}`

**Briefing action buttons** (line ~997, also ~630 in structured view):
- Current: `href={action.deeplink}`
- New: Build chat URL based on action context. Parse the existing `action.deeplink` to extract IDs:
  - `/contacts/:contactId?nudge=:nudgeId` → extract both IDs, build chat URL with `q` from `action.actionLabel` + `action.contactName`
  - `/meetings/:meetingId` → extract meetingId, build chat URL with meeting prep message
  - `/campaigns/...` → keep original deeplink unchanged (no reroute)
  - `/nudges` (fallback) → route to chat with just the `q` message, no IDs
- Add a small `parseDeeplinkIds(deeplink)` helper to extract IDs from the URL string. This avoids changing the briefing API response shape.

Campaign approval CTAs remain unchanged — still link to `/campaigns/:id`.

#### 2. Chat page (`src/app/chat/page.tsx`)

Extend the `?q=` auto-send logic (line ~49) to also read `nudgeId`, `contactId`, `meetingId` from `searchParams`. Strip all params from URL. Pass structured context to `handleSend`.

#### 3. Chat session hook (`src/hooks/use-chat-session.ts`)

Extend `handleSend` signature to accept optional context metadata:

```typescript
handleSend(message?: string, context?: { nudgeId?: string; contactId?: string; meetingId?: string })
```

When context is present, include it in the `POST /api/chat` body alongside `message` and `history`.

#### 4. Chat API (`src/app/api/chat/route.ts`)

Read optional `context` field from request body. When structured IDs are present, use them in the existing intent branches:

- **`draft_email` intent with `context.nudgeId`**: Fetch nudge directly by ID, then fetch contact. Skip `contactRepo.search(nameQuery)` name-matching step.
- **`meeting_prep` intent with `context.meetingId`**: Fetch meeting directly by ID. Skip title-matching step.
- Falls back to existing name-matching behavior when no context IDs are provided.

This is backwards-compatible — existing chat flows (typed questions, Quick 360, suggested questions) continue to work exactly as before.

### What Does NOT Change

- Campaign approval CTAs — still link to `/campaigns/:id`
- Contact detail page — unchanged, accessible via direct navigation
- Meeting detail page — unchanged, accessible via direct navigation
- Chat general Q&A flow — unchanged
- Chat `draft_email` and `meeting_prep` intent classification — unchanged
- Quick 360 — already routes to chat
- LLM prompts — unchanged
- Email sending flow — unchanged (chat already has send capability)

## Files Changed

- `src/app/dashboard/page.tsx` — reroute CTAs, add `buildChatUrl` helper
- `src/app/chat/page.tsx` — read extra query params, pass context to `handleSend`
- `src/hooks/use-chat-session.ts` — accept optional context in `handleSend`, include in API body
- `src/app/api/chat/route.ts` — read `context` from body, use IDs for direct DB lookup

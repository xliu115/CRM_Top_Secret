# Mobile CTA Hierarchy — Chat Action Surfaces

**Date:** 2026-04-24
**Scope:** Mobile conversational UI (`/mobile`) — chat blocks for email drafting, meeting briefs, and nudge approvals
**Status:** Design approved, ready for implementation planning

## Problem

The mobile chat is the primary approval surface for partners — they see generated content (email drafts, meeting briefs, nudge insights) and decide to act. Today, the CTAs below generated content compete for attention. Every action (Send, Edit, Copy, Warmer, Shorter, Dismiss) renders as a same-weight pill, so the user's eye has no anchor for "what should I do next?"

Concrete symptoms:

- After an email draft renders, the primary `Send Email` pill is 12px text, visually indistinguishable from the `Copy` and `Warmer` pills next to it.
- Meeting briefs surface `Draft Email to X` and `View full brief` at equal weight — users pause to figure out which is the "main" next step.
- Nudge cards mix `Send Email` (constructive), `Dismiss` (destructive), `Snooze` (defer), and regenerate/copy utilities in one flat row.
- Long content (expanded meeting brief, long insight) pushes CTAs off-screen, forcing users to scroll to act.
- After editing an email in the full-screen composer, returning to the chat gives no visual cue that `Send` is the obvious next step.

## Design goals

1. **One blue-filled primary button per card.** Full stop. If two actions feel equally primary, pick the 80%-case.
2. **Consistent CTA pattern across all three approval flows** (email drafting, meeting brief, nudge approval) — one mental model.
3. **The primary CTA is always reachable** — even when card content is long.
4. **No behavior changes to the confirmation gate** — we keep the safety card before send/dismiss. Just align its visuals.
5. **Mobile-native** — 390×844 baseline, 44pt tap targets, no hover-dependent affordances, safe-area aware.

## Non-goals

- Replacing the confirmation card with an undo toast (considered, rejected — safety > speed for executive-partner sends).
- Adding swipe-to-dismiss on cards (conflicts with chat-feed vertical scroll).
- Auto-sending after composer Save (rejected — still needs an explicit Send tap).
- Redesigning the briefing card, quick-action pill tray, or voice overlay chrome (out of scope).

## Design principles

### Three-tier CTA hierarchy, always

| Tier | Purpose | Visual | Count per card |
|---|---|---|---|
| Primary | Single most expected next action | Blue filled, 44px | Exactly 1 |
| Secondary | Alternate path to primary | Blue outline, 44px | 0–1 |
| Tertiary | Modifiers, utilities, lifecycle | Muted icon row, 32–40px | 0–3, wraps freely |

Exactly one primary. Up to one secondary. Tertiary can wrap to multiple lines; they are intentionally demoted.

### Mobile frame constraints

| Dimension | Value | Implication |
|---|---|---|
| Viewport width | 375–430px (baseline 390) | Primary + secondary row must fit within ~358px usable |
| Usable height (keyboard open) | ~380px | Long cards must truncate or scroll intelligently |
| Minimum tap target | 44×44pt | Primary/secondary height ≥44px; tertiary ≥40px |
| Safe areas | Notch 44px, home bar 34px | Sticky bar + composer modal use `env(safe-area-inset-*)` |
| No hover | — | `:active` feedback only (`active:scale-[0.97]`) |

## Data model — block schema changes

Today's `ActionBarBlock` is `{ primary, secondary[] }`. There is no notion of a tertiary tier, and the renderer hard-codes hover/border styles. Two changes are required to drive the tier visuals from data:

```ts
// src/lib/types/chat-blocks.ts

type ActionBarItem = { label: string; query: string; icon: string };

export type ActionBarBlock = {
  type: "action_bar";
  data: {
    primary: ActionBarItem;
    secondary: ActionBarItem[];   // existing; renderer treats first as visual secondary
    tertiary?: ActionBarItem[];   // NEW — utilities/regenerate/lifecycle
    variant?: "default" | "destructive_primary";  // NEW — when primary is dismiss-style
  };
};
```

Server emitters (`src/app/api/chat/route.ts`) classify actions when constructing the block:

| Block context | primary | secondary[0] | tertiary |
|---|---|---|---|
| Email-draft cluster (priority contact, draft-only intent) | Send Email | Edit | Warmer, Shorter, Copy |
| Nudge-action cluster | Send Email | Edit | Warmer, Shorter, Copy, Dismiss, Snooze |
| Meeting brief — collapsed | View full brief | Draft Email | (none) |
| Meeting brief — expanded | Draft Email | Hide full brief | (none) |

The `data.secondary[]` array is preserved (≤1 item used as visual secondary; rest fall through to tertiary if no `tertiary` field is provided — so older blocks without `tertiary` still render correctly).

`Edit`'s `query` is a sentinel like `__edit_email__` (analogous to existing `__copy_email__`); the client opens the composer modal directly without a server round-trip.

## Button component spec

Updates to `src/components/chat/blocks/action-bar.tsx`; reused by confirmation card and composer modal header.

### Primary (blue filled)

```
bg-blue-600, text-white, rounded-lg
px-4 py-2.5, text-sm font-semibold
min-h-[44px]
active:scale-[0.97], active:bg-blue-800
icon: h-4 w-4, inline-left
```

### Secondary (blue outline)

```
bg-transparent, text-blue-600
border border-blue-600/60, rounded-lg
px-4 py-2.5, text-sm font-medium
min-h-[44px]
active:scale-[0.97], active:bg-blue-50
icon: h-4 w-4, inline-left
```

### Tertiary (icon row, muted)

```
bg-transparent, text-muted-foreground
no border, rounded-md
px-2 py-1.5, text-xs
min-h-[32px] (still tappable — padding contributes)
icon: h-3.5 w-3.5, inline-left
active:bg-muted/60
```

### Destructive primary (Confirm Dismiss only)

```
Primary spec, but bg-red-600 and active:bg-red-800.
```

### Destructive tertiary (Dismiss in nudge row)

```
Tertiary spec, but text-red-600/70.
```

## Layout template (shared across flows)

```
┌─────────────────────────────────────┐
│  [ card content ]                    │
├─────────────────────────────────────┤
│  [ PRIMARY FILLED ]  [ SECONDARY ]   │  main row, 44px tall
├─────────────────────────────────────┤
│  ↻ Warmer   ↻ Shorter   📋 Copy      │  tertiary row, 32–40px, wraps
└─────────────────────────────────────┘
```

- Main row: `flex gap-2`, each button `flex-1` when both present; primary full-width when alone.
- Tertiary row: `flex flex-wrap gap-2`, hidden entirely when no tertiary actions exist.
- Rows separated by a 1px `border-border/40` divider for visual grouping.

## Flow 1 — Email drafting

Applies to: priority-contact "View draft email", nudge "Draft email", and meeting-attendee "Draft Email to X".

### Before editing (initial render)

```
┌─────────────────────────────────────────┐
│  [TS]  Ted Sarandos      [HIGH]         │
│        Co-CEO @ Netflix                 │
│  ─────────────────────────────────────  │
│  Strategic insight: "Last touch was..." │
│  ─────────────────────────────────────  │
│  ✏ Email Draft                          │
│  To:       Ted Sarandos                 │
│  Subject:  Strengthening Our Collab.    │
│  Hi Ted, ... (first 10 lines)           │
│  ⋯ Show more ⋯                          │
├─────────────────────────────────────────┤
│  [ Send Email ]         [    Edit    ]  │
├─────────────────────────────────────────┤
│   ↻ Warmer   ↻ Shorter   📋 Copy        │
└─────────────────────────────────────────┘
```

- Primary: `Send Email` → opens confirmation card.
- Secondary: `Edit` → opens full-screen composer modal.
- Tertiary: `Warmer`, `Shorter`, `Copy`.
- Body > 10 lines gets a `Show more` inline expander. Composer always shows full body.
- Card body remains tap-to-edit (already implemented) as a bonus affordance.

### After editing (composer Save → modal close)

- Same layout. `Edit` relabels to `Edit again`.
- Send button gets a **2-second blue ring pulse** on mount: `<span className="absolute inset-0 rounded-lg ring-2 ring-blue-400 animate-ping opacity-60" />` scoped to the first 2s after the block re-renders with edited content.
- After pulse, returns to normal state.
- **Reduced motion** — wrap pulse and any `active:scale-[0.97]` in `motion-safe:` Tailwind variants. Users with `prefers-reduced-motion: reduce` get a static blue ring outline for 2s instead of the ping animation, and no scale on tap.
- **Show more state** — if the user expanded the body inline before opening the composer, the expansion persists after Save. Tracked in `EditableEmailDraft`'s local state.

## Flow 2 — Meeting brief

### Before expand (synthesis state)

```
┌─────────────────────────────────────────┐
│  📅  Pipeline Review w/ Netflix          │
│      Mon, Apr 28 · 10:00 AM   [WARM]    │
│                                         │
│  Goal: align on Q2 content deal.        │
│  Open with: "How's the rollout going?"  │
│  Warm relationship — worth rewarming.   │
├─────────────────────────────────────────┤
│  [ View full brief ]   [ Draft Email ]  │
└─────────────────────────────────────────┘
```

- Primary: `View full brief` — reading precedes acting.
- Secondary: `Draft Email to [first attendee]` (label truncates to `Draft Email` on mobile to fit).
- No tertiary row.
- If 2+ attendees: small `... and 2 more` text link below the secondary expands into a bottom-sheet attendee picker.

### After expand

```
┌─────────────────────────────────────────┐
│  [synthesis above]                      │
│  ─── Full brief ─────────────────────── │
│  MEETING GOAL / STARTERS / NEWS / ...   │
├─────────────────────────────────────────┤
│  [ Draft Email ]     [ Hide full brief] │
└─────────────────────────────────────────┘
```

- **Primary flips to `Draft Email`** — user has read the brief, now they act.
- Secondary becomes `Hide full brief` (toggles synthesis state).

## Flow 3 — Nudge approval

Same top half as email drafting (contact card + insight + editable draft). Differs in the CTA rows:

```
┌─────────────────────────────────────────┐
│  [contact card + strategic insight]     │
│  [editable email draft]                 │
├─────────────────────────────────────────┤
│  [ Send Email ]         [    Edit    ]  │
├─────────────────────────────────────────┤
│   ↻ Warmer   ↻ Shorter   📋 Copy        │
│   🗑 Dismiss   💤 Snooze                 │
└─────────────────────────────────────────┘
```

- Primary: `Send Email`.
- Secondary: `Edit`.
- Tertiary row wraps to 2 lines on mobile. Regenerate/copy on the first line; `Dismiss` (muted red) and `Snooze` (neutral) on the second.
- Tap `Dismiss` → confirmation card (red primary).
- Tap `Snooze` → confirmation card (blue primary, neutral copy).

## Always-visible CTA strategy (three layers)

### Layer 1 — Auto-collapse long content

Content truncation caps in `BlockClusterShell`:

- Email draft body: 10 lines, `Show more` expander inline.
- Strategic insight narrative: 3 lines, `Show more` expander.
- Meeting brief synthesis: uncapped (already short by construction).
- Meeting brief full expand: uncapped (user opted in; Layer 2 + 3 cover it).

### Layer 2 — Smart auto-scroll to CTA row

When a new assistant reply with an `action_bar` block renders, the chat feed scrolls so the **CTA row's bottom edge** aligns with the viewport's bottom (minus input area + quick-action pills).

Implementation: existing `scrollRef.current?.scrollIntoView` is swapped to a ref placed on the CTA row itself:

```ts
ctaRowRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
```

This replaces the current "scroll to absolute bottom" behavior for messages with action bars. Messages without action bars keep the old behavior.

### Layer 3 — Sticky quick-action bar

For cases where the user scrolls up to re-read content, or the card is tall even with truncation: a compact sticky bar slides in above the chat input.

```
┌─────────────────────────────────────────┐
│  [chat feed, user scrolled up]          │
├─────────────────────────────────────────┤
│  📧 Draft to Ted    [ Send Email ]  ⋮   │  48px tall, slides in
├─────────────────────────────────────────┤
│  [ quick-action pills tray ]            │
│  [ text input ]                         │
└─────────────────────────────────────────┘
```

- `IntersectionObserver` watches the **latest actionable card's CTA row** — defined as the action bar belonging to the message with the highest index in the assistant message list. Older cards never get a sticky bar even if they're more visible.
- `isIntersecting: false` → sticky bar fades in (150ms opacity transition).
- Content: context label (truncated with ellipsis, e.g. `Draft to Ted Sarandos`) + primary CTA only + `⋮` overflow button that opens a bottom-sheet with the secondary and tertiary actions for that card.
- Re-intersecting → fades out.
- Observer mounts only when at least one actionable card exists in the thread; unmounts otherwise. Idle cost = zero.
- **Suppressed** inside Call Marvin overlay (conflicts with voice controls).
- **Suppressed** when the text input is focused and keyboard is open (`visualViewport.onresize` detects keyboard, bar hides).
- **Suppressed** when a confirmation card is the latest actionable block — the confirmation gate is already a CTA-forward affordance; doubling up adds noise.
- Bottom-sheet implementation: lightweight new component at `src/components/chat/sticky-bottom-sheet.tsx` (~50 LOC, no library); slides up from bottom, dismisses on backdrop tap or swipe-down on its handle bar.

## Confirmation card (visual update only)

Behavior unchanged. Visual refresh:

```
┌─────────────────────────────────────┐
│  📧  Send to Ted Sarandos?          │
│      This will send the drafted     │
│      email as-is.                   │
├─────────────────────────────────────┤
│  [ Confirm Send ]      [  Cancel  ] │
└─────────────────────────────────────┘
```

- `Confirm [action]` → primary (filled), 44px.
- `Cancel` → secondary (outline), 44px.
- Description trimmed to ≤1 line on mobile (`line-clamp-1` with `title` attr for full text on tap-and-hold).
- `dismiss_nudge` variant: primary turns red (`bg-red-600`). Derived client-side from `data.action.type === "dismiss_nudge"` — no schema change needed.

## Composer modal polish

Already full-screen; already constrained to the mobile frame (via `absolute inset-0` inside `MobileShell`'s `relative` deviceFrame). Remaining tweaks:

- `Save` (top-right) — no change, already blue filled.
- `Cancel` (top-left) — stays a muted text button, NOT an outline. Deliberate exception to the secondary spec: in a commitment flow, the retreat option should be visually quieter.
- After Save closes the modal, **keyboard focus returns to the `Send Email` button** in the chat card. Screen readers announce "Send Email, button."
- Visible focus ring: `:focus-visible` only (no ring on touch taps).
- Keyboard-aware height: textarea uses `100dvh` minus keyboard, tracked via `window.visualViewport` resize listener.

## Mobile-specific behaviors

1. **Haptics** — primary button tap: `navigator.vibrate(10)`. Destructive confirm: `navigator.vibrate([20, 40, 20])`. No-op on iOS (vibrate API ignored), honored on Android.
2. **No hover, only :active** — every button uses `motion-safe:active:scale-[0.97]`. No `hover:*` classes that would add ambiguity on touch.
3. **Reduced motion** — `motion-safe:` prefix on all transitions, scale, and pulse animations. `prefers-reduced-motion: reduce` users get instant state changes and a static ring-only pulse.
4. **No swipe gestures on cards** — deliberate; conflicts with vertical scroll. (Swipe-down on bottom-sheet handle is the only swipe; isolated to that surface.)
5. **Keyboard awareness** — sticky bar hides when input is focused.
6. **iOS font-size 16px rule** — all inputs use `font-size: 16px` to prevent auto-zoom.

## Edge cases

1. **No action_bar block** → no CTA row rendered. Card ends at content.
2. **Send in-flight** → primary button disables, label becomes `Sending…`, inline spinner, fill stays blue.
3. **Regenerate in-flight** → primary + secondary disabled with `opacity-50`. Cleared when new draft block arrives.
4. **Call Marvin overlay** → same CTA hierarchy, but sticky bar suppressed. Voice intents (`send it`, `warmer`, `dismiss`) still work.
5. **Screen reader** — primary has `aria-label` matching label, sticky bar is `role="region" aria-live="polite" aria-label="Quick actions"`. Tertiary icon-only buttons always have explicit `aria-label`.

## Component changes summary

| File | Change |
|---|---|
| `src/components/chat/blocks/action-bar.tsx` | Apply new primary/secondary/tertiary visual spec; split into two rows (main + tertiary); support destructive variant |
| `src/components/chat/blocks/editable-email-draft.tsx` | Add 10-line truncate + `Show more`; add after-edit pulse state |
| `src/components/chat/blocks/meeting-brief.tsx` | Apply new button spec; flip primary CTA between pre-expand (`View full brief`) and post-expand (`Draft Email`) states |
| `src/components/chat/blocks/confirmation-card.tsx` | Apply new button spec; red primary variant for dismiss |
| `src/components/chat/blocks/block-renderer.tsx` | `NudgeActionCluster` renders Edit as secondary; `Dismiss`/`Snooze` move to tertiary row |
| `src/components/chat/sticky-action-bar.tsx` | **New** — IntersectionObserver-driven sticky bar |
| `src/components/chat/sticky-bottom-sheet.tsx` | **New** — small bottom-sheet for sticky bar's `⋮` overflow |
| `src/app/mobile/page.tsx` | Mount `StickyActionBar`; auto-scroll retargets `ctaRowRef` instead of `scrollRef` |
| `src/components/chat/blocks/email-composer-modal.tsx` | Focus-return on Save; visualViewport keyboard tracking |
| `src/lib/types/chat-blocks.ts` | Add `tertiary?` and `variant?` to `ActionBarBlock.data` |
| `src/app/api/chat/route.ts` | Server emitters tag tertiary actions and primary variant per the table above |

## Out of scope (for follow-up work)

- Undo toasts for sent emails (would replace confirmation card).
- Approval deck swipe UX (separate, already stubbed).
- Bottom-sheet attendee picker for meeting brief — for now, the meeting brief's `Draft Email` always targets the first attendee. Multi-attendee picker is a follow-up.
- Redesigning the briefing / quick-action pill tray.
- Tablet / desktop-native layouts.

## Open questions for the implementer

1. **Existing `embedded` vs non-embedded split in `ActionBar`** — today the same component renders two visual variants based on a prop. The new spec assumes the embedded variant (richer fill). Decision: keep the `embedded` prop, but make it cosmetic-only (small padding tweak); the tier system is the dominant visual driver in both modes. Confirm during implementation.
2. **Sentinel queries for client-only actions** — `__copy_email__` already exists; `__edit_email__` is new and routed client-side to open the composer. Make sure the server never tries to interpret these as user messages (existing `__copy_email__` handling is the precedent).
3. **Server emitter coverage** — every code path that constructs an `ActionBarBlock` needs to opt into the new tertiary/variant fields. Audit during implementation: priority-contact draft, nudge action, meeting brief, snooze/dismiss confirmations.

## Success criteria

After implementation, a partner opening `/mobile` and tapping a priority-contact draft-email pill should:

1. See a primary `Send Email` button that is unambiguously the biggest, most prominent control on the card.
2. Be able to reach that primary CTA without scrolling, in the common case (draft body ≤ 10 lines).
3. For long content, see the CTA row slide in as a sticky bar when the in-card CTA scrolls out of view.
4. After tapping Edit → Save in the composer, return to the chat with `Send Email` visually pulsing, clearly signaling the next step.
5. Tap `Send Email` → see a confirmation card with `[Confirm Send]` filled + `[Cancel]` outline, still behaviorally identical to today.

Every primary button at every step is blue-filled; every secondary is blue-outline; no tertiary utility competes with either.

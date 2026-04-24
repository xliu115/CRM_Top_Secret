# Mobile CTA Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a consistent three-tier CTA hierarchy (primary/secondary/tertiary) across mobile chat approval surfaces — email drafting, meeting briefs, and nudge approvals — with always-visible primary actions for long content.

**Architecture:** Extend `ActionBarBlock` schema with explicit `tertiary[]` and `variant` fields so the server can drive tier classification. Refactor `ActionBar` to render the three tiers with the new visual spec. Add a sticky action bar (IntersectionObserver-driven) that surfaces the primary CTA when the in-card CTA scrolls out of view. Polish edges: post-edit Send pulse, meeting brief CTA flip, focus return after composer Save.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Vitest, Lucide icons, Prisma. UI runs at `/mobile` inside `MobileShell` (390×844 device frame).

**Spec:** [`docs/designs/2026-04-24-mobile-cta-hierarchy-design.md`](./2026-04-24-mobile-cta-hierarchy-design.md)

---

## Pre-flight

Verify the current branch is clean (or on a feature branch we own), dev server runs, and the existing test suite is at its known-good state.

- [ ] **Step 0.1: Confirm branch and clean tree**

```bash
git status
git branch --show-current
```

If on `main`, create the feature branch: `git checkout -b mobile-cta-hierarchy`. The current state already has the `mobile-chat-approval-voice` branch from prior work; if continuing on it, that's fine.

- [ ] **Step 0.2: Baseline lint + typecheck + tests**

```bash
npm run lint
npx tsc --noEmit
npm test
```

Expected: lint clean. Typecheck clean. Tests: known 8 failing in `tests/company360.test.ts` (pre-existing, not our concern); everything else green. Note this baseline so we know any new failures are ours.

- [ ] **Step 0.3: Boot dev server, confirm `/mobile` renders**

```bash
npm run dev
```

Open `http://localhost:3000/mobile` in Chrome DevTools mobile emulation (iPhone 14 Pro, 390×844). Sign in. Confirm the briefing card renders. Leave server running for the rest of the plan.

---

### Task 1: Extend `ActionBarBlock` and `MeetingBriefBlock` schemas

**Files:**
- Modify: `src/lib/types/chat-blocks.ts`

This task is pure type plumbing — no behavior changes. Existing call sites stay compatible because new fields are optional.

- [ ] **Step 1.1: Add `tertiary?` and `variant?` to `ActionBarBlock`**

Open `src/lib/types/chat-blocks.ts`. Replace the existing `ActionBarBlock` definition with:

```typescript
type ActionBarItem = { label: string; query: string; icon: string };

export type ActionBarBlock = {
  type: "action_bar";
  data: {
    primary: ActionBarItem;
    secondary: ActionBarItem[];
    tertiary?: ActionBarItem[];
    variant?: "default" | "destructive_primary";
  };
};
```

Note: `ActionBarItem` is a new local alias; export it if any existing code in the repo already destructures these objects (search first — `rg "primary: \{ label" src/` to confirm no inline duplication needs updating).

- [ ] **Step 1.2: Add `firstAttendeeName?` to `MeetingBriefBlock`**

Find the `MeetingBriefBlock` definition. Replace `data` with:

```typescript
export type MeetingBriefBlock = {
  type: "meeting_brief";
  data: {
    meetingId: string;
    meetingTitle: string;
    synthesis: string;
    fullBrief: string;
    temperature?: "COLD" | "COOL" | "WARM" | "HOT";
    firstAttendeeName?: string;
  };
};
```

- [ ] **Step 1.3: Verify type system is happy**

```bash
npx tsc --noEmit
```

Expected: PASS. No new errors. (Optional fields don't break existing emitters.)

- [ ] **Step 1.4: Commit**

```bash
git add src/lib/types/chat-blocks.ts
git commit -m "feat(mobile-cta): extend ActionBarBlock with tertiary and variant fields"
```

---

### Task 2: Server-side action bar builders (TDD)

**Files:**
- Create: `src/lib/services/mobile-action-bars.ts`
- Create: `tests/mobile-action-bars.test.ts`

Pure functions that classify actions into the new tier system. We TDD this because the classification logic is the contract between server and client — getting it wrong silently is the most likely source of bugs.

- [ ] **Step 2.1: Write the failing tests**

Create `tests/mobile-action-bars.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildEmailDraftActionBar,
  buildNudgeActionActionBar,
  buildMeetingBriefActionBar,
} from "@/lib/services/mobile-action-bars";

describe("buildEmailDraftActionBar", () => {
  it("primary is Send Email, secondary is Edit, tertiary has Warmer/Shorter/Copy", () => {
    const bar = buildEmailDraftActionBar({
      contactName: "Ted Sarandos",
    });
    expect(bar.primary.label).toBe("Send Email");
    expect(bar.primary.icon).toBe("send");
    expect(bar.secondary.map((s) => s.label)).toEqual(["Edit"]);
    expect(bar.secondary[0]?.query).toBe("__edit_email__");
    expect(bar.tertiary?.map((t) => t.label)).toEqual(["Warmer", "Shorter", "Copy"]);
    expect(bar.variant).toBe("default");
  });

  it("Send Email query mentions the contact name", () => {
    const bar = buildEmailDraftActionBar({ contactName: "Ted Sarandos" });
    expect(bar.primary.query).toContain("Ted Sarandos");
  });
});

describe("buildNudgeActionActionBar", () => {
  it("includes Dismiss and Snooze in tertiary", () => {
    const bar = buildNudgeActionActionBar({ contactName: "Ted Sarandos" });
    const tertiaryLabels = bar.tertiary?.map((t) => t.label) ?? [];
    expect(tertiaryLabels).toContain("Dismiss");
    expect(tertiaryLabels).toContain("Snooze");
    expect(tertiaryLabels).toContain("Warmer");
  });

  it("primary is Send Email, secondary is Edit", () => {
    const bar = buildNudgeActionActionBar({ contactName: "Ted Sarandos" });
    expect(bar.primary.label).toBe("Send Email");
    expect(bar.secondary[0]?.label).toBe("Edit");
  });
});

describe("buildMeetingBriefActionBar", () => {
  it("collapsed: primary=View full brief, secondary=Draft Email", () => {
    const bar = buildMeetingBriefActionBar({
      expanded: false,
      firstAttendeeName: "Ted Sarandos",
    });
    expect(bar.primary.label).toBe("View full brief");
    expect(bar.secondary[0]?.label).toBe("Draft Email");
  });

  it("expanded: primary=Draft Email, secondary=Hide full brief", () => {
    const bar = buildMeetingBriefActionBar({
      expanded: true,
      firstAttendeeName: "Ted Sarandos",
    });
    expect(bar.primary.label).toBe("Draft Email");
    expect(bar.secondary[0]?.label).toBe("Hide full brief");
  });

  it("Draft Email query targets the first attendee", () => {
    const bar = buildMeetingBriefActionBar({
      expanded: false,
      firstAttendeeName: "Ted Sarandos",
    });
    expect(bar.secondary[0]?.query).toContain("Ted Sarandos");
  });

  it("no firstAttendeeName: omits Draft Email secondary", () => {
    const bar = buildMeetingBriefActionBar({ expanded: false });
    expect(bar.secondary).toEqual([]);
  });
});
```

- [ ] **Step 2.2: Run tests — expect them to fail**

```bash
npm test -- tests/mobile-action-bars.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/services/mobile-action-bars'". Good.

- [ ] **Step 2.3: Implement the helpers**

Create `src/lib/services/mobile-action-bars.ts`:

```typescript
import type { ActionBarBlock } from "@/lib/types/chat-blocks";

type Bar = ActionBarBlock["data"];

export function buildEmailDraftActionBar(args: {
  contactName: string;
}): Bar {
  return {
    primary: {
      label: "Send Email",
      query: `Send the drafted email to ${args.contactName}.`,
      icon: "send",
    },
    secondary: [
      { label: "Edit", query: "__edit_email__", icon: "file" },
    ],
    tertiary: [
      { label: "Warmer", query: `Make the email to ${args.contactName} warmer.`, icon: "sparkles" },
      { label: "Shorter", query: `Make the email to ${args.contactName} shorter.`, icon: "scissors" },
      { label: "Copy", query: "__copy_email__", icon: "copy" },
    ],
    variant: "default",
  };
}

export function buildNudgeActionActionBar(args: {
  contactName: string;
}): Bar {
  const base = buildEmailDraftActionBar({ contactName: args.contactName });
  return {
    ...base,
    tertiary: [
      ...(base.tertiary ?? []),
      {
        label: "Dismiss",
        query: `Dismiss the nudge for ${args.contactName}.`,
        icon: "trash",
      },
      {
        label: "Snooze",
        query: `Snooze the nudge for ${args.contactName}.`,
        icon: "bell-off",
      },
    ],
  };
}

export function buildMeetingBriefActionBar(args: {
  expanded: boolean;
  firstAttendeeName?: string;
}): Bar {
  const draftEmail = args.firstAttendeeName
    ? {
        label: "Draft Email",
        query: `Draft an email to ${args.firstAttendeeName}.`,
        icon: "mail",
      }
    : null;

  if (args.expanded) {
    return {
      primary: draftEmail ?? {
        label: "Draft Email",
        query: "Draft a follow-up email for this meeting.",
        icon: "mail",
      },
      secondary: [
        { label: "Hide full brief", query: "__toggle_brief__", icon: "chevron-up" },
      ],
      variant: "default",
    };
  }

  return {
    primary: {
      label: "View full brief",
      query: "__toggle_brief__",
      icon: "chevron-down",
    },
    secondary: draftEmail ? [draftEmail] : [],
    variant: "default",
  };
}
```

- [ ] **Step 2.4: Run tests — expect them to pass**

```bash
npm test -- tests/mobile-action-bars.test.ts
```

Expected: PASS, all 8 tests green.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/services/mobile-action-bars.ts tests/mobile-action-bars.test.ts
git commit -m "feat(mobile-cta): add server-side action bar tier classifiers"
```

---

### Task 3: Refactor `ActionBar` component to render three tiers

**Files:**
- Modify: `src/components/chat/blocks/action-bar.tsx`

Apply the new visual spec from the design doc. Render primary, secondary, and tertiary in two visual rows with backward compat for blocks lacking `tertiary`.

- [ ] **Step 3.1: Replace the entire `ActionBar` component**

Replace the contents of `src/components/chat/blocks/action-bar.tsx` with:

```typescript
"use client";

import { useState } from "react";
import {
  Mail, Reply, Forward, CalendarDays, Briefcase, Search,
  Share2, Copy, Send, User, ChevronRight, FileText, Check,
  Sparkles, Scissors, Trash2, BellOff, ChevronDown, ChevronUp,
} from "lucide-react";
import type { ActionBarBlock, EmailPreviewBlock } from "@/lib/types/chat-blocks";
import type { SendMessageFn } from "@/hooks/use-chat-session";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: Mail,
  reply: Reply,
  forward: Forward,
  calendar: CalendarDays,
  briefcase: Briefcase,
  search: Search,
  share: Share2,
  copy: Copy,
  send: Send,
  user: User,
  file: FileText,
  sparkles: Sparkles,
  scissors: Scissors,
  trash: Trash2,
  "bell-off": BellOff,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
};

function resolveIcon(name: string) {
  return ICON_MAP[name] ?? ChevronRight;
}

const SENTINEL_COPY = "__copy_email__";
const SENTINEL_EDIT = "__edit_email__";

function vibratePrimary() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

export function ActionBar({
  data,
  emailData,
  onSendMessage,
  onEditEmail,
  pulsePrimary = false,
}: {
  data: ActionBarBlock["data"];
  emailData?: EmailPreviewBlock["data"];
  onSendMessage?: SendMessageFn;
  onEditEmail?: () => void;
  pulsePrimary?: boolean;
  embedded?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const PrimaryIcon = resolveIcon(data.primary.icon);
  const showPrimary = Boolean(data.primary.query) && Boolean(onSendMessage);

  const secondaryItem = data.secondary[0];
  const showSecondary = Boolean(secondaryItem?.query);

  const tertiary = data.tertiary ?? data.secondary.slice(1);
  const isDestructive = data.variant === "destructive_primary";

  function handleCopyEmail() {
    if (!emailData) return;
    navigator.clipboard.writeText(`Subject: ${emailData.subject}\n\n${emailData.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function dispatch(query: string) {
    if (query === SENTINEL_COPY) {
      handleCopyEmail();
      return;
    }
    if (query === SENTINEL_EDIT) {
      onEditEmail?.();
      return;
    }
    if (!onSendMessage) return;
    const isSendAction = /^send\b/i.test(query) || query === data.primary.query && /^send\b/i.test(data.primary.label);
    if (isSendAction && emailData) {
      onSendMessage(query, { currentSubject: emailData.subject, currentBody: emailData.body });
    } else {
      onSendMessage(query);
    }
  }

  function handlePrimary() {
    vibratePrimary();
    dispatch(data.primary.query);
  }

  const primaryClass = isDestructive
    ? "relative inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 text-white px-4 text-sm font-semibold min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-red-800"
    : "relative inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white px-4 text-sm font-semibold min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-blue-800";

  const secondaryClass =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600/60 bg-transparent px-4 text-sm font-medium text-blue-600 min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-blue-50 dark:active:bg-blue-950";

  const tertiaryClass =
    "inline-flex items-center gap-1.5 rounded-md bg-transparent px-2 py-1.5 text-xs font-medium text-muted-foreground min-h-[32px] motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-muted/60";

  return (
    <div data-cta-row className="space-y-2">
      <div className="flex items-stretch gap-2">
        {showPrimary && (
          <button
            type="button"
            onClick={handlePrimary}
            className={primaryClass}
            aria-label={data.primary.label}
          >
            <PrimaryIcon className="h-4 w-4" />
            <span>{data.primary.label}</span>
            {pulsePrimary && (
              <span
                aria-hidden="true"
                className="motion-safe:animate-ping pointer-events-none absolute inset-0 rounded-lg ring-2 ring-blue-400 opacity-60"
              />
            )}
          </button>
        )}
        {showSecondary && (
          <button
            type="button"
            onClick={() => dispatch(secondaryItem!.query)}
            className={secondaryClass}
            aria-label={secondaryItem!.label}
          >
            {(() => {
              const Icon = resolveIcon(secondaryItem!.icon);
              return <Icon className="h-4 w-4" />;
            })()}
            <span>{secondaryItem!.label}</span>
          </button>
        )}
      </div>

      {tertiary.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
          {tertiary.map((action, i) => {
            const Icon = resolveIcon(action.icon);
            const isCopy = action.query === SENTINEL_COPY;
            const isDismiss = action.label.toLowerCase() === "dismiss";
            const cls = isDismiss
              ? `${tertiaryClass} text-red-600/70`
              : tertiaryClass;
            return (
              <button
                key={i}
                type="button"
                onClick={() => dispatch(action.query)}
                className={cls}
                aria-label={action.label}
              >
                {isCopy && copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span>{isCopy && copied ? "Copied!" : action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

Notes:
- The old `embedded` prop is preserved on the type for backward compat but is now visually a no-op (the new spec drives all visuals).
- `onEditEmail` is a new optional callback the cluster components will pass to handle the `__edit_email__` sentinel.
- `pulsePrimary` is the post-edit pulse trigger.

- [ ] **Step 3.2: Verify typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: PASS. (Other call sites still pass `embedded` — fine.)

- [ ] **Step 3.3: Manual smoke**

Refresh `/mobile`. Trigger an existing flow that emits an `action_bar` (e.g., ask "Show me my top nudges"). Verify the action row renders, primary is blue-filled, secondary actions render as outlined or in tertiary row depending on whether server has been updated yet (will look mixed until Task 5).

- [ ] **Step 3.4: Commit**

```bash
git add src/components/chat/blocks/action-bar.tsx
git commit -m "feat(mobile-cta): refactor ActionBar to three-tier visual spec"
```

---

### Task 4: Confirmation card visual refresh

**Files:**
- Modify: `src/components/chat/blocks/confirmation-card.tsx`

- [ ] **Step 4.1: Replace the action row in `ConfirmationCard`**

Replace the existing button row with one that follows the new primary/secondary spec, plus a destructive variant for `dismiss_nudge`. Open `src/components/chat/blocks/confirmation-card.tsx`. Replace the entire footer `<div>` (the `flex items-center gap-2 px-4 py-3 …` block):

```tsx
{(() => {
  const isDestructive = data.action.type === "dismiss_nudge";
  const primaryClass = isDestructive
    ? "relative inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 text-white px-4 text-sm font-semibold min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-red-800"
    : "relative inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white px-4 text-sm font-semibold min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-blue-800";
  const secondaryClass =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600/60 bg-transparent px-4 text-sm font-medium text-blue-600 min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-blue-50 dark:active:bg-blue-950";
  return (
    <div className="flex items-stretch gap-2 px-4 py-3 border-t border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate(isDestructive ? [20, 40, 20] : 10);
          }
          onConfirm?.(data.action);
        }}
        className={primaryClass}
        aria-label={data.confirmLabel}
      >
        <Icon className="h-4 w-4" />
        <span>{data.confirmLabel}</span>
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={secondaryClass}
        aria-label={data.cancelLabel}
      >
        <XCircle className="h-4 w-4" />
        <span>{data.cancelLabel}</span>
      </button>
    </div>
  );
})()}
```

Also update the description line above to apply `line-clamp-1` on mobile while preserving the full text in `title`:

```tsx
<p
  className="mt-1 text-xs text-muted-foreground whitespace-pre-line line-clamp-2"
  title={stripMarkdownToPlainText(data.description)}
>
  {stripMarkdownToPlainText(data.description)}
</p>
```

(`line-clamp-2` is forgiving enough that it doesn't aggressively truncate single-line descriptions.)

- [ ] **Step 4.2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4.3: Manual smoke**

Trigger a confirmation: ask "Dismiss the nudge for [contact]" → confirmation card should appear with a **red filled** primary button and outlined `Cancel`. Trigger send: confirmation card should have a **blue filled** primary button.

- [ ] **Step 4.4: Commit**

```bash
git add src/components/chat/blocks/confirmation-card.tsx
git commit -m "feat(mobile-cta): apply three-tier spec to confirmation card"
```

---

### Task 5: Wire server emitters to use new tier classifiers

**Files:**
- Modify: `src/app/api/chat/route.ts`

Audit every place `route.ts` constructs an `action_bar` block and replace it with calls to `buildEmailDraftActionBar` / `buildNudgeActionActionBar`. The meeting brief flow keeps its CTA on the client (Task 7) — server doesn't emit an action_bar for meeting briefs.

- [ ] **Step 5.1: Identify all action_bar emitters**

```bash
rg "type: \"action_bar\"" src/app/api/chat/route.ts -n
```

Each match is a candidate. Cross-reference each with the surrounding intent (email draft? nudge? confirmation? generic search-result quick-replies?) to decide which builder applies.

- [ ] **Step 5.2: Add imports at top of `route.ts`**

```typescript
import {
  buildEmailDraftActionBar,
  buildNudgeActionActionBar,
} from "@/lib/services/mobile-action-bars";
```

- [ ] **Step 5.3: Replace email-draft action bars**

For each path where the assistant just emitted an `editable_email_draft` (or `email_preview` in the priority-contact draft flow) for a single contact, replace the inline `{ type: "action_bar", data: { primary: {...}, secondary: [...] } }` literal with:

```typescript
{
  type: "action_bar" as const,
  data: buildEmailDraftActionBar({ contactName }),
}
```

`contactName` is whatever local variable holds the contact's display name in that scope.

- [ ] **Step 5.4: Replace nudge-action action bars**

For paths that emitted a `contact_card → strategic_insight → editable_email_draft` cluster (the nudge approval flow), use `buildNudgeActionActionBar` instead so `Dismiss` and `Snooze` join the tertiary row.

- [ ] **Step 5.5: Leave generic/non-flow action bars alone**

If there are other action_bar emitters that are NOT one of the three flows (e.g., a generic "search again" action_bar), leave them untouched. The new `ActionBar` component handles missing `tertiary` gracefully.

- [ ] **Step 5.6: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5.7: Run all unit tests**

```bash
npm test
```

Expected: same baseline as Step 0.2 — no new failures from our changes.

- [ ] **Step 5.8: Manual smoke through three flows**

Refresh `/mobile`. For each:

1. **Priority-contact draft email** — tap the "View draft email" pill on a priority contact card. Verify: `Send Email` (blue filled) + `Edit` (blue outline) on top row, `Warmer / Shorter / Copy` in tertiary row. No `Dismiss` or `Snooze`.
2. **Nudge approval** — ask "Show me my top nudges" → tap a nudge. Verify: same primary/secondary, plus `Dismiss` (muted red) and `Snooze` in tertiary row.
3. **Meeting brief** — ask to "prep me for [meeting]". For now, only the synthesis card renders (no action bar yet — Task 7 adds that).

- [ ] **Step 5.9: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(mobile-cta): emit tertiary actions for email and nudge flows"
```

---

### Task 6: Editable email draft — Show more + post-edit pulse

**Files:**
- Modify: `src/components/chat/blocks/editable-email-draft.tsx`
- Modify: `src/components/chat/blocks/block-renderer.tsx`

Add `Show more` truncation (10 lines), wire an `onEditEmail` upward so the cluster's `ActionBar` can open the composer via the `__edit_email__` sentinel, and surface a `pulsePrimary` flag for 2 seconds after the composer Save.

- [ ] **Step 6.1: Add `Show more` to `EditableEmailDraft`**

In `src/components/chat/blocks/editable-email-draft.tsx`, add to the imports and state:

```typescript
import { useState } from "react";
import { Pencil, Sparkles, Mic, Loader2, ChevronDown, ChevronUp } from "lucide-react";
```

Add a state hook near the existing ones:

```typescript
const [showFull, setShowFull] = useState(false);
```

Replace the body rendering block (the `<div className="border-t border-border/40 pt-2.5">…</div>` containing `{body}`) with:

```tsx
<div className="border-t border-border/40 pt-2.5">
  <div
    className={`text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap ${
      showFull ? "" : "line-clamp-[10]"
    }`}
  >
    {body}
  </div>
  {body.split("\n").length > 10 && (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setShowFull((v) => !v);
      }}
      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 motion-safe:active:scale-[0.97]"
      aria-label={showFull ? "Show less" : "Show more"}
    >
      {showFull ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {showFull ? "Show less" : "Show more"}
    </button>
  )}
</div>
```

The `e.stopPropagation()` is critical — otherwise a tap on Show more would also trigger the parent `role="button"` that opens the composer.

- [ ] **Step 6.2: Add a callback prop to expose the open-composer trigger**

Add a new optional prop to `EditableEmailDraft`:

```typescript
type Props = {
  data: EditableEmailDraftBlock["data"];
  embedded?: boolean;
  onSendMessage?: (message: string) => void;
  onBodyChange?: (body: string) => void;
  onSubjectChange?: (subject: string) => void;
  onVoiceEdit?: () => void;
  voiceEditing?: boolean;
  onOpenComposer?: () => void;     // NEW
  onAfterSave?: () => void;         // NEW — fires after composer Save closes
};
```

In the component, accept the new props and call them:

```typescript
function openComposer() {
  setEditing(true);
  onOpenComposer?.();
}

function handleSave(next: { subject: string; body: string }) {
  setSubject(next.subject);
  setBody(next.body);
  onSubjectChange?.(next.subject);
  onBodyChange?.(next.body);
  setEditing(false);
  onAfterSave?.();
}
```

- [ ] **Step 6.3: Lift the pulse state into the cluster components**

In `src/components/chat/blocks/block-renderer.tsx`, find both `NudgeActionCluster` and `EmailDraftCluster`. Add a pulse state hook to each:

```typescript
const [pulse, setPulse] = useState(false);
function flashPulse() {
  setPulse(true);
  setTimeout(() => setPulse(false), 2000);
}
```

Pass `onAfterSave={flashPulse}` to `EditableEmailDraft`, and pass `pulsePrimary={pulse}` to `ActionBar`. Also pass `onEditEmail={() => /* trigger composer */}` — but the composer is owned by `EditableEmailDraft`, so the cleanest wiring is a ref pattern:

The simplest approach: hoist `editing` state to the cluster. Replace the cluster bodies' render of `<EditableEmailDraft>` to also pass `editingControlled` and `onEditingChange` props, then thread `onEditEmail={() => setEditing(true)}` to the `ActionBar`. To minimize diff, instead use this pragmatic wiring:

```typescript
const [composerOpen, setComposerOpen] = useState(false);
// pass composerOpen as `editingControlled` to EditableEmailDraft? — keep simple:
// just expose a global event via ref
```

Pragmatic resolution: add `editingControlled?: boolean` and `onEditingChange?: (v: boolean) => void` props to `EditableEmailDraft`. When provided, use them in place of internal `editing` state. In each cluster:

```typescript
const [composerOpen, setComposerOpen] = useState(false);
const [pulse, setPulse] = useState(false);

// in the JSX:
<EditableEmailDraft
  data={emailBlock.data}
  embedded
  onSendMessage={onSendMessage}
  onBodyChange={setBody}
  onSubjectChange={setSubject}
  editingControlled={composerOpen}
  onEditingChange={setComposerOpen}
  onAfterSave={() => { setPulse(true); setTimeout(() => setPulse(false), 2000); }}
/>
```

And in the footer:

```tsx
footer={action ? (
  <ActionBar
    data={action.data}
    emailData={emailData}
    onSendMessage={onSendMessage}
    onEditEmail={() => setComposerOpen(true)}
    pulsePrimary={pulse}
  />
) : undefined}
```

In `EditableEmailDraft`, replace `useState(false)` for `editing` with:

```typescript
const [editingInternal, setEditingInternal] = useState(false);
const editing = props.editingControlled ?? editingInternal;
const setEditing = (v: boolean) => {
  if (props.editingControlled !== undefined) {
    props.onEditingChange?.(v);
  } else {
    setEditingInternal(v);
  }
};
```

(Adjust the function signatures since the existing code already destructures props at the top — you may need to refactor to `function EditableEmailDraft(props: Props)` and destructure inside, or add `editingControlled` / `onEditingChange` to the destructure.)

If the `Edit` label-relabel rule applies (Task 6.4), prefer hoisting fully via the controlled pattern.

- [ ] **Step 6.4: Relabel `Edit` to `Edit again` after first save**

In each cluster, track whether `onAfterSave` has fired at least once:

```typescript
const [hasEdited, setHasEdited] = useState(false);
// in onAfterSave: setHasEdited(true);
```

Override the secondary label in the action bar data passed to `ActionBar`:

```typescript
const actionData = action ? {
  ...action.data,
  secondary: action.data.secondary.map((s, i) =>
    i === 0 && hasEdited && s.query === "__edit_email__"
      ? { ...s, label: "Edit again" }
      : s
  ),
} : undefined;
```

Pass `data={actionData!}` instead of `data={action.data}`.

- [ ] **Step 6.5: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: PASS.

- [ ] **Step 6.6: Manual smoke**

Trigger a draft email. Tap `Edit` button on the action bar (NOT the card body) — composer should open. Edit, save → composer closes, `Send Email` pulses for 2 seconds, `Edit` relabels to `Edit again`. Tap `Edit again` → composer opens with the latest content. Verify the card-body tap still works as a secondary affordance.

If body > 10 lines: `Show more` link appears below the body. Tap it — body expands. Tap `Show less` — body collapses.

- [ ] **Step 6.7: Commit**

```bash
git add src/components/chat/blocks/editable-email-draft.tsx src/components/chat/blocks/block-renderer.tsx
git commit -m "feat(mobile-cta): add Show more, controlled composer, post-edit pulse"
```

---

### Task 7: Meeting brief CTA flip

**Files:**
- Modify: `src/components/chat/blocks/meeting-brief.tsx`
- Modify: `src/app/api/chat/route.ts` (populate `firstAttendeeName`)

Replace the standalone toggle button with a full action bar whose primary/secondary swap based on expand state.

- [ ] **Step 7.1: Pass `firstAttendeeName` in the meeting brief block emitter**

In `src/app/api/chat/route.ts`, find the `meeting_brief` emitter (added earlier in this branch's work). Where you construct the `data` object, add:

```typescript
firstAttendeeName: attendees?.[0]?.name,  // or whatever variable holds attendees in scope
```

If no attendees are available in scope, leave it undefined — the brief still works, just without the `Draft Email` secondary.

- [ ] **Step 7.2: Replace the toggle button with an `ActionBar`**

In `src/components/chat/blocks/meeting-brief.tsx`, replace the entire `<button>` block (lines 55–72) with:

```tsx
<div className="mt-3">
  <ActionBar
    data={buildMeetingBriefActionBar({
      expanded,
      firstAttendeeName: data.firstAttendeeName,
    })}
    onSendMessage={(query) => {
      if (query === "__toggle_brief__") {
        setExpanded((v) => !v);
        return;
      }
      onSendMessage?.(query);
    }}
  />
</div>
```

Add props for `onSendMessage`:

```typescript
export function MeetingBrief({
  data,
  embedded = false,
  onSendMessage,
}: {
  data: MeetingBriefBlock["data"];
  embedded?: boolean;
  onSendMessage?: SendMessageFn;
}) {
```

Add imports at the top:

```typescript
import { ActionBar } from "./action-bar";
import { buildMeetingBriefActionBar } from "@/lib/services/mobile-action-bars";
import type { SendMessageFn } from "@/hooks/use-chat-session";
```

Remove the now-unused `ChevronDown`, `ChevronUp` imports if they are not referenced elsewhere in the file.

- [ ] **Step 7.3: Pass `onSendMessage` from `BlockRenderer` to `MeetingBrief`**

In `src/components/chat/blocks/block-renderer.tsx`, find every `<MeetingBrief …>` render and add `onSendMessage={onSendMessage}`. (Both the standalone fallback case and any cluster case if applicable.)

- [ ] **Step 7.4: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: PASS.

- [ ] **Step 7.5: Manual smoke**

Ask the assistant to prep you for a meeting. Verify the brief renders with **synthesis only** plus an action row showing `View full brief` (primary, blue filled) and `Draft Email` (secondary, blue outlined). Tap `View full brief` — full brief expands; primary now reads `Draft Email` (blue filled), secondary reads `Hide full brief`. Tap `Hide full brief` — collapses. Tap `Draft Email` (in either state) — should kick off a new chat turn drafting the email to the first attendee.

- [ ] **Step 7.6: Commit**

```bash
git add src/components/chat/blocks/meeting-brief.tsx src/components/chat/blocks/block-renderer.tsx src/app/api/chat/route.ts
git commit -m "feat(mobile-cta): meeting brief uses ActionBar with primary CTA flip"
```

---

### Task 8: Composer modal polish — focus return, keyboard awareness

**Files:**
- Modify: `src/components/chat/blocks/email-composer-modal.tsx`

- [ ] **Step 8.1: Add `returnFocusToId` prop and visualViewport tracking**

In `email-composer-modal.tsx`, add a new optional prop to support focus return:

```typescript
type Props = {
  open: boolean;
  to: string;
  initialSubject: string;
  initialBody: string;
  onClose: () => void;
  onSave: (next: { subject: string; body: string }) => void;
  returnFocusSelector?: string;  // NEW — CSS selector for the element to refocus after save
};
```

Inside the component, after a save call, before invoking `onSave`, capture and queue the refocus:

```typescript
function handleSave() {
  onSave({ subject, body });
  if (props.returnFocusSelector) {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(props.returnFocusSelector!);
      el?.focus();
    });
  }
}
```

- [ ] **Step 8.2: Track visualViewport for keyboard-aware textarea height**

Add a state + effect:

```typescript
const [keyboardOffset, setKeyboardOffset] = useState(0);
useEffect(() => {
  if (!open) return;
  const vv = (window as Window & { visualViewport?: VisualViewport }).visualViewport;
  if (!vv) return;
  const onResize = () => {
    const offset = window.innerHeight - vv.height - vv.offsetTop;
    setKeyboardOffset(Math.max(0, offset));
  };
  vv.addEventListener("resize", onResize);
  vv.addEventListener("scroll", onResize);
  onResize();
  return () => {
    vv.removeEventListener("resize", onResize);
    vv.removeEventListener("scroll", onResize);
  };
}, [open]);
```

Apply `paddingBottom: keyboardOffset` to the textarea's container so it's never under the keyboard.

- [ ] **Step 8.3: Wire callers to pass `returnFocusSelector`**

We don't know the exact ID of the Send button per cluster. Simplest approach: tag the primary Send button in `ActionBar` with a stable `data-` attribute, and have the cluster pass a selector that matches it.

In `ActionBar`'s primary button, add: `data-cta-primary` to the button's attributes.

Then in `block-renderer.tsx`, when wiring the composer (via `EditableEmailDraft → EmailComposerModal`), pass `returnFocusSelector="[data-cta-primary]"` — but this would refocus the FIRST primary in the document, which is fine because we're scrolled to the latest message. (If multiple action bars are visible, the last in DOM order is normally what just rendered.)

For now, the simplest correct path: in `editable-email-draft.tsx`, when rendering `<EmailComposerModal>`, pass `returnFocusSelector="[data-cta-primary]"`.

- [ ] **Step 8.4: Add `font-size: 16px` rule to inputs (verify already present)**

Search the textarea and subject input class lists. If they don't have `text-base` (16px) or an inline `style={{ fontSize: 16 }}`, add it. iOS Safari zooms when an input has font-size < 16px.

- [ ] **Step 8.5: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: PASS.

- [ ] **Step 8.6: Manual smoke**

In Chrome DevTools mobile emulation, open a draft, tap `Edit`, tap inside the body textarea, save. Verify focus returns to the `Send Email` button (visible focus ring on `:focus-visible`, no ring after a tap). Also test on a real device if available — virtual keyboard should not cover the bottom of the textarea.

- [ ] **Step 8.7: Commit**

```bash
git add src/components/chat/blocks/email-composer-modal.tsx src/components/chat/blocks/action-bar.tsx src/components/chat/blocks/editable-email-draft.tsx
git commit -m "feat(mobile-cta): composer focus return + visualViewport keyboard tracking"
```

---

### Task 9: Auto-scroll retarget to CTA row

**Files:**
- Modify: `src/app/mobile/page.tsx`

Currently the chat feed scrolls so the last message bottom is at the viewport bottom. We want to scroll so the action bar (`[data-cta-row]`) is fully visible — its bottom edge sits above the input and quick-action tray.

- [ ] **Step 9.1: Locate the existing scroll effect**

```bash
rg "scrollIntoView|scrollRef" src/app/mobile/page.tsx
```

Find the `useEffect` that scrolls when `messages` changes.

- [ ] **Step 9.2: Update the scroll target selection logic**

After the messages mutate, prefer the latest CTA row if one exists in the most recent assistant message:

```typescript
useEffect(() => {
  // existing setup …
  // After paint, find the latest CTA row; fall back to scrollRef.
  requestAnimationFrame(() => {
    const ctaRows = document.querySelectorAll<HTMLElement>("[data-cta-row]");
    const latestCta = ctaRows[ctaRows.length - 1];
    if (latestCta) {
      latestCta.scrollIntoView({ block: "end", behavior: "smooth" });
    } else {
      scrollRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  });
}, [messages]);
```

Adjust to fit the existing effect's structure (this is illustrative, not a full replacement — read what's there first).

- [ ] **Step 9.3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 9.4: Manual smoke**

Trigger a long draft (ask for a draft to a contact, then ask "make it longer"). After the new message renders, the action bar should be visible at the bottom of the scroll area, not pushed off-screen by the long body.

- [ ] **Step 9.5: Commit**

```bash
git add src/app/mobile/page.tsx
git commit -m "feat(mobile-cta): auto-scroll prefers CTA row over message bottom"
```

---

### Task 10: Sticky bottom-sheet component (new)

**Files:**
- Create: `src/components/chat/sticky-bottom-sheet.tsx`

A small overlay that slides up from the bottom of the mobile frame and dismisses on backdrop tap or Escape.

- [ ] **Step 10.1: Create the component**

Create `src/components/chat/sticky-bottom-sheet.tsx`:

```tsx
"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
};

export function StickyBottomSheet({ open, onClose, children, ariaLabel }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 motion-safe:transition-opacity"
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-border bg-card shadow-lg motion-safe:animate-in motion-safe:slide-in-from-bottom-2"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="mx-auto mt-2 mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <div className="px-3 pb-3">{children}</div>
      </div>
    </div>
  );
}
```

Note: `absolute inset-0` (not `fixed`) so the sheet stays inside the mobile preview frame on desktop — same pattern the composer modal already uses.

- [ ] **Step 10.2: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: PASS. (No usage yet — just defined.)

- [ ] **Step 10.3: Commit**

```bash
git add src/components/chat/sticky-bottom-sheet.tsx
git commit -m "feat(mobile-cta): add StickyBottomSheet overlay component"
```

---

### Task 11: Sticky action bar (new) + mount in mobile page

**Files:**
- Create: `src/components/chat/sticky-action-bar.tsx`
- Modify: `src/app/mobile/page.tsx`

The third "always visible CTA" layer. Watches the latest `[data-cta-row]` in the thread; when it's not intersecting the viewport, slides a compact bar above the chat input.

- [ ] **Step 11.1: Create `StickyActionBar`**

Create `src/components/chat/sticky-action-bar.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { StickyBottomSheet } from "./sticky-bottom-sheet";

type StickyTarget = {
  label: string;
  primary?: { label: string; onClick: () => void };
  more?: { label: string; onClick: () => void }[];
};

export function StickyActionBar({
  enabled,
  target,
}: {
  enabled: boolean;
  target: StickyTarget | null;
}) {
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!enabled || !target) {
      setVisible(false);
      return;
    }

    const ctaRows = document.querySelectorAll<HTMLElement>("[data-cta-row]");
    const latest = ctaRows[ctaRows.length - 1];
    if (!latest) {
      setVisible(false);
      return;
    }

    observerRef.current?.disconnect();
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setVisible(!e.isIntersecting);
      },
      { threshold: 0.1, rootMargin: "0px 0px -64px 0px" }
    );
    obs.observe(latest);
    observerRef.current = obs;
    return () => obs.disconnect();
  }, [enabled, target]);

  if (!enabled || !target || !visible) return null;

  return (
    <>
      <div
        role="region"
        aria-live="polite"
        aria-label="Quick actions"
        className="absolute inset-x-0 bottom-0 z-30 motion-safe:transition-opacity motion-safe:animate-in motion-safe:fade-in"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 96px)" }}
      >
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-md">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {target.label}
          </span>
          {target.primary && (
            <button
              type="button"
              onClick={target.primary.onClick}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white motion-safe:active:scale-[0.97] active:bg-blue-800"
              aria-label={target.primary.label}
            >
              {target.primary.label}
            </button>
          )}
          {target.more && target.more.length > 0 && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="More actions"
              className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground motion-safe:active:scale-[0.97] active:bg-muted/60"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <StickyBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        ariaLabel="More actions"
      >
        <div className="flex flex-col gap-1">
          {target.more?.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSheetOpen(false);
                m.onClick();
              }}
              className="rounded-md px-3 py-3 text-left text-sm font-medium text-foreground motion-safe:active:scale-[0.99] active:bg-muted"
            >
              {m.label}
            </button>
          ))}
        </div>
      </StickyBottomSheet>
    </>
  );
}
```

- [ ] **Step 11.2: Mount `StickyActionBar` in `mobile/page.tsx`**

The bar needs the latest actionable card's primary CTA + tertiary actions. The cleanest path: walk the latest assistant message's blocks, pick the last `action_bar` block, build the `target` from its `primary` + `secondary[]` + `tertiary[]`.

In `src/app/mobile/page.tsx`, near the top of the component, derive the target:

```typescript
const stickyTarget = useMemo(() => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant" || !m.blocks) continue;
    const lastConfirmation = m.blocks.find((b) => b.type === "confirmation_card");
    if (lastConfirmation) return null;  // suppress when confirmation is pending
    const actionBars = m.blocks.filter((b) => b.type === "action_bar");
    const ab = actionBars[actionBars.length - 1];
    if (!ab) continue;
    return {
      label: m.blocks.find((b) => b.type === "contact_card")?.data.name
        ? `Draft to ${m.blocks.find((b) => b.type === "contact_card")?.data.name}`
        : ab.data.primary.label,
      primary: {
        label: ab.data.primary.label,
        onClick: () => sendMessage(ab.data.primary.query),
      },
      more: [
        ...ab.data.secondary.map((s) => ({
          label: s.label,
          onClick: () => sendMessage(s.query),
        })),
        ...(ab.data.tertiary ?? []).map((t) => ({
          label: t.label,
          onClick: () => sendMessage(t.query),
        })),
      ],
    };
  }
  return null;
}, [messages, sendMessage]);
```

Determine `enabled` based on suppression rules (Call Marvin overlay open? Input focused?):

```typescript
const [inputFocused, setInputFocused] = useState(false);
const stickyEnabled = !callMarvinOpen && !inputFocused;
```

Wire `setInputFocused` to the chat input's `onFocus` / `onBlur`. Then render the sticky bar:

```tsx
<StickyActionBar enabled={stickyEnabled} target={stickyTarget} />
```

Mount inside `MobileShell` so it inherits the `relative` positioning context.

- [ ] **Step 11.3: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: PASS. Resolve any TypeScript narrowing issues by adding type guards (e.g., `if (b.type === "contact_card") …`).

- [ ] **Step 11.4: Manual smoke**

Trigger a draft email. Scroll up so the in-card action row is no longer visible — the sticky bar should fade in at the bottom of the mobile frame, showing `Draft to [contact]` and a `Send Email` button. Tap `⋮` — bottom-sheet slides up with `Edit`, `Warmer`, `Shorter`, `Copy`. Tap any item — sheet closes, action fires.

Edge cases to verify:
- Focus the chat input — sticky bar disappears (input focus suppression).
- Open Call Marvin — sticky bar disappears.
- Trigger a confirmation (e.g., dismiss a nudge) — sticky bar disappears (confirmation suppression).
- Older actionable cards in scroll history — only the most recent one is tracked.

- [ ] **Step 11.5: Commit**

```bash
git add src/components/chat/sticky-action-bar.tsx src/app/mobile/page.tsx
git commit -m "feat(mobile-cta): add IntersectionObserver-driven sticky action bar"
```

---

### Task 12: Final polish + smoke + docs sync

- [ ] **Step 12.1: Motion-safe audit**

```bash
rg "active:scale|animate-" src/components/chat/blocks src/components/chat/sticky-action-bar.tsx src/components/chat/sticky-bottom-sheet.tsx
```

Every match should be prefixed with `motion-safe:` unless deliberately user-initiated and instant. Fix any stragglers.

- [ ] **Step 12.2: Run full lint, typecheck, tests**

```bash
npm run lint
npx tsc --noEmit
npm test
```

Expected: lint clean, typecheck clean, tests at baseline (8 pre-existing failures in `tests/company360.test.ts`, no new failures, plus the 8 new tests from Task 2 passing → 16 net passing in our touched areas).

- [ ] **Step 12.3: Five-minute smoke (the design's success criteria)**

In Chrome DevTools at iPhone 14 Pro:

1. Tap a "View draft email" pill on a priority contact → `Send Email` is unambiguously the largest button on the card.
2. With a draft body of 6 lines, all CTAs are reachable without scrolling.
3. With a draft body of 30 lines (ask "make it longer"), scroll up → sticky bar appears.
4. Tap `Edit` → composer opens → make a change → Save → composer closes, focus returns to `Send Email`, button pulses for ~2s.
5. Tap `Send Email` → confirmation card with `Confirm Send` (filled) + `Cancel` (outline). Tap `Confirm Send` → `✓ Email sent` appears.

If any step fails the user-visible promise from the spec, fix it now — don't defer.

- [ ] **Step 12.4: Push branch (NOT main)**

```bash
git push -u origin mobile-cta-hierarchy
```

(Only if running in a worktree or feature branch; the user will open a PR separately.)

- [ ] **Step 12.5: Final commit if any polish changes were made**

```bash
git status
git add -A
git commit -m "polish(mobile-cta): motion-safe audit and smoke fixes"
```

(Skip if there are no changes.)

---

## Self-review

**Spec coverage check:**

| Spec section | Implemented in |
|---|---|
| Three-tier hierarchy (button spec) | Task 3 |
| `tertiary` + `variant` schema | Task 1 |
| Server emitter classification | Tasks 2, 5 |
| Flow 1 — Email drafting CTAs | Tasks 5, 6 |
| Flow 1 — Show more inline expander | Task 6.1 |
| Flow 1 — Post-edit pulse | Tasks 3 (`pulsePrimary`), 6.3 |
| Flow 1 — Edit-again relabel | Task 6.4 |
| Flow 2 — Meeting brief CTA flip | Task 7 |
| Flow 3 — Nudge approval (Send + Edit primary/secondary, Dismiss/Snooze tertiary) | Tasks 5 (server), 3 (render) |
| Flow 3 — Destructive Dismiss accent | Task 3 (tertiary red text) |
| Layer 1 — Content truncation | Task 6.1 |
| Layer 2 — Auto-scroll to CTA row | Task 9 |
| Layer 3 — Sticky action bar | Tasks 10, 11 |
| Confirmation card visual refresh | Task 4 |
| Confirmation card destructive (red) primary | Task 4 |
| Composer modal — focus return on Save | Task 8.1 |
| Composer modal — visualViewport keyboard tracking | Task 8.2 |
| Composer modal — `Cancel` stays muted text (deliberate exception) | Untouched (already correct) |
| Haptics — primary tap (`vibrate(10)`) | Task 3 (`vibratePrimary`) |
| Haptics — destructive confirm (`vibrate([20, 40, 20])`) | Task 4 |
| Reduced motion (`motion-safe:`) | Tasks 3, 4, 6, 10, 11, 12 audit |
| iOS 16px font-size rule | Task 8.4 |
| Sticky bar suppression (Call Marvin) | Task 11.2 |
| Sticky bar suppression (input focus) | Task 11.2 |
| Sticky bar suppression (confirmation pending) | Task 11.2 |
| Sticky bottom-sheet `⋮` overflow | Tasks 10, 11 |
| Open question: `embedded` prop kept cosmetic | Task 3 (left as no-op param) |
| Open question: `__edit_email__` sentinel client-routed | Task 3 (`onEditEmail`), Task 6 (wiring) |
| Open question: server emitter audit | Task 5.1 |

All spec requirements have a task. No gaps.

**Placeholder scan:** No `TBD`, `TODO`, `add appropriate handling` etc. in any task body. Every code step shows the actual code.

**Type consistency check:**

- `ActionBarBlock.data` shape (Task 1): `{ primary, secondary[], tertiary?, variant? }` — used identically in Tasks 2, 3, 5, 7, 11.
- `ActionBarItem` alias: declared in Task 1, referenced in Task 2 implicitly via `ActionBarBlock["data"]`.
- `MeetingBriefBlock.data.firstAttendeeName?: string` (Task 1): consumed in Tasks 2 (test), 7 (component + emitter).
- `__edit_email__` sentinel: defined in Task 2, consumed in Task 3 (`SENTINEL_EDIT`).
- `__copy_email__` sentinel: pre-existing, preserved in Task 3.
- `__toggle_brief__` sentinel: defined in Task 2, consumed in Task 7.
- `data-cta-row` selector: emitted in Task 3 (`<div data-cta-row …>`), consumed in Tasks 9 + 11.
- `data-cta-primary` selector: emitted in Task 8.3 (added to primary `<button>` in `ActionBar`), consumed in Task 8 for focus return. **NOTE:** Task 3 doesn't add this attribute yet — Task 8.3 is the first place it's mentioned. Implementer must add `data-cta-primary` to the primary `<button>` in `ActionBar` as part of Task 8.3.
- `pulsePrimary`, `onEditEmail` props on `ActionBar`: added in Task 3, consumed in Task 6.3.
- `editingControlled`, `onEditingChange`, `onAfterSave`, `onOpenComposer` props on `EditableEmailDraft`: added in Task 6.2, consumed in Task 6.3.
- `returnFocusSelector` prop on `EmailComposerModal`: added in Task 8.1, passed in Task 8.3.

All names consistent.

**Ordering check:**

Tasks build incrementally and each is independently testable:
- After Task 3, the new visual hierarchy is visible on any block that already happens to have all-`secondary` rows (so existing flows look prettier even before server changes).
- After Task 5, the three flows render with correct tier classification.
- After Task 6, the email draft flow has all its UX polish.
- After Task 7, the meeting brief is complete.
- After Task 9, scroll behavior aligns.
- After Task 11, the sticky bar is live.

A bisection between Task 5 and Task 6 still produces a working app (just no Show more, no pulse — but everything else works).

---

## Execution Handoff

Plan complete and saved to `docs/designs/2026-04-24-mobile-cta-hierarchy-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

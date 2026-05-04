---
name: Nudge Summary Formatting Fix
overview: Fix the nudge AI Summary to display each signal as a separate line with complete sentences and conversational tone. Rename "AI Summary" to "Insights" everywhere. Add signal type labels to the chat nudge summary. Apply all improvements to the contact detail page as well.
todos:
  - id: split-signals
    content: Split primary signal sentences into separate topicLines in buildSummaryFragments
    status: completed
  - id: clean-snippets
    content: Improve cleanSnippet and stripMarkdown to remove duplicate headlines, stray markers, and fix truncation
    status: completed
  - id: sentence-audit
    content: Audit all signal render lambdas and appendSignalContext for complete sentences and proper punctuation
    status: completed
  - id: rename-label
    content: Rename 'AI Summary' to 'Insights' in all UI locations (dashboard, contact detail, nudges list)
    status: completed
  - id: chat-signal-labels
    content: Add signal type labels (Executive Transition, Company News, etc.) to the chat nudge summary via a SIGNAL_LABELS marker
    status: completed
  - id: verify-renderers
    content: Verify FragmentText, fragmentsToMarkdown, and AssistantReply produce correct output
    status: completed
isProject: false
---

# Nudge Summary Formatting Fix

## Problem

The nudge card AI Summary concatenates multiple signal sentences into a single dense paragraph. Scraped content leaks markdown artifacts (bold markers, duplicate headlines, dangling punctuation). The result is hard to scan and unprofessional. Additionally, the label "AI Summary" should be renamed to "Insights" across all pages, and the chat nudge summary should display signal type labels (Executive Transition, Company News, etc.) as pill badges.

## Scope

Three pages are affected by the formatting and rename changes:

- Dashboard nudge cards ([src/app/dashboard/page.tsx](src/app/dashboard/page.tsx))
- Contact detail page ([src/app/contacts/[id]/page.tsx](src/app/contacts/[id]/page.tsx))
- Nudges list page ([src/app/nudges/page.tsx](src/app/nudges/page.tsx))

The signal type labels are added only to the chat nudge summary (not the dashboard cards).

## Changes

### 1. Split primary signals into separate topicLines

**File**: [src/lib/utils/nudge-summary.ts](src/lib/utils/nudge-summary.ts), lines ~496-514

Currently, `primaryLine` collects 1-3 signal sentences and pushes them as a single array entry into `topicLines`:

```typescript
primaryLine.push(sc.render()); // up to 2 signals
// ...
if (stale) primaryLine.push(...);
if (primaryLine.length > 0) topicLines.push(primaryLine);
```

Change: push each signal sentence as its **own** topicLine instead of accumulating into one:

```typescript
for (const sc of signalCandidates) {
  if (signalsRendered >= maxPrimarySignals) break;
  topicLines.push([sc.render()]);
  renderedTypes.push(sc.type);
  signalsRendered++;
}
if (stale) {
  // ... same snippet logic, but push as own topicLine
  topicLines.push([`It's been ${snippet} since your last conversation.`]);
}
```

Each topicLine already gets its own `lineBreak` separator in `buildFragmentsFromTopicLines` (line 624). So this single change gives each signal its own paragraph/line with no further changes needed to the fragment builder.

### 2. Clean up snippet extraction

**File**: [src/lib/utils/nudge-summary.ts](src/lib/utils/nudge-summary.ts), `cleanSnippet` function (line 25-30) and `stripMarkdown` (line 4-22)

Issues visible in the screenshot:

- Duplicate headline text ("Why Alphabet Stock Popped Today - The Motley Fool -- Why Alphabet Stock Popped Today")
- Stray markdown list markers appearing as literal `*` characters
- Trailing `....` (four dots) instead of clean ellipsis

Fixes to `stripMarkdown`:

- Add a regex to strip source attributions like `" - The Motley Fool"`, `" | Reuters"` etc. (common scraped patterns): `s.replace(/ [-|] [A-Z][\w\s&,.']+$/gm, "")`
- Strip stray `*` or `-` that are not part of words: `.replace(/(?:^|\s)[*\-]\s/g, " ")`

Fixes to `cleanSnippet`:

- After stripping, deduplicate: if the cleaned text contains the same phrase twice (common from title + subtitle scraping), keep only the first occurrence.
- Ensure truncation uses a single unicode ellipsis (`\u2026`) and never leaves dangling punctuation before it.
- If the snippet ends at a natural sentence boundary (`.`, `!`, `?`), don't add ellipsis.

### 3. `FragmentText` component -- no changes needed

**File**: [src/components/ui/fragment-text.tsx](src/components/ui/fragment-text.tsx)

The component already groups fragments by `lineBreak` and renders each group as a `<p>` with `space-y-2` between them. Since the fix in step 1 gives each signal its own topicLine (which produces a `lineBreak` between them), `FragmentText` will automatically render them as separate paragraphs. Bold fragments already render as `<strong>`. No markdown is emitted. No changes needed here.

### 4. `fragmentsToMarkdown` in chat route

**File**: [src/app/api/chat/route.ts](src/app/api/chat/route.ts), `fragmentsToMarkdown` function (~line 920)

The current implementation already handles `lineBreak` as `\n\n` and bold as `**text`**. Since the fragments now have proper lineBreaks between signals (from step 1), the chat summary will automatically show each signal as a separate paragraph. No structural changes needed.

### 5. Sentence completeness audit

Audit all `render()` lambdas in `buildSummaryFragments` (the `signalCandidates` array, lines ~439-490) and all `appendSignalContext` sentences (lines ~561-614) to ensure:

- Every sentence ends with proper punctuation (period).
- No sentence starts with a lowercase letter.
- The CTA sentence ("This is a good moment...") is always a standalone paragraph (already is, via separate topicLine).

### 6. Rename "AI Summary" to "Insights"

Replace the label text `"AI Summary"` with `"Insights"` in all UI locations. The Sparkles icon stays; only the text changes. The `uppercase tracking-wider` CSS classes stay so it renders as `INSIGHTS`.

Locations (10 occurrences total):

- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) -- 4 occurrences (~lines 1387, 1456, 1520, 1568)
- [src/app/contacts/[id]/page.tsx](src/app/contacts/[id]/page.tsx) -- 1 occurrence (~line 2454)
- [src/app/nudges/page.tsx](src/app/nudges/page.tsx) -- 3 occurrences (~lines 483, 572, 654)

Email templates are **not** changed (different context, keep "AI Summary" there unless user requests).

### 7. Add signal type labels to chat nudge summary

**Goal**: When the chat shows a nudge summary (the `nudge_summary` intent), include the insight type labels (e.g., "Executive Transition", "Company News", "LinkedIn Activity", "Content Follow-Up") as pill badges below the summary text, matching the visual style from the contact detail page screenshot. These labels are added **only** to the chat nudge summary, **not** to the dashboard AI Summary cards.

**Implementation**:

**a) Chat API route** ([src/app/api/chat/route.ts](src/app/api/chat/route.ts), `isNudgeSummary` block ~line 404-468):

After building the summary sections, collect the unique insight types (same `seen` map logic as the contact detail page -- skip STALE_CONTACT, FOLLOW_UP, REPLY_NEEDED, CAMPAIGN_APPROVAL, ARTICLE_CAMPAIGN). Emit them as a new HTML comment marker before the QUICK_ACTIONS marker:

```typescript
const seenTypes: string[] = [];
for (const nudge of nudges) {
  const insights = JSON.parse(nudge.metadata ?? "{}").insights ?? [];
  for (const ins of insights) {
    if (["STALE_CONTACT", "FOLLOW_UP", "REPLY_NEEDED", "CAMPAIGN_APPROVAL", "ARTICLE_CAMPAIGN"].includes(ins.type)) continue;
    if (!seenTypes.includes(ins.type)) seenTypes.push(ins.type);
  }
}
if (seenTypes.length > 0) {
  sections.push(`<!--SIGNAL_LABELS:${JSON.stringify(seenTypes)}-->`);
}
```

**b) Shared label config** -- export the insight type label map from a shared location so the chat frontend can resolve `"JOB_CHANGE"` to `"Executive Transition"`. Add to [src/lib/utils/nudge-summary.ts](src/lib/utils/nudge-summary.ts):

```typescript
export const INSIGHT_TYPE_LABELS: Record<string, string> = {
  JOB_CHANGE: "Executive Transition",
  COMPANY_NEWS: "Company News",
  UPCOMING_EVENT: "Upcoming Event",
  MEETING_PREP: "Meeting Prep",
  EVENT_ATTENDED: "Event Follow-Up",
  EVENT_REGISTERED: "Event Outreach",
  ARTICLE_READ: "Content Follow-Up",
  LINKEDIN_ACTIVITY: "LinkedIn Activity",
};
```

**c) AssistantReply component** ([src/components/chat/assistant-reply.tsx](src/components/chat/assistant-reply.tsx)):

Add a `extractSignalLabels` function (same pattern as `extractQuickActions`):

```typescript
function extractSignalLabels(text: string): { cleanContent: string; labels: string[] } {
  const marker = /<!--SIGNAL_LABELS:([\s\S]*?)-->/;
  const match = text.match(marker);
  if (!match) return { cleanContent: text, labels: [] };
  try {
    const types: string[] = JSON.parse(match[1]);
    const cleanContent = text.replace(marker, "").replace(/\n{3,}/g, "\n\n").trim();
    return { cleanContent, labels: types.map(t => INSIGHT_TYPE_LABELS[t] ?? t) };
  } catch {
    return { cleanContent: text, labels: [] };
  }
}
```

Render the labels as pill badges (similar styling to the contact detail page) between the summary text and the quick actions row:

```tsx
{signalLabels.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {signalLabels.map((label) => (
      <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80">
        {label}
      </span>
    ))}
  </div>
)}
```

## Rendering result (before vs after)

**Dashboard / Contact / Nudges cards -- Before** (single dense paragraph, labeled "AI SUMMARY"):

> **AI SUMMARY**
> There's been an executive change at Google (Alphabet) -- **Sundar Pichai promoted to VP of AI & Data at Google (Alphabet)**. Google (Alphabet) is in the news: **Why Alphabet Stock Popped Today - The Motley Fool -- Why Alphabet Stock Popped Today. * Just days later, Alphabet cuts....** This is a good moment to reach out with a company update note.

**After** (each signal on its own line, labeled "INSIGHTS"):

> **INSIGHTS**
>
> There's been an executive change at Google (Alphabet) -- **Sundar Pichai promoted to VP of AI & Data at Google (Alphabet)**.
>
> Google (Alphabet) is in the news: **Why Alphabet Stock Popped Today**.
>
> This is a good moment to reach out with a company update note.

**Chat nudge summary -- After** (adds signal type labels):

> ## Why Reach Out: Anat Ashkenazi
>
> **SVP and CFO** at Google (Alphabet)
>
> There's been an executive change at Google (Alphabet) -- **Sundar Pichai promoted to VP of AI & Data**.
>
> Google (Alphabet) is in the news: **Why Alphabet Stock Popped Today**.
>
> This is a good moment to reach out with a company update note.
>
> `[Executive Transition]` `[Company News]`   *(pill badges)*
>
> `[Draft Email]` `[Quick 360]` `[Company 360]`   *(quick actions)*

## Files touched

- [src/lib/utils/nudge-summary.ts](src/lib/utils/nudge-summary.ts) -- split signals into separate topicLines, improve `cleanSnippet`/`stripMarkdown`, export `INSIGHT_TYPE_LABELS`
- [src/app/api/chat/route.ts](src/app/api/chat/route.ts) -- add `SIGNAL_LABELS` marker to nudge summary response
- [src/components/chat/assistant-reply.tsx](src/components/chat/assistant-reply.tsx) -- parse `SIGNAL_LABELS` marker and render pill badges
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) -- rename "AI Summary" to "Insights" (4 locations)
- [src/app/contacts/[id]/page.tsx](src/app/contacts/[id]/page.tsx) -- rename "AI Summary" to "Insights" (1 location)
- [src/app/nudges/page.tsx](src/app/nudges/page.tsx) -- rename "AI Summary" to "Insights" (3 locations)


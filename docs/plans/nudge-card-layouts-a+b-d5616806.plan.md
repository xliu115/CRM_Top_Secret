---
name: Nudge card layouts A+B
overview: Implement both Option A (action-led card) and Option B (action banner + compact contact row) as selectable layout variants on the nudges page, so you can compare them side by side in the browser.
todos:
  - id: layout-toggle
    content: Add cardLayout state and toggle UI to NudgesPage
    status: completed
  - id: card-a
    content: Implement NudgeCardA (action-led headline layout)
    status: completed
  - id: card-b
    content: Implement NudgeCardB (action banner + compact contact row layout)
    status: completed
  - id: lint-check
    content: Run lint check on the updated file
    status: completed
isProject: false
---

# Nudge Card Layouts A and B

## Approach

Add a layout toggle (A / B) to the nudges page header, next to the existing filter controls. Both layouts render from the same `NudgeCard` component by branching on a `cardLayout` state variable. This keeps the change self-contained in [src/app/nudges/page.tsx](src/app/nudges/page.tsx).

## Option A: Action-Led Card

- **Headline**: CTA label (e.g. "Draft Check-in") rendered as the card title in large bold text, with priority badge inline
- **Secondary**: Contact name, title, and company below the headline
- **Tertiary**: Conversational reason summary from `summarizeNudgeReason()`
- **Detail**: Existing insight list unchanged
- **CTA buttons**: Same as today, at the bottom

## Option B: Action Banner + Compact Contact Row

- **Banner**: Full-width colored strip at the top of the card with the CTA label (uppercase) and priority badge, using the nudge type's accent color as background
- **Contact row**: Compact inline row with avatar, name, title, and company
- **Tertiary**: Conversational reason summary
- **Detail**: Existing insight list unchanged
- **CTA buttons**: Same as today, at the bottom

## Layout Toggle

- A small segmented control ("Layout A" / "Layout B") in the page header area
- Stored in local component state (`cardLayout: "a" | "b"`)
- Default to layout A

## Files Changed

- [src/app/nudges/page.tsx](src/app/nudges/page.tsx) -- split `NudgeCard` into `NudgeCardA` and `NudgeCardB`, add layout toggle state and UI


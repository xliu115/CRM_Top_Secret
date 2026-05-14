# ClientIQ MDS Design System Rules

Use this document when translating Figma designs from the McKinsey-style MDS library into this repo.

## Source of Truth

- Figma design references should be treated as the visual source of truth.
- This repo is a Next.js App Router app with React, Tailwind v4, and shadcn-style primitives.
- Existing UI should stay consistent with the current structure unless the Figma design clearly introduces a new pattern.

## Current Repo Design Tokens

The current design system is defined in `src/app/globals.css` using CSS custom properties and Tailwind theme mapping.

### Core tokens

- Background: `#f8fafc`
- Foreground text: `#0f172a`
- Card background: `#ffffff`
- Primary: `#2563eb`
- Secondary / muted: `#f1f5f9`
- Border / input: `#e2e8f0`
- Destructive: `#ef4444`
- Radius: `0.5rem`
- Sidebar background: `#0f172a`
- Sidebar foreground: `#e2e8f0`

### Usage rule

- Reuse these tokens whenever possible.
- If a Figma design requires McKinsey-specific blue styling, map it to the existing system through the closest semantic token before introducing new values.

## Typography Rules

Typography is currently based on Geist from `src/app/layout.tsx`.

- Body font: `--font-geist-sans`
- Monospace font: `--font-geist-mono`
- No custom MDS fonts are installed yet.

### Figma-to-repo typography mapping

- Use the existing sans stack for body copy, labels, buttons, and data tables.
- Use a serif treatment only if the Figma design explicitly requires a McKinsey-style headline. In that case, prefer a local fallback pattern rather than introducing a new dependency unless the project owner approves it.
- Maintain strong hierarchy with size and weight, not decorative styling.

## Component Architecture

UI components live in `src/components/ui/` and follow a shadcn-style primitive composition model.

### Existing primitives

- `Button` in `src/components/ui/button.tsx`
- `Card` in `src/components/ui/card.tsx`
- `Badge`, `Input`, `Textarea`, `Tabs`, `Avatar`, `Skeleton`

### Composition rule

- Prefer composing from these primitives instead of creating one-off styles.
- Extend components with `className` only when a Figma variant cannot be expressed with existing props.
- Keep the visual API semantic: `primary`, `secondary`, `outline`, `ghost`, `destructive`.

## Layout System

The app uses `DashboardShell` in `src/components/layout/dashboard-shell.tsx` and `Sidebar` in `src/components/layout/sidebar.tsx`.

### Layout rules

- Use a fixed application shell for authenticated pages.
- Use `max-w-6xl px-6 py-8` as the default content wrapper pattern for main pages.
- Keep the left navigation persistent on desktop.
- Maintain the dark sidebar treatment for navigation and user controls.

### Figma translation rule

- When Figma shows a full-page dashboard or workspace, map it to the existing shell structure first.
- Use sections inside the content area rather than replacing the whole shell.

## MDS / McKinsey Visual Translation Rules

When implementing a Figma design inspired by McKinsey’s MDS language:

- Use deep blue as the primary brand color.
- Keep layouts clean, minimal, and grid-driven.
- Use generous whitespace and strong alignment.
- Prefer sharp edges or subtle rounding over playful curves.
- Use blue sparingly for emphasis, CTAs, and key metrics.
- Alternate light and dark sections only when the design uses explicit contrast hierarchy.
- Keep icons monochromatic and simple.

## Color Mapping Guidance

If the design calls for McKinsey-like colors, map them like this:

- Deep navy / brand dark -> `bg-slate-950` or `#0f172a`
- Primary blue -> `bg-blue-600`
- Vivid blue accent -> `#2251FF` only when needed for highlights
- Light section background -> `bg-slate-50`
- Borders -> `border-slate-200`

Do not introduce a large new palette unless the Figma design explicitly depends on it.

## Button Patterns

Use the existing `Button` component for all interactive actions.

### Preferred styles

- Primary CTA: filled blue, white text
- Secondary CTA: outline or neutral background
- Destructive action: red background or red outline

### MDS adaptation rule

- For McKinsey-style buttons, keep them rectangular, high-contrast, and restrained.
- Avoid overly rounded or overly playful button treatments.

## Card Patterns

Use `Card` for content containers, summaries, and metric blocks.

### Card rules

- Preserve the current rounded-xl container style unless the Figma design specifies a stricter geometric look.
- Use borders and subtle shadow rather than heavy elevation.
- Keep card padding consistent with existing spacing conventions.

## Data Display Patterns

For KPI tiles, summaries, and structured content:

- Use a bold numeric or headline stat.
- Keep supporting label text muted.
- Use a simple accent bar or accent text if the design calls for emphasis.

## Section Patterns

For long-form or marketing-style pages:

- Break content into clearly labeled sections.
- Use full-width color blocks only when the design requires contrast.
- Keep content width constrained for readability.
- Use headings, subheadings, bullets, and short supporting copy.

## Asset and Icon Rules

- Prefer existing Lucide icons.
- Keep icon usage minimal and consistent.
- If Figma references custom imagery, preserve aspect ratio and avoid decorative crops unless specified.

## Responsive Rules

- Desktop-first shell with responsive stacking on smaller viewports.
- Use the current Tailwind breakpoints and spacing scale already present in the app.
- Avoid introducing new responsive abstractions unless the design needs them.

## Implementation Checklist for Figma Designs

When translating a Figma node into this repo:

1. Identify which existing primitive matches the component best.
2. Map colors to existing tokens before adding new ones.
3. Match typography using the current font stack.
4. Reuse the dashboard shell and sidebar for app pages.
5. Add only the minimum new styling needed to match the design.
6. Keep the result consistent with the rest of the app.

## Do Not

- Do not introduce a new design language that conflicts with the existing shell.
- Do not add custom fonts without approval.
- Do not hardcode one-off colors if a semantic token already exists.
- Do not overuse shadows, gradients, or rounded corners.
- Do not recreate components that already exist in `src/components/ui/`.

## Useful File References

- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/layout/dashboard-shell.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`

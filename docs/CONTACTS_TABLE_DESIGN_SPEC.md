# Contacts Table Design Improvement Spec

**Version:** 1.0  
**Date:** March 18, 2025  
**Scope:** CRM contacts list for McKinsey partners (10–50 contacts)  
**Design system:** McKinsey aesthetics — electric blue #2251FF, Georgia/sans-serif, professional minimal

---

## Research Summary: Best Practices Applied

| Source | Key Guidelines |
|--------|----------------|
| **W3C ARIA APG** | `aria-sort` on sorted column; sortable headers as `<button>`; distinct icons for unsorted vs sorted; maximize click target |
| **IBM Carbon** | Sort icon on hover for unsorted columns; toolbar for search/filters; skeleton loading; row sizes (5 options); zebra stripes for scanability |
| **Material UI** | TableSortLabel pattern; sticky header option |
| **Algolia / LogRocket** | Faceted filters for exploration; inline filters for structured data; clear active filters; panel vs drawer for mobile |
| **Cloudscape (AWS)** | Match counter when filtered; preserve parent context when filtering nested data; display accurate selection counts |
| **Empty States** | Headline + subtext + primary CTA + visual; always provide action (e.g. "Clear filters"); distinguish initial vs zero-results |
| **Responsive** | Card view on mobile; sticky first column + horizontal scroll; prioritize 2–3 columns; `data-label` for accessibility |
| **McKinsey MDS** | Deep blue headings; electric blue for accents; Georgia for headings; 4px base spacing; generous whitespace |

---

## 1. Layout and Spacing Improvements

### 1.1 Page-Level Spacing

**Current state:**  
`space-y-5` (20px) between major sections; `space-y-3` (12px) between search and filter bar; dashboard shell `max-w-6xl px-6 py-8`.

**Best practice:** McKinsey MDS recommends 32–48px between content blocks and 64–96px between major sections. Enterprise tables benefit from consistent vertical rhythm and clear visual hierarchy.

**Changes:**
- Page container: Change `space-y-5` to `space-y-8` (32px) for vertical rhythm between: page header, search row, filter bar, table.
- Title/subtitle block: Add `mb-2` (8px) between h1 and subtitle if not present; ensure subtitle uses `text-muted-foreground text-sm` (14px).
- Search + filter row: Use `gap-4` (16px) between search input and filter button; maintain `flex-wrap` for small screens.

### 1.2 Table Container Spacing

**Current state:**  
`rounded-xl border border-border`; header `px-4 py-2.5`; row `px-4 py-3`; internal column `gap-4`.

**Best practice:** Carbon and Atlassian use 12–16px horizontal padding for table cells; row height of 40–48px for medium density.

**Changes:**
- Table border radius: Keep `rounded-xl` (12px) per McKinsey; ensure `overflow-hidden` is present.
- Header cell padding: Change `px-4 py-2.5` to `px-4 py-3` (12px vertical = 48px row height). Add `h-12` to header row for consistent height.
- Data row padding: Change `py-3` to `py-3.5` (14px) for 44px min row height. Keep `px-4` (16px).
- Column gap: Change `gap-4` to `gap-5` (20px) in header and rows to improve scanability; ensure `min-w-0` on text columns to prevent flex blowout.

### 1.3 Filter Panel Spacing

**Current state:**  
`gap-x-6 gap-y-3` when expanded; `px-4 py-3` on filter panel; filter options `gap-1.5`.

**Best practice:** Inline/facet filters should have clear grouping and consistent spacing between filter groups.

**Changes:**
- Filter panel: Change `px-4 py-3` to `px-5 py-4`; change `gap-x-6` to `gap-x-8` between filter groups.
- Filter label: Ensure `text-[11px] uppercase tracking-wider` with `mb-2` (8px) below label.
- Filter option chips: Use `gap-2` between tier/days/nudge chips.

---

## 2. Sort Indicator Design

### 2.1 Icon Size, Position, and Hierarchy

**Current state:**  
ChevronUp/ChevronDown/ChevronsUpDown at `h-3 w-3` (12px); icon inline with label using `gap-1` (4px); active column uses `text-[#2251FF]`; unsorted uses `opacity-40`.

**Best practice (W3C, Carbon):**  
- Use distinct shapes for unsorted vs sorted (e.g., double arrow vs single) so users can distinguish by shape, not just color.  
- Sort icon 14–16px; place icon to the right of label with 6–8px gap.  
- Only the sorted column shows direction; unsorted columns show neutral icon on hover.

**Changes:**
- Icon size: Change from `h-3 w-3` (12px) to `h-4 w-4` (16px).
- Icon–label gap: Change `gap-1` to `gap-1.5` (6px).
- Icon position: Keep icon after label (correct for LTR).
- Active (sorted): Use `ChevronUp` for ascending, `ChevronDown` for descending; `text-[#2251FF]`; icon `text-[#2251FF]` with no opacity reduction.
- Unsorted columns: Hide ChevronsUpDown by default; show on `group-hover` (add `group` to header row container and `group-hover:opacity-70` to unsorted icon). If group-hover is complex, alternatively show subtle icon always at `opacity-30` and `opacity-60` on hover.
- Ensure unsorted icon shape (ChevronsUpDown) is visually distinct from sorted (ChevronUp/Down) — current implementation is correct; increase size for consistency.

### 2.2 Sort Indicator Animation

**Current state:**  
No animation on sort state change.

**Best practice:**  
Subtle transition (150–200ms) on icon/color change improves perceived responsiveness.

**Changes:**
- Add `transition-colors duration-150` to SortableHeader button.
- Add `transition-transform duration-150` to chevron icons so they rotate smoothly when direction toggles (optional; icons swap, not rotate—keep simple).
- Ensure `transition-colors` is applied to both label and icon.

### 2.3 Sort Accessibility

**Current state:**  
Button has `onClick` but no ARIA attributes; no screen-reader announcement of sort state.

**Best practice (W3C ARIA):**  
- `aria-sort="ascending"` or `"descending"` on sorted column header; `"none"` or omit for unsorted.  
- Decorative icons should have `aria-hidden="true"` to avoid duplication in accessible name.  
- Live region to announce sort change (e.g., "Sorted by Days Since, descending").

**Changes:**
- Add `aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}` on the button when it’s the sorted column.
- Add `aria-label` that includes sort state when active, e.g.  
  - Sorted asc: `aria-label="Contact, sorted ascending. Click to sort descending."`  
  - Sorted desc: `aria-label="Contact, sorted descending. Click to remove sort."`  
  - Unsorted: `aria-label="Contact. Click to sort."`
- Mark decorative icons with `aria-hidden="true"`.
- Add a visually hidden live region that updates on sort change:  
  `"Sorted by {column}, {ascending|descending}"` or `"Sort removed"` when cycling to unsorted.
- Ensure focus ring: add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2251FF] focus-visible:ring-offset-2 rounded-sm` to sort button for 2px focus ring at 2px offset.

---

## 3. Filter Bar Layout and Interaction Improvements

### 3.1 Filter Button and Active-State Visibility

**Current state:**  
Filters button with `SlidersHorizontal`; badge count in `bg-[#2251FF]` when active; collapsed by default; active chips shown inline.

**Best practice:**  
Filter controls should be prominent; active filter count visible; clear "Clear all" action; chips removable individually.

**Changes:**
- Filter button: Ensure `h-9` (36px) for comfortable touch target; use `px-3`; keep `gap-2` between icon and "Filters" label.
- Badge: Use `min-w-[20px] h-5` for pill; `text-[11px] font-semibold`; `rounded-full`; ensure 4.5:1 contrast (white on #2251FF).
- "Clear all": Change from plain `text-xs text-muted-foreground` to `text-sm text-[#2251FF] hover:text-[#1a3dcc] font-medium underline-offset-2 hover:underline` for clearer affordance. Add `transition-colors duration-150`.

### 3.2 Filter Panel Layout (Inline vs Panel)

**Current state:**  
Expandable panel below button; filters grouped by Tier, Days since contact, Nudges; filter options as toggle chips.

**Best practice (Algolia, LogRocket):**  
For 10–50 contacts, inline expandable panel is appropriate. Order facets by decision impact; show only filters relevant to current context.

**Changes:**
- Filter order: Keep Tier first, Days second, Nudges third (matches tier-first grouping).
- Add visual separator between filter groups: `border-r border-border pr-6` on Tier and Days groups (not Nudges).
- Filter panel background: Change `bg-muted/20` to `bg-muted/30` for clearer separation from page background.
- Consider adding a match count in the panel header when expanded: "Showing X contacts" in `text-xs text-muted-foreground` at top of panel.

### 3.3 Filter Chip Design (Active Filters)

**Current state:**  
Badge with `bg-[#2251FF]/10 text-[#2251FF] border-[#2251FF]/20`; X icon `h-3 w-3`; `gap-1`.

**Best practice:**  
Chips should be clearly tappable; X icon should have adequate hit area; hover/focus states for remove.

**Changes:**
- Chip: Use `inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md`; add `hover:bg-[#2251FF]/15 transition-colors`.
- X icon: Wrap in `rounded p-0.5 hover:bg-[#2251FF]/20` for larger hit area; keep `h-3 w-3`.
- Ensure chips are keyboard-focusable and support Enter/Space to remove.
- Cursor: `cursor-pointer` on entire chip.

---

## 4. Grouped View Improvements

### 4.1 Section Headers (Tier)

**Current state:**  
Tier header: `h-2.5 w-2.5` dot + `text-sm font-semibold` tier name + count in `text-xs text-muted-foreground`; `mb-2 px-1`; `gap-3`.

**Best practice:**  
Section headers should establish clear hierarchy; use spacing and typography to separate tiers.

**Changes:**
- Section header: Use `flex items-center gap-3 mb-3` (was `mb-2`).
- Dot: Keep `h-2.5 w-2.5 rounded-full`; ensure tier color from TIER_COLORS.
- Tier label: Use `text-base font-semibold` (16px) for stronger hierarchy; apply tier text color.
- Count: Use `text-sm text-muted-foreground` (14px); add "·" before count: "Critical · 12 contacts".
- Spacing between tier sections: Use `space-y-8` (32px) instead of `space-y-6` (24px) for clearer separation.

### 4.2 Company Row (Expand/Collapse)

**Current state:**  
Company row: `px-5 py-2`; chevron `h-3.5 w-3.5`; `bg-muted/10`; `hover:bg-muted/30`; border `border-b border-border/40`.

**Best practice (Cloudscape, Carbon):**  
Expand/collapse controls should be obvious; use consistent indentation for hierarchy; adequate hit area for chevron.

**Changes:**
- Company row: Change `py-2` to `py-2.5`; ensure `min-h-[40px]` for touch.
- Chevron: Use `h-4 w-4`; add `transition-transform duration-200` and `rotate-0` when expanded, `-rotate-90` when collapsed (or keep ChevronRight/ChevronDown swap if clearer).
- Chevron hit area: Add `p-1 -m-1 rounded` to the icon wrapper for larger click target.
- Background: Use `bg-slate-50/80 dark:bg-slate-900/30` for subtle contrast with white rows (or keep `bg-muted/10` if consistent with theme).
- Company name: Use `font-medium text-foreground`; count in `text-muted-foreground text-xs`.
- Add left border accent: `border-l-2 border-[#2251FF]/30` on company row to indicate expandable group (optional, for visual hierarchy).

### 4.3 Visual Hierarchy in Grouped Table

**Current state:**  
Each tier is a section; companies within a bordered card; rows use `divide-y divide-border/30`.

**Best practice:**  
Hierarchy should be clear: tier > company > contact; alternating row background can aid scanability.

**Changes:**
- Consider zebra stripes for contact rows within a company: `odd:bg-transparent even:bg-muted/20` (or vice versa). Apply only to contact rows, not company headers.
- Ensure company header row is visually distinct: slightly bolder background than contact rows.
- First tier section: Add `pt-0` if page spacing handles it; otherwise keep consistent `pt-2` or similar above first tier header.

---

## 5. Row Design Improvements

### 5.1 Information Density and Alignment

**Current state:**  
Contact name + title in one column; Last Interaction (type, date, summary); Days Since (right-aligned); Other Partners; Nudges (center). Row `py-3`; columns use flex with `min-w-*` and `flex-*`.

**Best practice:**  
Numeric columns right-aligned; text left-aligned; primary identifier (name) emphasized; consistent density for 10–50 rows.

**Changes:**
- Contact column: Name `text-sm font-semibold`; title `text-xs text-muted-foreground`; ensure `leading-tight` on both for compact display.
- Last Interaction: Keep two-line layout; date + type on first line, summary on second; use `line-clamp-1` on summary if not already truncate.
- Days Since: Keep `text-right tabular-nums`; use `text-sm font-semibold` for numeric; keep electric blue for values.
- Other Partners: Keep truncation; consider `max-w-[140px]` or similar to prevent overflow.
- Nudges: Keep center alignment; badge styling is good.

### 5.2 Row Hover and Focus States

**Current state:**  
`hover:bg-muted/50` on Link; no explicit focus ring; `transition-colors`.

**Best practice:**  
Row hover helps scanability; focus-visible ring needed for keyboard users; link should have full-row hit area.

**Changes:**
- Hover: Change to `hover:bg-slate-100/80 dark:hover:bg-slate-800/50` for slightly stronger feedback, or keep `hover:bg-muted/50` if sufficient.
- Focus: Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2251FF] focus-visible:ring-inset` to the row Link. Ensure `outline-none` only for `focus-visible`, not `focus`.
- Transition: Add `transition-[background-color,box-shadow] duration-150` for smooth hover/focus.
- Cursor: Ensure `cursor-pointer` on the row (Link provides this).

### 5.3 Tier Bar (Left Accent)

**Current state:**  
`w-1` vertical bar with `rounded-r`; tier color from `getTierColors`.

**Best practice:**  
Accent bars aid quick tier recognition; ensure sufficient contrast and width.

**Changes:**
- Bar width: Keep `w-1` (4px) or consider `w-1.5` (6px) for better visibility.
- Bar radius: Keep `rounded-r`; ensure it touches left edge (no gap).
- Ensure tier colors meet contrast: CRITICAL (#2251FF), HIGH (green-600), MEDIUM (slate-400), LOW (slate-300)—verify against card background.

---

## 6. Empty and Zero-Result State Design

### 6.1 Zero Results (Filters Applied)

**Current state:**  
`"No contacts match your filters."` in `p-12 text-center text-muted-foreground`; no CTA; no illustration.

**Best practice (Cloudscape, Empty States):**  
Explain why it’s empty; provide primary action (e.g. Clear filters); optional illustration/icon; keep layout consistent with populated table.

**Changes:**
- Container: Use `py-16 px-6` (64px vertical) for breathing room; maintain table border/wrapper so it looks like the table area.
- Icon: Add `Inbox` or `SearchX` icon (lucide) at `h-12 w-12 text-muted-foreground/50` above the text.
- Headline: Use `text-base font-semibold text-foreground mb-2` — e.g. "No contacts match your filters".
- Subtext: Use `text-sm text-muted-foreground mb-6 max-w-sm mx-auto` — e.g. "Try adjusting your tier, days since contact, or nudges filters to see more results."
- Primary CTA: Add `Button` variant="outline" or "secondary": "Clear all filters" — onClick clears all filter state. Use `text-[#2251FF] border-[#2251FF]/30 hover:bg-[#2251FF]/5`.
- Optional: "View all contacts" link to reset filters and show everyone.

### 6.2 Initial Empty State (No Contacts at All)

**Current state:**  
Not explicitly handled; likely shows empty table or same zero-results message when `contacts.length === 0` and not loading.

**Best practice:**  
Distinguish "no data yet" from "no results after filter." For "no data yet," use encouraging copy and onboarding CTA.

**Changes:**
- When `!loading && contacts.length === 0` and no filters: show a different empty state.
- Headline: "No contacts yet" or "Get started with your contacts".
- Subtext: "Add contacts to start tracking relationships and nudge follow-ups."
- CTA: "Add contact" (if that action exists) or "Explore dashboard" — use primary button style `bg-[#2251FF] text-white`.
- Icon: Use `Users` or `UserPlus` at `h-16 w-16 text-muted-foreground/40`.

---

## 7. Responsive Behavior

### 7.1 Column Visibility (Current)

**Current state:**  
`Last Interaction` hidden below `md`; `Other Partners` hidden below `lg`; `COL` definitions use `hidden md:block` and `hidden lg:block`.

**Best practice:**  
Prioritize 2–3 columns on mobile; use responsive breakpoints (sm 640, md 768, lg 1024).

**Changes:**
- Document breakpoints: sm 640, md 768, lg 1024 — ensure Tailwind config matches.
- On md (768+): Show Contact, Last Interaction, Days Since, Nudges (4 columns).
- On lg (1024+): Add Other Partners (5 columns).
- On sm-only (< 768): Consider card layout (see 7.2) or sticky first column + horizontal scroll.

### 7.2 Mobile Card Layout

**Current state:**  
No card layout; table likely scrolls horizontally on small screens.

**Best practice:**  
For row-as-entity tables, card layout on mobile improves usability; use `data-label` for accessibility.

**Changes:**
- Below `md`: Render each contact as a card instead of table row.
- Card structure:  
  - Top: Avatar + Name + Title + tier badge  
  - Middle: Last Interaction (if any) + Days Since  
  - Bottom: Nudges badge + chevron/link  
- Use `flex flex-col gap-2 p-4 border-b`; `rounded-lg` on card; `data-label` on each field for screen readers if keeping semantic table.
- Toggle: Use `flex md:hidden` for card view and `hidden md:flex` for table row to switch at `md` breakpoint.

### 7.3 Horizontal Scroll Alternative

**Current state:**  
Flex layout; no explicit overflow handling.

**Best practice:**  
If keeping table on mobile, use horizontal scroll with sticky first column and scroll shadow.

**Changes:**
- Table wrapper: Add `overflow-x-auto` and `-mx-4 px-4` (or match page padding) so scroll feels contained.
- Min width: Add `min-w-[640px]` to table container so it doesn’t collapse.
- Sticky first column: Add `sticky left-0 z-10 bg-card` to Contact column (bar + name) and ensure `shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]` when scrolled to indicate more content.
- Scroll indicator: Optional gradient or shadow on right edge when scrollable.

---

## 8. Micro-Interactions and Transitions

### 8.1 Filter Panel Expand/Collapse

**Current state:**  
Panel toggles with `{open && (...)}`; no animation.

**Best practice:**  
Animate height/opacity for smoother disclosure.

**Changes:**
- Use CSS transition: `overflow-hidden transition-all duration-200 ease-out`; `max-h-0` when closed, `max-h-[200px]` (or sufficient) when open. May need `height: auto` trick or `grid-template-rows: 0fr`/`1fr` for smooth height animation.
- Alternatively, use Radix Collapsible or similar for accessible animated collapse.
- Fade: Add `opacity-0` when closed, `opacity-100` when open with `transition-opacity duration-200`.

### 8.2 Row Hover Transition

**Current state:**  
`transition-colors` on row.

**Changes:**
- Use `transition-colors duration-150 ease-out` for snappy feedback.

### 8.3 Company Expand/Collapse

**Current state:**  
Chevron and content toggle instantly.

**Changes:**
- Add `transition-transform duration-200` to chevron.
- For contact list under company: optionally `animate-in fade-in duration-200` (if using tailwindcss-animate) when expanding.

---

## 9. Color and Contrast Improvements

### 9.1 Tier Colors

**Current state:**  
`tier-colors.ts` uses #2251FF, green-600, slate-400, slate-300 for CRITICAL/HIGH/MEDIUM/LOW. MEDIUM and LOW use light neutrals.

**Best practice:**  
Ensure 4.5:1 contrast for text; AA for large text.

**Changes:**
- CRITICAL bar/text: #2251FF on white — verify contrast (typically passes for large text).
- MEDIUM: `text-slate-500` — ensure contrast on white (slate-500 ~#64748b usually passes).
- LOW: `text-slate-400` — may fail on white; consider `text-slate-600` or darker for better contrast.
- Badges: Ensure badge text meets contrast; LOW `text-slate-400` may need `text-slate-600`.

### 9.2 Muted Text Hierarchy

**Current state:**  
`text-muted-foreground`; `text-muted-foreground/60`; `text-muted-foreground/50`; `text-muted-foreground/40`.

**Best practice:**  
Use at most 2–3 levels of emphasis; ensure each meets 3:1 for non-essential text.

**Changes:**
- Primary secondary text: `text-muted-foreground` (standard).
- Tertiary: `text-muted-foreground/80` — avoid going below 70% opacity for critical info.
- Placeholder/empty: `text-muted-foreground/60` for "—" and empty states.
- Avoid `text-muted-foreground/40` for important labels; reserve for truly decorative or low-priority elements.

### 9.3 Electric Blue Consistency

**Current state:**  
Hardcoded `#2251FF` in multiple places (sort active, days value, nudge badge, filter accents).

**Best practice:**  
Use CSS variable `--primary` or `var(--primary)` for consistency.

**Changes:**
- Replace `#2251FF` with `var(--primary)` or Tailwind `text-primary`/`bg-primary` where appropriate.
- `globals.css` already has `--primary: #2251FF`; use `text-primary`, `bg-primary/10`, `border-primary/20` instead of hex.
- If design system prefers electric blue as accent: keep `#2251FF` in tier-colors for CRITICAL only; use `primary` for interactive highlights.

---

## 10. Typography Hierarchy

### 10.1 Page Title

**Current state:**  
`text-3xl font-bold tracking-tight text-foreground`.

**Best practice (McKinsey MDS):**  
H1 ~2.5rem, weight 700.

**Changes:**
- Use `text-[2rem] md:text-[2.5rem] font-bold tracking-tight` for responsive H1.
- Or keep `text-3xl` (1.875rem) if 2.5rem feels too large; ensure `font-bold` (700).

### 10.2 Table Header

**Current state:**  
`text-xs font-medium text-muted-foreground uppercase tracking-wider`.

**Best practice:**  
Column headers should be distinct but not overpowering; 11–12px typical.

**Changes:**
- Use `text-[11px] font-semibold uppercase tracking-widest text-muted-foreground` — slightly smaller, bolder for hierarchy.
- Letter-spacing: `tracking-widest` (0.1em) for strong uppercase labels.

### 10.3 Table Content

**Current state:**  
Name `text-sm font-medium`; title `text-xs`; dates/values `text-xs` or `text-sm`.

**Best practice:**  
Primary identifier larger; secondary smaller; numeric tabular.

**Changes:**
- Contact name: `text-sm font-semibold` (600) for emphasis.
- Secondary (title, last interaction): `text-xs text-muted-foreground` — keep.
- Numeric (Days Since): `text-sm font-semibold tabular-nums` — keep.
- Ensure consistent `line-height: 1.4` or `leading-tight` on table cells to avoid uneven row height from wrapped text.

---

## 11. Implementation Checklist

| Area | Priority | Tailwind / Change Summary |
|------|----------|---------------------------|
| Sort accessibility | High | `aria-sort`, `aria-label`, `aria-hidden`, focus ring |
| Sort icon size | Medium | `h-4 w-4`, `gap-1.5` |
| Empty state CTA | High | Add "Clear all filters" button; icon + headline + subtext |
| Filter "Clear all" | Medium | Stronger link styling, `text-[#2251FF] font-medium` |
| Row focus ring | High | `focus-visible:ring-2 focus-visible:ring-[#2251FF]` |
| Page spacing | Low | `space-y-5` → `space-y-8` |
| Header row height | Medium | `py-2.5` → `py-3`, add `h-12` |
| Section headers | Medium | `mb-2` → `mb-3`, `text-sm` → `text-base` for tier |
| Filter panel padding | Low | `px-4 py-3` → `px-5 py-4` |
| Mobile card layout | High | Add card view for `&lt;md` |
| Color tokens | Low | Replace `#2251FF` with `primary` where appropriate |

---

## 12. References

- [W3C ARIA Sortable Table](https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/)
- [IBM Carbon Data Table](https://carbondesignsystem.com/components/data-table/usage)
- [Algolia Filter UX](https://algolia.com/blog/ux/search-filter-ux-best-practices)
- [Cloudscape Empty States](https://cloudscape.design/patterns/general/empty-states)
- [McKinsey Design System Skill](/Users/Xinyu_Liu/.cursor/skills/mckinsey-design-system/SKILL.md)

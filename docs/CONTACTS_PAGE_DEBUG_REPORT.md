# Contacts Page Debug Report

**File:** `src/app/contacts/page.tsx`  
**Date:** March 18, 2026

---

## 1. Chevron Placement / Header Compactness

### Issue
The sort chevron appears far from the header text on "Contact" and "Last Interaction" columns. The column header content should be compact (text + chevron close together), not stretched across the full column width.

### Root Cause
**Lines 151–156, 177–181:** The `SortableHeader` button receives `colClass` directly (e.g. `flex-[2] min-w-0`). As a flex child, the button stretches to fill its column. Although the button uses `inline-flex`, the flex sizing makes it span the full column width. The chevron and text are at the start, but the button’s width causes the chevron to look far from the text in wider columns.

### Fix
Wrap each header in a `div` that receives `colClass` for column sizing. Make the button `w-fit` or `inline-flex` only (no flex sizing) so it stays compact. Structure:
```jsx
<div className={`${colClass} flex items-center`}>
  <button className="inline-flex items-center gap-1 w-fit ...">
    <span>{label}</span>
    {chevron}
  </button>
</div>
```

---

## 2. "Other Partners" Header Styling (Bolder/Larger) and Missing Chevron

### Issue
The "Other Partners" header appears bolder/larger than other column headers and lacks a visible sort chevron.

### Root Cause
**Lines 50, 156, 180:** The `otherPartners` colClass includes `hidden lg:block`. On the same element as `inline-flex`, at the `lg` breakpoint the last display value wins, so the button becomes `display: block` instead of `inline-flex`. That overrides the flex layout and breaks:
- Chevron visibility (layout differs from other columns)
- Consistent typography (block vs inline-flex can affect rendering)

The same applies to `lastInteraction` (**line 49**): `hidden md:block` can override `inline-flex` at `md+`.

### Fix
Do not put `hidden X:block` on the sort button. Put all column layout (including responsiveness) on the wrapper div, and keep the button purely `inline-flex` with no display overrides. See Fix #1.

---

## 3. Inactive Chevrons Invisible

### Issue
Inactive columns (including "Other Partners") appear to have no sort chevron because inactive chevrons use `opacity-0` and only appear on `group-hover/header:opacity-50`.

### Root Cause
**Lines 163–164:** Inactive chevron:
```jsx
<ChevronDown className="... opacity-0 group-hover/header:opacity-50 ..." />
```
With `opacity-0`, the chevron is invisible until the header row is hovered.

### Fix
Make inactive chevrons always visible but muted: e.g. `opacity-40` or `opacity-50`, and `group-hover/header:opacity-70` on hover. Ensures all columns show a sort chevron while preserving hover feedback.

---

## 4. Column Width Imbalance

### Issue
Column spacing looks uneven; "Last Interaction" and "Other Partners" get disproportionate width.

### Root Cause
**Lines 45–52:** Current COL definitions:
- `name`: `flex-[2]`
- `lastInteraction`: `flex-[2]`
- `daysSince`: `flex-1`
- `otherPartners`: `flex-[1.5]`
- `nudge`: `flex-1`

`name` and `lastInteraction` both use `flex-[2]`, which allocates more space than needed and makes gaps look large when the header content is compact. `otherPartners` at `flex-[1.5]` is in between.

### Fix
Use more balanced flex values, e.g.:
- `name`: `flex-[2]` (keep)
- `lastInteraction`: `flex-[1.5]` or `flex-[2]` with `min-w-0`
- `daysSince`: `flex-[0.8]` or `w-24 shrink-0` for fixed width
- `otherPartners`: `flex-[1.5]`
- `nudge`: `flex-[0.6]` or `w-20 shrink-0`

Adjust so columns feel proportional to their content while keeping `min-w-0` for truncation.

---

## 5. Header Typography Consistency

### Issue
"Other Partners" may look bolder due to the layout override above. All headers should share the same typography.

### Root Cause
Headers inherit `text-sm text-muted-foreground` from the parent row (**line 174**). No explicit `font-normal` is set.

### Fix
Add `font-normal` to the `SortableHeader` button (or a shared header class) so headers don’t inherit different weights from parents.

---

## 6. Sort Logic Verification

### Status: OK
**Lines 459–467:** Sort cycle is correct: default → reverse → clear.
- `key === "name"` → `asc`; all others → `desc`
- Cycles asc → desc → null as specified.

---

## 7. All Columns Sortable

### Status: OK
**Lines 177–181:** All five columns use `SortableHeader` and support sorting.

---

## 8. Search + Filters on Same Row

### Status: OK
**Lines 489–509:** Layout is correct:
- Search input in a flex container (`flex-1 min-w-[200px] max-w-md`)
- Spacer: `<div className="flex-1" />`
- `FilterBar` on the right

---

## 9. Filtering

### Status: OK
**Lines 91–104, 276–355:** Tier, Days Since, and Has Nudges filters are wired correctly; `FilterBar` renders the panel as intended.

---

## 10. Grouped / Flat View Sort

### Status: OK
**Lines 108–126, 368–433:** Grouped view sorts within each company; flat view sorts the full list.

---

## Implementation Priority

1. **High:** Fix SortableHeader structure (wrapper + compact button) and move `hidden X:block` to the wrapper — fixes chevron placement and "Other Partners" styling.
2. **High:** Make inactive chevrons always visible with reduced opacity.
3. **Medium:** Normalize header typography with `font-normal`.
4. **Medium:** Adjust column flex values for better balance.

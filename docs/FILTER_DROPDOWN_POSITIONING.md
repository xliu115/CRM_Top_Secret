# Fix Filter Panel to Drop Below Filter Button

## Problem

The `FilterBar` in `src/app/contacts/page.tsx` currently returns a React fragment with the button and a sibling `div` using `col-span-full`. The parent container is `flex flex-wrap`, so `col-span-full` has no effect. The filter panel either renders inline in the flex row or breaks the layout.

## Solution

Wrap the `FilterBar` in a `relative` container so the filter panel can be **absolutely positioned** directly below the Filters button, like a standard dropdown/popover.

### Changes (single file: `src/app/contacts/page.tsx`)

**1. FilterBar component** — Restructure the return:

```
<div className="relative">           <-- positioning anchor
  <Button ... />                      <-- Filters trigger (unchanged)
  
  {open && (
    <div className="absolute right-0 top-full mt-2 z-20 w-max max-w-[calc(100vw-2rem)]
                    rounded-lg border border-border bg-card shadow-lg px-5 py-4">
      ... filter groups (Tier, Days, Nudges) ...
    </div>
  )}
</div>
```

- `absolute right-0 top-full mt-2` places the panel flush below the button, right-aligned
- `z-20` ensures it floats above the table content
- `bg-card shadow-lg border` gives it a card-like dropdown appearance
- `w-max` lets it size to content; `max-w-[calc(100vw-2rem)]` prevents overflow on mobile

**2. Active filter chips** — Move them out of the dropdown and into the toolbar row, between the search input and the Filters button. They show inline as dismissible badges when filters are active, regardless of whether the panel is open.

**3. Parent toolbar row** — Adjust to:

```
<div className="flex flex-wrap items-center gap-3">
  <SearchInput />
  {active filter chips here}        <-- visible when filters active
  <div className="flex-1" />         <-- spacer
  <FilterBar ... />                  <-- self-contained relative dropdown
</div>
```

**4. Click-outside-to-close** — Add a `useEffect` with a `mousedown` listener on `document` that closes the panel when clicking outside the `FilterBar` container. Use a `ref` on the wrapper div.

### Visual result

```
[Search...]  [Critical x] [> 30d x] [Clear all]          [Filters v]
                                                    ┌─────────────────┐
                                                    │ TIER            │
                                                    │ [Crit] [High].. │
                                                    │ DAYS SINCE      │
                                                    │ [>7d] [>14d]... │
                                                    │ NUDGES          │
                                                    │ [Has open]      │
                                                    │ Showing 12      │
                                                    └─────────────────┘
```

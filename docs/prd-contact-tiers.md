# PRD: Contact tiers (ClientIQ)

**Status:** Draft · **Last updated:** 2026-03-19  

## Summary

Partners assign **Critical, High, Medium, or Low** (Standard in UI for Low) per contact. Tiers align with **nudge priority** and stale rules in the product.

## Contacts page: tier recommendations

1. **Load step** — Partners explicitly **load** recommendations via a top **banner** (`POST /api/contacts/tier-recommendations/load`). Suggestions are computed server-side and are **not** applied until accepted.

2. **After load** — A summary banner shows status, **Reload recommendations**, and **Exit** (ends the review session and returns to the normal contacts view; pending suggestions are cleared without applying). **Everyone / Changes only** appears only while there is at least one **pending** suggestion.

3. **Per contact** — No extra table column. Row + suggestion are one **card** (rounded border, amber accent) so the strip is clearly tied to the contact **above**. The strip repeats the **contact name**, then **Current → Suggested**, reason, and **icon-only** check / dismiss.

4. **Bulk actions** — A **fixed bottom bar** (when there are pending suggestions) offers **Accept N change(s)** and **Discard N change(s)** for all pending items at once.

5. **Empty state** — In **Changes only**, if there are no pending suggestions left (or none match current filters) but other contacts exist, the user can switch back to **Everyone**.

## Out of scope

- Persisting dismissed suggestions across sessions (optional later: localStorage or DB).

## Implementation references

- UI: [`src/app/contacts/page.tsx`](../src/app/contacts/page.tsx)  
- Load API: [`src/app/api/contacts/tier-recommendations/load/route.ts`](../src/app/api/contacts/tier-recommendations/load/route.ts)  
- Scoring: [`src/lib/services/tier-recommendations-service.ts`](../src/lib/services/tier-recommendations-service.ts)  
- PATCH `importance`: [`src/app/api/contacts/[id]/route.ts`](../src/app/api/contacts/[id]/route.ts)

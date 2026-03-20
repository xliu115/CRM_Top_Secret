# Per-Tier and Per-Contact Staleness Thresholds

## Current State

Today, `NudgeRuleConfig` has three flat thresholds (`staleCriticalDays: 90`, `staleCoolingDays: 60`, `staleAtRiskDays: 30`) that map to alert severity levels, not to contact importance tiers. The engine already branches on `contact.importance` for priority assignment, but the *day thresholds* are the same for all contacts.

## Design

### Resolution Order

When the nudge engine evaluates a contact, it resolves the staleness threshold like this:

```
contact.staleThresholdDays  (per-contact override, if set)
  -> tier default from NudgeRuleConfig  (based on contact.importance)
```

If a per-contact override exists, the engine uses that single number as the threshold and generates a nudge when `daysSince > threshold`. If not, it falls back to the tier-level thresholds from the partner's config.

### Data Model Changes

**1. Replace flat thresholds with per-tier thresholds in `NudgeRuleConfig`** (prisma/schema.prisma)

Remove `staleCriticalDays`, `staleCoolingDays`, `staleAtRiskDays` and add:

- `staleDaysCritical Int @default(30)` -- days for CRITICAL contacts
- `staleDaysHigh Int @default(45)` -- days for HIGH contacts
- `staleDaysMedium Int @default(60)` -- days for MEDIUM contacts
- `staleDaysLow Int @default(90)` -- days for LOW contacts

This is a cleaner mental model: "alert me after X days for contacts of this importance."

**2. Add optional per-contact override on `Contact`** (prisma/schema.prisma)

- `staleThresholdDays Int? @map("stale_threshold_days")` -- nullable; when set, overrides the tier default

### Nudge Engine Changes (src/lib/services/nudge-engine.ts)

Replace the current three-tier `if/else if/else if` block with:

```
threshold = contact.staleThresholdDays
  ?? config tier lookup based on contact.importance
if (daysSince > threshold) -> generate nudge
```

Priority assignment stays importance-based:

- CRITICAL contacts with `daysSince > threshold` -> URGENT
- HIGH -> HIGH
- MEDIUM -> MEDIUM
- LOW -> MEDIUM

### API Changes

**GET/PATCH /api/nudge-rules** (src/app/api/nudge-rules/route.ts)

- Update to use the new four tier fields instead of the old three
- Validation: all values 1-365

**PATCH /api/contacts/[id]** (extend existing src/app/api/contacts/[id]/route.ts)

- Accept `{ staleThresholdDays: number | null }` to set or clear the per-contact override

### UI Changes

**Nudge Preferences page** (src/app/nudges/settings/page.tsx)

- Replace the 3 threshold inputs (Critical/Cooling/At Risk) with 4 tier-based inputs:
  - "CRITICAL contacts -- alert after X days" (default 30)
  - "HIGH contacts -- alert after X days" (default 45)
  - "MEDIUM contacts -- alert after X days" (default 60)
  - "LOW contacts -- alert after X days" (default 90)

**Contact detail page** (src/app/contacts/[id]/page.tsx)

- Add a small "Staleness threshold" field in the profile header card, next to the importance badge
- Shows the effective threshold (per-contact override or tier default) with a way to customize or clear it
- Inline edit: click to set a custom number, or "Use default (X days)" to clear the override

### Repository Changes

**NudgeRuleConfigRepository** (src/lib/repositories/prisma/nudge-rule-config-repository.ts)

- Update DEFAULTS to use the new four fields
- Update `resetToDefaults` accordingly

**ContactRepository** (src/lib/repositories/prisma/contact-repository.ts)

- Add `updateStaleThreshold(id, partnerId, days: number | null)` method

### Migration

Since we're on SQLite with `db push`, the old three columns will be dropped and four new ones added. Existing partners will get the new defaults automatically on next config read (via upsert).

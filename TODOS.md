# Activate — Deferred & Future Work

Last updated: 2026-03-28 (CEO Review Phase 2)

## Accepted — Next Sprint

- [ ] **Relationship Recap on Demand** — Structured AI summary from `rag-service` + new prompt template. Effort: S
- [ ] **Natural Language Nudge Config** — Parse chat intent to update NudgeRuleConfig. Effort: M
- [ ] **Voice-First Quick Actions** — Command parsing for nudge actions via voice input. Effort: M

## Deferred — Feature Backlog

### High Priority (next cycle)

- [ ] **Pre-Meeting Brief Auto-Push** — Auto-send meeting brief 30 min before meeting via cron + Resend. Effort: S. Reuses `llm-meeting.ts` + `email-service.ts`.
- [ ] **Draft Card Pattern for All AI Actions** — Extend reviewable card UX to briefing edits, nudge dismissals, sequence kicks. Effort: S.
- [ ] **Nudge Effectiveness Analytics + ROI** — Track nudge outcomes (viewed, actioned, email sent). New `NudgeAction` model + dashboard chart. Effort: M.
- [ ] **BriefingSend Audit Model** — Persist email send records to a `BriefingSend` Prisma model (partnerId, sentAt, nudgeCount, success). Effort: S.

### Medium Priority

- [ ] **Connection Strength Scoring** — Compute 0-100 relationship score from interactions, meetings, reciprocity. Display on contact cards, feed into nudge prioritization. Effort: S-M.
- [ ] **Tone-of-Voice Personalization** — Learn Partner tone from sample emails, add tone profile to LLM prompts. Effort: M. Requires sample email data + policy review.
- [ ] **Relationship Health Dashboard with Trends** — Periodic snapshots, trend lines, "fastest declining" alerts. Depends on Connection Strength Scoring. Effort: M-L.

### Low Priority

- [ ] **Firm-Wide Relationship Graph** — D3 visualization of cross-firm connections. Different user segment (firm leadership). Effort: L.

## Tech Debt

- [ ] **Structured logging** — Replace console.log with structured logging (pino or similar). Add cron run persistence.
- [ ] **TypeScript enums for status strings** — Replace raw strings ("ACTIVE", "PAUSED", etc.) with enums across cadence engine.
- [ ] **Status string enums** — Use TypeScript enums or const objects for "ACTIVE"/"PAUSED"/"COMPLETED"/etc. across cron routes and cadence engine.
- [ ] **Reply-detection pagination** — Add pagination to the 7-day inbound scan in `detectUnrepliedInbound()` for scale.
- [ ] **Cron health dashboard** — Persist cron run results to a `CronRun` model or log file for observability.
- [ ] **Feature flags** — Add feature flags for cadence engine and morning briefing to enable per-partner rollout.

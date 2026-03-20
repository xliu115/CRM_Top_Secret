# Nudge Requirements Document Update

## Purpose

Update the nudge type action requirements document to reflect the current implemented state. All original phases are now complete, plus significant architectural changes were made beyond the original scope.

## Key Changes to Document

### 1. Mark All Phases Complete

All 6 original todos (phase1-linkedin-engine, phase1-type-ctas, phase2-draft-api, phase2-draft-panel, phase3-metadata, phase3-secondary) should be marked `completed`.

### 2. Update "Current State" Section

Replace the old "generic UI" description with the current state:

- 9 nudge types fully supported (including LINKEDIN_ACTIVITY)
- **Consolidated nudge model**: one nudge per contact, merging all insights (stale, job change, news, events, LinkedIn, articles) into a single card
- Type-specific CTAs, icons, and context panels
- In-app LLM-powered email draft panel
- Meeting brief generation for MEETING_PREP nudges
- Partner relationship context on JOB_CHANGE nudges
- Push email digest with type-specific styling

### 3. Add New Section: "Nudge Consolidation Architecture"

Document the major architectural decision:

- **Problem**: Multiple nudges per contact (20+ cards for a single person) created noise and decision fatigue
- **Solution**: Engine produces ONE nudge per contact with all insights merged into `metadata.insights[]`
- **Priority logic**: Highest-priority insight determines the card's `ruleType` and `priority` (rank: MEETING_PREP > STALE_CONTACT > JOB_CHANGE > LINKEDIN_ACTIVITY > events > articles > COMPANY_NEWS)
- **Reason text**: Consolidated summary like "5 reasons to reach out to X: overdue for a check-in, executive transition, and company news"
- **Signal caps**: Company news capped at 3, LinkedIn activity at 2 per contact
- Key files: nudge-engine.ts `Insight` interface, `pickPrimary()`, `buildReason()`

### 4. Update Section 2 (JOB_CHANGE)

- Rename label from "Job Change" to **"Executive Transition"** throughout
- Document the partner relationship lookup: `getPartnerRelationsForPerson()` finds which McK partners know the person who changed jobs
- Metadata stores `relatedPartners` and `personName` for UI rendering
- UI renders a `PartnerRelationsPanel` showing partner names with avatar chips

### 5. Update Section 5 (MEETING_PREP)

- Document the dedicated meeting brief endpoint: `POST /api/nudges/[id]/meeting-brief`
- Brief panel (`MeetingBriefPanel`) renders structured markdown with sections: Meeting Context, Attendee Insights, Recommended Agenda, Suggested Questions, Risks, Preparation Checklist
- Meeting brief is separate from email draft — the CTA correctly opens the brief panel, not the email draft

### 6. Update Implementation Architecture

- **Schema**: `metadata` field added to Nudge model, `linkedinActivityEnabled` added to NudgeRuleConfig
- **API endpoints**: `POST /api/nudges/[id]/draft-email` (with non-blocking cache), `POST /api/nudges/[id]/meeting-brief`
- **Engine**: Consolidated architecture — collects all insights per contact, picks primary, builds summary reason, stores insights array in metadata
- **UI**: `InsightItem` component renders each insight with type-specific icon/color/link; `NudgeCard` renders consolidated card; `DraftEmailPanel` and `MeetingBriefPanel` for actions; type filter checks `metadata.insights` not just `ruleType`
- **Dashboard**: Matching consolidated design (compact insight list, no type badges)
- **Email digest**: Type-specific icons, colors, CTA labels, and type breakdown section

### 7. Update Priority/Phases to "Completed" Status

Replace the phased roadmap with a "Completed" summary noting all phases are done, and add any remaining future enhancements as a new "Future Considerations" section.

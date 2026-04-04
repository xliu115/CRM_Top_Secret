import type { VoiceOutlineSegment } from "@/components/voice-memo/voice-memo-client-briefing";
import type { ApiStructuredBriefing } from "@/lib/services/structured-briefing";

/** Sample structured payload — matches `getDemoVoiceOutline` topics for tap-to-play. */
export function getDemoStructuredBriefing(): ApiStructuredBriefing {
  return {
    nudges: [
      {
        contactName: "Riley Chen",
        company: "Meridian Group",
        reason: "Relationship cooling — check in before renewal window.",
        priority: "HIGH",
        contactId: "demo-contact-1",
        nudgeId: "demo-nudge-1",
        ruleType: "STALE_CONTACT",
        daysSince: 61,
        lastContactedAt: "2026-02-02T12:00:00.000Z",
        lastContactedLabel: "Feb 2, 2026",
        lastInteractionSummary:
          "Call re: renewal timing and procurement checklist.",
      },
    ],
    meetings: [
      {
        title: "Pipeline review",
        startTime: "Thu 9:00 AM",
        attendeeNames: ["Dana Ortiz", "Sam Okonkwo"],
        meetingId: "demo-meeting-1",
      },
    ],
    news: [
      {
        content:
          "Expansion filing reported in trade press — confirm with your sponsor before Thursday’s session.",
        contactName: null,
        company: "Meridian Group",
        companyId: "demo-co-1",
        url: null,
      },
    ],
  };
}

/** Shown until live briefing loads or if the API fails — keeps the mobile screen populated. */
export function getDemoVoiceOutline(partnerFirstName: string): VoiceOutlineSegment[] {
  return [
    {
      id: "demo-1",
      headline: `Hi ${partnerFirstName} — snapshot from CRM (sample)`,
      script: `Hi ${partnerFirstName}. Sample briefing: your top relationship today is Riley Chen at Meridian Group. Last touch February 2, 2026, 61 days ago. Latest note mentions renewal timing. Next, you have a pipeline review Thursday at 9 AM with Dana Ortiz.`,
      deeplink: "/nudges",
    },
    {
      id: "demo-2",
      headline: "Who needs attention — Riley Chen",
      script: `Riley Chen at Meridian Group: last logged touch February second. Why this surfaced: relationship cooling before renewal window.`,
      deeplink: "/contacts",
    },
    {
      id: "demo-3",
      headline: "Meeting prep — Pipeline review",
      script: `Coming up: pipeline review Thursday at nine AM with Dana Ortiz and finance. Worth a quick prep pass on open next steps.`,
      deeplink: "/meetings",
    },
    {
      id: "demo-4",
      headline: "Signals — Meridian Group",
      script: `On the radar: Meridian filed an expansion filing — skim before your client touchpoints this week.`,
      deeplink: "/nudges",
    },
  ];
}

/** @deprecated Prefer getDemoStructuredBriefing + MobileBriefingListen — kept for tests or legacy callers */
export function getDemoBriefingMarkdown(partnerFirstName: string): string {
  return `Good morning, **${partnerFirstName}** — sample CRM snapshot (refresh or sign in to load live data).

**Who to contact:**

- **Riley Chen** · **Meridian Group** — Last touch **Feb 2, 2026** (61 days ago).
  - Latest note: Call re: renewal timing and procurement checklist.
  - Why this surfaced: Relationship cooling — check in before renewal window.

**Meetings:**

- **Pipeline review** — Thu 9:00 AM with Dana Ortiz, Sam Okonkwo.

**Signals & news:**

- **Meridian Group**: Expansion filing reported in trade press — confirm with your sponsor before Thursday’s session.

When your live data loads, this panel updates automatically.`;
}

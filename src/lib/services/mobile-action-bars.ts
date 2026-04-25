import type { ActionBarBlock } from "@/lib/types/chat-blocks";
import {
  SENTINEL_COPY_EMAIL,
  SENTINEL_TOGGLE_BRIEF,
} from "@/lib/services/chat-sentinels";

type Bar = ActionBarBlock["data"];

// Email-draft cluster bottom bar. The card header owns the Edit affordance
// (whole card is tap-to-edit) and the regenerate row (Warmer/Shorter/Say-it)
// lives inside the draft, so the bar is intentionally just send + copy:
// outcome + portability, no duplicated micro-actions.
export function buildEmailDraftActionBar(args: {
  contactName: string;
}): Bar {
  return {
    primary: {
      label: "Send Email",
      query: `Send the drafted email to ${args.contactName}.`,
      icon: "send",
    },
    secondary: [],
    tertiary: [
      { label: "Copy", query: SENTINEL_COPY_EMAIL, icon: "copy" },
    ],
    variant: "default",
  };
}

export function buildNudgeActionActionBar(args: {
  contactName: string;
}): Bar {
  const base = buildEmailDraftActionBar({ contactName: args.contactName });
  return {
    ...base,
    tertiary: [
      ...(base.tertiary ?? []),
      {
        label: "Dismiss",
        query: `Dismiss the nudge for ${args.contactName}.`,
        icon: "trash",
      },
      {
        label: "Snooze",
        query: `Snooze the nudge for ${args.contactName}.`,
        icon: "bell-off",
      },
    ],
  };
}

export function buildMeetingBriefActionBar(args: {
  expanded: boolean;
  firstAttendeeName?: string;
}): Bar {
  const draftEmail = args.firstAttendeeName
    ? {
        label: "Draft Email",
        query: `Draft an email to ${args.firstAttendeeName}.`,
        icon: "mail",
      }
    : null;

  if (args.expanded) {
    return {
      primary: draftEmail ?? {
        label: "Draft Email",
        query: "Draft a follow-up email for this meeting.",
        icon: "mail",
      },
      secondary: [
        { label: "Hide full brief", query: SENTINEL_TOGGLE_BRIEF, icon: "chevron-up" },
      ],
      variant: "default",
    };
  }

  return {
    primary: {
      label: "View full brief",
      query: SENTINEL_TOGGLE_BRIEF,
      icon: "chevron-down",
    },
    secondary: draftEmail ? [draftEmail] : [],
    variant: "default",
  };
}

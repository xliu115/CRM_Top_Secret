export type ContactCardBlock = {
  type: "contact_card";
  data: {
    name: string;
    title?: string;
    company?: string;
    contactId: string;
    daysSince?: number;
    priority?: string;
  };
};

export type ActionBarBlock = {
  type: "action_bar";
  data: {
    primary: { label: string; query: string; icon: string };
    secondary: { label: string; query: string; icon: string }[];
  };
};

export type EmailPreviewBlock = {
  type: "email_preview";
  data: {
    to: string;
    subject: string;
    body: string;
    contactId?: string;
  };
};

export type EditableEmailDraftBlock = {
  type: "editable_email_draft";
  data: {
    draftId: string;
    to: string;
    subject: string;
    body: string;
    contactId?: string;
    nudgeId?: string;
    regenerate?: {
      warmer?: string;
      shorter?: string;
      addContext?: string;
    };
  };
};

export type ApprovalDeckBlock = {
  type: "approval_deck";
  data: {
    deckId: string;
    title?: string;
    items: {
      itemId: string;
      kind: "email";
      contactName: string;
      company?: string;
      contactId?: string;
      nudgeId?: string;
      email: {
        to: string;
        subject: string;
        body: string;
      };
      approveQuery: string;
      skipQuery?: string;
    }[];
  };
};

export type MeetingSchedulerBlock = {
  type: "meeting_scheduler";
  data: {
    schedulerId: string;
    title: string;
    attendees: { name: string; email?: string }[];
    durationMinutes: number;
    slots: {
      slotId: string;
      startIso: string;
      label: string;
    }[];
    suggestedSubject?: string;
    suggestedBody?: string;
  };
};

export type CalendarActionBlock = {
  type: "calendar_action";
  data: {
    meetingId: string;
    title: string;
    startIso: string;
    durationMinutes?: number;
    organizerName?: string;
    currentStatus?: "pending" | "accepted" | "declined" | "proposed_new_time";
  };
};

export type MeetingCardBlock = {
  type: "meeting_card";
  data: {
    title: string;
    startTime: string;
    attendees: { name: string; title?: string }[];
    meetingId: string;
    purpose?: string;
  };
};

export type StaleContactsListBlock = {
  type: "stale_contacts_list";
  data: {
    contacts: {
      name: string;
      company: string;
      contactId: string;
      daysSince: number;
      signal?: string;
    }[];
  };
};

export type NudgeEvidenceBlock = {
  type: "nudge_evidence";
  data: {
    insights: {
      type: string;
      reason: string;
      signalContent?: string;
      signalUrl?: string;
      priority: string;
    }[];
  };
};

export type StrategicInsightBlock = {
  type: "strategic_insight";
  data: {
    narrative: string;
    oneLiner?: string;
    suggestedAction?: { label: string; context?: string };
    insights: {
      type: string;
      reason: string;
      signalContent?: string;
      signalUrl?: string;
    }[];
  };
};

export type ConfirmationCardBlock = {
  type: "confirmation_card";
  data: {
    title: string;
    description: string;
    action: {
      type: "dismiss_nudge" | "snooze_nudge" | "send_email";
      nudgeId: string;
      contactId: string;
      contactName: string;
      emailData?: { subject: string; body: string };
    };
    confirmLabel: string;
    cancelLabel: string;
  };
};

export type ChatBlock =
  | ContactCardBlock
  | ActionBarBlock
  | EmailPreviewBlock
  | EditableEmailDraftBlock
  | ApprovalDeckBlock
  | MeetingSchedulerBlock
  | CalendarActionBlock
  | MeetingCardBlock
  | StaleContactsListBlock
  | NudgeEvidenceBlock
  | StrategicInsightBlock
  | ConfirmationCardBlock;

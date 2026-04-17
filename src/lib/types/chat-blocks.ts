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
  | MeetingCardBlock
  | StaleContactsListBlock
  | NudgeEvidenceBlock
  | StrategicInsightBlock
  | ConfirmationCardBlock;

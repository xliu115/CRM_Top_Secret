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

export type ChatBlock =
  | ContactCardBlock
  | ActionBarBlock
  | EmailPreviewBlock
  | MeetingCardBlock
  | StaleContactsListBlock
  | NudgeEvidenceBlock;

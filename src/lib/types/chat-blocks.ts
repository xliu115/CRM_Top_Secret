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

type ActionBarItem = { label: string; query: string; icon: string };

export type ActionBarBlock = {
  type: "action_bar";
  data: {
    primary: ActionBarItem;
    secondary: ActionBarItem[];
    tertiary?: ActionBarItem[];
    variant?: "default" | "destructive_primary";
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

export type MeetingBriefBlock = {
  type: "meeting_brief";
  data: {
    meetingId: string;
    meetingTitle: string;
    /**
     * Rich strategic paragraph about the primary attendee's current focus,
     * mirroring the desktop "Top-of-Mind" panel. Surfaced prominently when
     * non-generic content is available; otherwise falls back to `synthesis`.
     */
    topOfMind?: {
      subjectName: string;
      content: string;
    };
    /** Concise 2-3 paragraph summary used as fallback when no topOfMind. */
    synthesis: string;
    fullBrief: string;
    temperature?: "COLD" | "COOL" | "WARM" | "HOT";
    firstAttendeeName?: string;
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
      priority?: string;
      ruleType?: string;
      insightPreview?: string;
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

/**
 * In-chat campaign approval surface for CENTRAL campaigns. Each recipient
 * row defaults to APPROVED (matching the partner-friendly "review by
 * exception" model); a tap on a row's chip flips it to REJECTED. There is
 * no campaign-level edit affordance — for CENTRAL campaigns the partner's
 * only edit surface is per-contact (planned follow-up).
 */
export type CampaignApprovalBlock = {
  type: "campaign_approval";
  data: {
    campaignId: string;
    name: string;
    description: string;
    /** ISO string for the soonest approval deadline among recipients, if any. */
    deadline?: string;
    recipients: {
      recipientId: string;
      contactName: string;
      company?: string;
      contactId?: string;
      personalizedSnippet?: string;
      defaultDecision: "APPROVED" | "REJECTED";
    }[];
    totalRecipients: number;
    /** How many rows to render before collapsing under "+N more contacts". */
    visibleLimit: number;
  };
};

/**
 * In-chat article-share surface. Shows the article hero (image, title,
 * description) with a per-recipient list. Each row is a tap target that
 * opens the EmailComposerModal; a side toggle lets the partner Skip
 * individual contacts. Confirm sends to included contacts.
 */
export type ArticleShareBlock = {
  type: "article_share";
  data: {
    campaignId: string;
    contentItemId: string;
    title: string;
    description?: string;
    imageUrl?: string;
    publishedAtLabel?: string;
    practice?: string;
    url?: string;
    subject: string;
    recipients: {
      recipientId: string;
      contactId: string;
      contactName: string;
      contactEmail: string;
      company?: string;
      personalizedSnippet?: string;
      personalizedBody: string;
      defaultIncluded: true;
    }[];
    totalRecipients: number;
    visibleLimit: number;
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
  | MeetingBriefBlock
  | StaleContactsListBlock
  | NudgeEvidenceBlock
  | StrategicInsightBlock
  | ConfirmationCardBlock
  | CampaignApprovalBlock
  | ArticleShareBlock;

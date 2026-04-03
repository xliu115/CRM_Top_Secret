import type { Prisma } from "@prisma/client";

export interface ContactRef {
  id: string;
  name: string;
  companyId: string;
  partnerId: string;
  title: string;
}

type CampaignRow = Omit<
  Prisma.CampaignCreateInput,
  "partner" | "contents" | "recipients"
> & {
  id: string;
  partnerId: string;
  name: string;
  source: string;
  status: string;
};

type CampaignContentRow = Prisma.CampaignContentCreateManyInput;
type RecipientRow = Prisma.CampaignRecipientCreateManyInput;
type EngagementRow = Prisma.CampaignEngagementCreateManyInput;

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** Two-digit hour/minute for ISO-8601 times (avoids Invalid Date from single-digit hours). */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function generateMockCampaigns(contacts: ContactRef[]): {
  campaigns: CampaignRow[];
  campaignContents: CampaignContentRow[];
  recipients: RecipientRow[];
  engagements: EngagementRow[];
} {
  const campaigns: CampaignRow[] = [];
  const campaignContents: CampaignContentRow[] = [];
  const recipients: RecipientRow[] = [];
  const engagements: EngagementRow[] = [];

  let ccSeq = 1;
  const nextCc = (): string => `cc-${pad3(ccSeq++)}`;

  const byPartner = (pid: string) =>
    contacts.filter((c) => c.partnerId === pid);

  const ava = byPartner("p-ava-patel");
  const jordan = byPartner("p-jordan-kim");
  const sam = byPartner("p-sam-rivera");
  const morgan = byPartner("p-morgan-chen");
  const taylor = byPartner("p-taylor-brooks");

  // --- Ava Patel (001–006) ---

  const c1 = "camp-mock-001";
  campaigns.push({
    id: c1,
    partnerId: "p-ava-patel",
    name: "AI Strategy Insights — Q1 2026",
    subject: "Thought you'd find this valuable — AI strategy insights",
    bodyTemplate:
      "Hi {{name}},\n\nI came across this piece on AI strategy and immediately thought of your work at {{company}}. The insights on executive decision-making around AI investments are particularly relevant given what we discussed last time.\n\nWould love to hear your perspective.",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-15T09:00:00Z"),
    sendStartedAt: new Date("2026-03-15T08:59:50Z"),
    createdAt: new Date("2026-03-14T16:00:00Z"),
    updatedAt: new Date("2026-03-15T09:00:00Z"),
  });
  campaignContents.push(
    { id: nextCc(), campaignId: c1, contentItemId: "ci-art-011", position: 0 },
    { id: nextCc(), campaignId: c1, contentItemId: "ci-art-004", position: 1 }
  );
  const c1Rec = ava.slice(0, 6);
  for (let i = 0; i < c1Rec.length; i++) {
    const rId = `cr-${pad3(1)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c1,
      contactId: c1Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-15T09:00:00Z"),
    });
    if (i < 4) {
      engagements.push({
        id: `ce-${pad3(1)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-15T${pad2(10 + i)}:30:00Z`),
      });
    }
    if (i < 3) {
      engagements.push({
        id: `ce-${pad3(1)}-${i}-click`,
        recipientId: rId,
        type: "CLICKED",
        contentItemId: "ci-art-011",
        timestamp: new Date(`2026-03-15T${pad2(11 + i)}:00:00Z`),
      });
    }
  }

  const c2 = "camp-mock-002";
  campaigns.push({
    id: c2,
    partnerId: "p-ava-patel",
    name: "GenAI Executive Briefing — Invite",
    subject: "You're invited: McKinsey GenAI Executive Briefing (Apr 22)",
    bodyTemplate:
      "Hi {{name}},\n\nI'd like to personally invite you to our upcoming GenAI Executive Briefing. Given your role at {{company}}, I think you'd find the practical application sessions especially relevant.\n\nPlease RSVP using the link below.",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-20T10:00:00Z"),
    sendStartedAt: new Date("2026-03-20T09:59:50Z"),
    createdAt: new Date("2026-03-19T14:00:00Z"),
    updatedAt: new Date("2026-03-20T10:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c2,
    contentItemId: "ci-evt-004",
    position: 0,
  });
  const c2Rec = ava.slice(2, 7);
  const c2Rsvp: (string | null)[] = ["ACCEPTED", "ACCEPTED", "ACCEPTED", "DECLINED", null];
  for (let i = 0; i < c2Rec.length; i++) {
    const rId = `cr-${pad3(2)}-${i}`;
    const token = `rsvp-${c2}-${i}`;
    const st = c2Rsvp[i];
    recipients.push({
      id: rId,
      campaignId: c2,
      contactId: c2Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-20T10:00:00Z"),
      rsvpToken: token,
      rsvpStatus: st ?? undefined,
      rsvpRespondedAt: st
        ? new Date(`2026-03-${pad2(21 + i)}T14:00:00Z`)
        : undefined,
    });
    if (i < 4) {
      engagements.push({
        id: `ce-${pad3(2)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-20T${pad2(12 + i)}:00:00Z`),
      });
    }
    if (st === "ACCEPTED") {
      engagements.push({
        id: `ce-${pad3(2)}-${i}-rsvp`,
        recipientId: rId,
        type: "EVENT_REGISTERED",
        contentItemId: "ci-evt-004",
        timestamp: new Date(`2026-03-${pad2(21 + i)}T14:00:00Z`),
      });
    }
  }

  const c3 = "camp-mock-003";
  campaigns.push({
    id: c3,
    partnerId: "p-ava-patel",
    name: "Supply Chain Resilience Insights",
    subject: "New research on supply chain resilience — relevant for your team",
    bodyTemplate:
      "Hi {{name}},\n\nOur latest research on building resilient supply chains has some findings I think would resonate with what {{company}} is navigating.\n\nHappy to discuss further.",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-25T08:30:00Z"),
    sendStartedAt: new Date("2026-03-25T08:29:50Z"),
    createdAt: new Date("2026-03-24T17:00:00Z"),
    updatedAt: new Date("2026-03-25T08:30:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c3,
    contentItemId: "ci-art-006",
    position: 0,
  });
  const c3Rec = ava.slice(5, 9);
  for (let i = 0; i < c3Rec.length; i++) {
    const rId = `cr-${pad3(3)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c3,
      contactId: c3Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-25T08:30:00Z"),
    });
    if (i < 3) {
      engagements.push({
        id: `ce-${pad3(3)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-25T${pad2(10 + i)}:00:00Z`),
      });
    }
    if (i < 2) {
      engagements.push({
        id: `ce-${pad3(3)}-${i}-read`,
        recipientId: rId,
        type: "ARTICLE_READ",
        contentItemId: "ci-art-006",
        timestamp: new Date(`2026-03-25T${pad2(11 + i)}:30:00Z`),
      });
    }
  }

  const c4 = "camp-mock-004";
  campaigns.push({
    id: c4,
    partnerId: "p-ava-patel",
    name: "Q2 Check-in Outreach",
    subject: "Quick check-in as we head into Q2",
    bodyTemplate:
      "Hi {{name}},\n\nAs we head into Q2, I wanted to reach out and see how things are going at {{company}}. Would love to catch up over coffee or a quick call.\n\nBest,\nAva",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-28T11:00:00Z"),
    sendStartedAt: new Date("2026-03-28T10:59:50Z"),
    createdAt: new Date("2026-03-28T10:00:00Z"),
    updatedAt: new Date("2026-03-28T11:00:00Z"),
  });
  const c4Rec = ava.slice(0, 3);
  for (let i = 0; i < c4Rec.length; i++) {
    const rId = `cr-${pad3(4)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c4,
      contactId: c4Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-28T11:00:00Z"),
    });
    if (i < 2) {
      engagements.push({
        id: `ce-${pad3(4)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-28T${pad2(13 + i)}:00:00Z`),
      });
    }
  }

  const c5 = "camp-mock-005";
  campaigns.push({
    id: c5,
    partnerId: "p-ava-patel",
    name: "AI & Analytics Summit — May Invite",
    subject: "Save the date: McKinsey AI & Analytics Summit (May 15)",
    bodyTemplate:
      "Hi {{name}},\n\nI'm excited to invite you to our AI & Analytics Summit in New York this May. It's shaping up to be an exceptional lineup.\n\nWould love to see you there.",
    source: "ACTIVATE",
    status: "DRAFT",
    createdAt: new Date("2026-03-30T15:00:00Z"),
    updatedAt: new Date("2026-03-30T15:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c5,
    contentItemId: "ci-evt-001",
    position: 0,
  });
  const c5Rec = ava.slice(0, 8);
  for (let i = 0; i < c5Rec.length; i++) {
    recipients.push({
      id: `cr-${pad3(5)}-${i}`,
      campaignId: c5,
      contactId: c5Rec[i].id,
      status: "PENDING",
    });
  }

  const c6 = "camp-mock-006";
  campaigns.push({
    id: c6,
    partnerId: "p-ava-patel",
    name: "DNA-NA--Event In Person-CDO Forum Caserta",
    source: "IMPORTED",
    status: "SENT",
    importedFrom: "Marketo",
    sentAt: new Date("2026-02-10T09:00:00Z"),
    createdAt: new Date("2026-02-10T09:00:00Z"),
    updatedAt: new Date("2026-02-10T09:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c6,
    contentItemId: "ci-evt-003",
    position: 0,
  });
  const c6Rec = ava.slice(1, 5);
  for (let i = 0; i < c6Rec.length; i++) {
    const rId = `cr-${pad3(6)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c6,
      contactId: c6Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-02-10T09:00:00Z"),
      rsvpToken: `rsvp-${c6}-${i}`,
    });
    if (i < 3) {
      engagements.push({
        id: `ce-${pad3(6)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-02-10T${pad2(14 + i)}:00:00Z`),
      });
    }
    if (i < 2) {
      engagements.push({
        id: `ce-${pad3(6)}-${i}-click`,
        recipientId: rId,
        type: "CLICKED",
        contentItemId: "ci-evt-003",
        timestamp: new Date(`2026-02-11T${pad2(10 + i)}:00:00Z`),
      });
    }
  }

  // --- Jordan Kim (007–010) ---

  const c7 = "camp-mock-007";
  campaigns.push({
    id: c7,
    partnerId: "p-jordan-kim",
    name: "Banking AI Transformation",
    subject: "Research on generative AI in banking — tailored to your priorities",
    bodyTemplate:
      "Hi {{name}},\n\nGiven {{company}}'s leadership in financial services, I thought this perspective on GenAI in banking would be timely.\n\nHappy to discuss implications for your roadmap.",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-02-18T14:00:00Z"),
    sendStartedAt: new Date("2026-02-18T13:59:45Z"),
    createdAt: new Date("2026-02-17T12:00:00Z"),
    updatedAt: new Date("2026-02-18T14:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c7,
    contentItemId: "ci-art-005",
    position: 0,
  });
  const c7Rec = jordan.slice(0, 5);
  for (let i = 0; i < c7Rec.length; i++) {
    const rId = `cr-${pad3(7)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c7,
      contactId: c7Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-02-18T14:00:00Z"),
    });
    if (i < 3) {
      engagements.push({
        id: `ce-${pad3(7)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-02-18T${pad2(15 + i)}:20:00Z`),
      });
    }
    if (i < 2) {
      engagements.push({
        id: `ce-${pad3(7)}-${i}-click`,
        recipientId: rId,
        type: "CLICKED",
        contentItemId: "ci-art-005",
        timestamp: new Date(`2026-02-19T${pad2(10 + i)}:00:00Z`),
      });
    }
  }

  const c8 = "camp-mock-008";
  campaigns.push({
    id: c8,
    partnerId: "p-jordan-kim",
    name: "Technology Trends — Must Read",
    subject: "Two quick reads on tech trends and operating model",
    bodyTemplate:
      "Hi {{name}},\n\nSharing two short pieces from our Technology Trends Outlook and operating model practice that align with {{company}}'s digital agenda.\n\nLet me know what resonates.",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-02-25T09:30:00Z"),
    sendStartedAt: new Date("2026-02-25T09:29:50Z"),
    createdAt: new Date("2026-02-24T16:00:00Z"),
    updatedAt: new Date("2026-02-25T09:30:00Z"),
  });
  campaignContents.push(
    { id: nextCc(), campaignId: c8, contentItemId: "ci-art-008", position: 0 },
    { id: nextCc(), campaignId: c8, contentItemId: "ci-art-009", position: 1 }
  );
  const c8Rec = jordan.slice(3, 7);
  for (let i = 0; i < c8Rec.length; i++) {
    const rId = `cr-${pad3(8)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c8,
      contactId: c8Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-02-25T09:30:00Z"),
    });
    if (i < 3) {
      engagements.push({
        id: `ce-${pad3(8)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-02-25T${pad2(11 + i)}:15:00Z`),
      });
    }
    if (i < 2) {
      engagements.push({
        id: `ce-${pad3(8)}-${i}-click`,
        recipientId: rId,
        type: "CLICKED",
        contentItemId: i === 0 ? "ci-art-008" : "ci-art-009",
        timestamp: new Date(`2026-02-25T${pad2(12 + i)}:30:00Z`),
      });
    }
  }

  const c9 = "camp-mock-009";
  campaigns.push({
    id: c9,
    partnerId: "p-jordan-kim",
    name: "CEO Leadership Forum — Invite",
    subject: "Invitation: McKinsey CEO Leadership Forum (Sep 18, Washington, DC)",
    bodyTemplate:
      "Hi {{name}},\n\nI'd be honored to invite you to our CEO Leadership Forum. The conversation will focus on macro themes and leadership — highly relevant for {{company}}.\n\nPlease RSVP below.",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-02T10:00:00Z"),
    sendStartedAt: new Date("2026-03-02T09:59:50Z"),
    createdAt: new Date("2026-03-01T11:00:00Z"),
    updatedAt: new Date("2026-03-02T10:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c9,
    contentItemId: "ci-evt-005",
    position: 0,
  });
  const c9Rec = jordan.slice(0, 6);
  const c9Rsvp: (string | null)[] = [
    "ACCEPTED",
    "ACCEPTED",
    "ACCEPTED",
    "ACCEPTED",
    "DECLINED",
    null,
  ];
  for (let i = 0; i < c9Rec.length; i++) {
    const rId = `cr-${pad3(9)}-${i}`;
    const token = `rsvp-${c9}-${i}`;
    const st = c9Rsvp[i];
    recipients.push({
      id: rId,
      campaignId: c9,
      contactId: c9Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-02T10:00:00Z"),
      rsvpToken: token,
      rsvpStatus: st ?? undefined,
      rsvpRespondedAt: st ? new Date(`2026-03-0${3 + i}T16:00:00Z`) : undefined,
    });
    if (i < 5) {
      engagements.push({
        id: `ce-${pad3(9)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-02T${pad2(11 + i)}:00:00Z`),
      });
    }
    if (st === "ACCEPTED") {
      engagements.push({
        id: `ce-${pad3(9)}-${i}-rsvp`,
        recipientId: rId,
        type: "EVENT_REGISTERED",
        contentItemId: "ci-evt-005",
        timestamp: new Date(`2026-03-0${3 + i}T16:00:00Z`),
      });
    }
  }

  const c10 = "camp-mock-010";
  campaigns.push({
    id: c10,
    partnerId: "p-jordan-kim",
    name: "Cybersecurity Insights Draft",
    subject: "Draft: Cybersecurity in the age of generative AI",
    bodyTemplate:
      "Hi {{name}},\n\nSharing a draft note on cyber risk as GenAI scales — would love your perspective before wider distribution.\n\nThanks,\nJordan",
    source: "ACTIVATE",
    status: "DRAFT",
    createdAt: new Date("2026-03-29T18:00:00Z"),
    updatedAt: new Date("2026-03-29T18:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c10,
    contentItemId: "ci-art-010",
    position: 0,
  });
  const c10Rec = jordan.slice(0, 3);
  for (let i = 0; i < c10Rec.length; i++) {
    recipients.push({
      id: `cr-${pad3(10)}-${i}`,
      campaignId: c10,
      contactId: c10Rec[i].id,
      status: "PENDING",
    });
  }

  // --- Sam Rivera (011–013) ---

  const c11 = "camp-mock-011";
  campaigns.push({
    id: c11,
    partnerId: "p-sam-rivera",
    name: "AI Impact Gap Research",
    subject: "Closing the AI impact gap — new research",
    bodyTemplate:
      "Hi {{name}},\n\nThis piece on moving from pilots to profit at {{company}}-scale may be useful for your next AI steering committee.\n\nOpen to a quick call.",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-05T13:00:00Z"),
    sendStartedAt: new Date("2026-03-05T12:59:50Z"),
    createdAt: new Date("2026-03-04T10:00:00Z"),
    updatedAt: new Date("2026-03-05T13:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c11,
    contentItemId: "ci-art-012",
    position: 0,
  });
  const c11Rec = sam.slice(0, 5);
  for (let i = 0; i < c11Rec.length; i++) {
    const rId = `cr-${pad3(11)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c11,
      contactId: c11Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-05T13:00:00Z"),
    });
    if (i < 4) {
      engagements.push({
        id: `ce-${pad3(11)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-05T${pad2(14 + i)}:10:00Z`),
      });
    }
    if (i < 3) {
      engagements.push({
        id: `ce-${pad3(11)}-${i}-click`,
        recipientId: rId,
        type: "CLICKED",
        contentItemId: "ci-art-012",
        timestamp: new Date(`2026-03-06T${pad2(9 + i)}:30:00Z`),
      });
    }
  }

  const c12 = "camp-mock-012";
  campaigns.push({
    id: c12,
    partnerId: "p-sam-rivera",
    name: "CFO Forum — Invite",
    subject: "Invitation: McKinsey CFO Forum (Aug 5, Boston, Hybrid)",
    bodyTemplate:
      "Hi {{name}},\n\nI'd like to invite you to our CFO Forum. The agenda is built around capital allocation and transformation — timely for {{company}}.\n\nRSVP below.",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-12T08:00:00Z"),
    sendStartedAt: new Date("2026-03-12T07:59:50Z"),
    createdAt: new Date("2026-03-11T14:00:00Z"),
    updatedAt: new Date("2026-03-12T08:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c12,
    contentItemId: "ci-evt-006",
    position: 0,
  });
  const c12Rec = sam.slice(2, 6);
  const c12Rsvp: (string | null)[] = ["ACCEPTED", "ACCEPTED", "DECLINED", null];
  for (let i = 0; i < c12Rec.length; i++) {
    const rId = `cr-${pad3(12)}-${i}`;
    const token = `rsvp-${c12}-${i}`;
    const st = c12Rsvp[i];
    recipients.push({
      id: rId,
      campaignId: c12,
      contactId: c12Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-12T08:00:00Z"),
      rsvpToken: token,
      rsvpStatus: st ?? undefined,
      rsvpRespondedAt: st ? new Date(`2026-03-1${3 + i}T16:00:00Z`) : undefined,
    });
    if (i < 3) {
      engagements.push({
        id: `ce-${pad3(12)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-12T${pad2(10 + i)}:00:00Z`),
      });
    }
    if (st === "ACCEPTED") {
      engagements.push({
        id: `ce-${pad3(12)}-${i}-rsvp`,
        recipientId: rId,
        type: "EVENT_REGISTERED",
        contentItemId: "ci-evt-006",
        timestamp: new Date(`2026-03-1${3 + i}T16:00:00Z`),
      });
    }
  }

  const c13 = "camp-mock-013";
  campaigns.push({
    id: c13,
    partnerId: "p-sam-rivera",
    name: "TMT-EU--Article-Tech Outlook",
    source: "IMPORTED",
    status: "SENT",
    importedFrom: "Salesforce MC",
    sentAt: new Date("2026-02-28T11:00:00Z"),
    createdAt: new Date("2026-02-28T11:00:00Z"),
    updatedAt: new Date("2026-02-28T11:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c13,
    contentItemId: "ci-art-008",
    position: 0,
  });
  const c13Rec = sam.slice(4, 7);
  for (let i = 0; i < c13Rec.length; i++) {
    const rId = `cr-${pad3(13)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c13,
      contactId: c13Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-02-28T11:00:00Z"),
    });
    if (i < 2) {
      engagements.push({
        id: `ce-${pad3(13)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-02-28T${pad2(13 + i)}:00:00Z`),
      });
    }
    if (i < 1) {
      engagements.push({
        id: `ce-${pad3(13)}-${i}-click`,
        recipientId: rId,
        type: "CLICKED",
        contentItemId: "ci-art-008",
        timestamp: new Date(`2026-03-01T09:00:00Z`),
      });
    }
  }

  // --- Morgan Chen (014–017) ---

  const c14 = "camp-mock-014";
  campaigns.push({
    id: c14,
    partnerId: "p-morgan-chen",
    name: "GenAI CEO Guide",
    subject: "Two short reads for CEOs navigating the AI era",
    bodyTemplate:
      "Hi {{name}},\n\nPairing our CEO guide with a practical strategy piece — both speak to questions we're hearing from boards at {{company}}.\n\nWarmly,\nMorgan",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-08T09:00:00Z"),
    sendStartedAt: new Date("2026-03-08T08:59:50Z"),
    createdAt: new Date("2026-03-07T12:00:00Z"),
    updatedAt: new Date("2026-03-08T09:00:00Z"),
  });
  campaignContents.push(
    { id: nextCc(), campaignId: c14, contentItemId: "ci-art-002", position: 0 },
    { id: nextCc(), campaignId: c14, contentItemId: "ci-art-011", position: 1 }
  );
  const c14Rec = morgan.slice(0, 6);
  for (let i = 0; i < c14Rec.length; i++) {
    const rId = `cr-${pad3(14)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c14,
      contactId: c14Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-08T09:00:00Z"),
    });
    if (i < 5) {
      engagements.push({
        id: `ce-${pad3(14)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-08T${pad2(10 + i)}:20:00Z`),
      });
    }
    if (i < 4) {
      engagements.push({
        id: `ce-${pad3(14)}-${i}-click`,
        recipientId: rId,
        type: "CLICKED",
        contentItemId: i % 2 === 0 ? "ci-art-002" : "ci-art-011",
        timestamp: new Date(`2026-03-08T${pad2(11 + i)}:45:00Z`),
      });
    }
  }

  const c15 = "camp-mock-015";
  campaigns.push({
    id: c15,
    partnerId: "p-morgan-chen",
    name: "Solar & Clean Energy Update",
    subject: "Solar delivery — research relevant to your energy transition work",
    bodyTemplate:
      "Hi {{name}},\n\nI came across this piece on solar project delivery and thought of {{company}}'s clean-energy priorities.\n\nLet me know if you'd like a deeper dive.",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-16T14:30:00Z"),
    sendStartedAt: new Date("2026-03-16T14:29:50Z"),
    createdAt: new Date("2026-03-15T09:00:00Z"),
    updatedAt: new Date("2026-03-16T14:30:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c15,
    contentItemId: "ci-art-007",
    position: 0,
  });
  const c15Rec = morgan.slice(3, 6);
  for (let i = 0; i < c15Rec.length; i++) {
    const rId = `cr-${pad3(15)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c15,
      contactId: c15Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-16T14:30:00Z"),
    });
    if (i < 2) {
      engagements.push({
        id: `ce-${pad3(15)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-16T${pad2(15 + i)}:00:00Z`),
      });
    }
    if (i < 1) {
      engagements.push({
        id: `ce-${pad3(15)}-${i}-read`,
        recipientId: rId,
        type: "ARTICLE_READ",
        contentItemId: "ci-art-007",
        timestamp: new Date(`2026-03-17T10:00:00Z`),
      });
    }
  }

  const c16 = "camp-mock-016";
  campaigns.push({
    id: c16,
    partnerId: "p-morgan-chen",
    name: "Q2 Relationship Check-in",
    subject: "Q2 — quick relationship check-in",
    bodyTemplate:
      "Hi {{name}},\n\nAs we move into Q2, I wanted to check in and see how I can support you and the team at {{company}}.\n\nMorgan",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-22T10:00:00Z"),
    sendStartedAt: new Date("2026-03-22T09:59:50Z"),
    createdAt: new Date("2026-03-21T14:00:00Z"),
    updatedAt: new Date("2026-03-22T10:00:00Z"),
  });
  const c16Rec = morgan.slice(0, 4);
  for (let i = 0; i < c16Rec.length; i++) {
    const rId = `cr-${pad3(16)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c16,
      contactId: c16Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-22T10:00:00Z"),
    });
    if (i < 3) {
      engagements.push({
        id: `ce-${pad3(16)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-22T${pad2(11 + i)}:30:00Z`),
      });
    }
  }

  const c17 = "camp-mock-017";
  campaigns.push({
    id: c17,
    partnerId: "p-morgan-chen",
    name: "PE Summit — Invite",
    subject: "Invitation: McKinsey PE Operating Partners Summit",
    bodyTemplate:
      "Hi {{name}},\n\nI would love to invite you to our PE Operating Partners Summit — highly relevant for {{company}}'s portfolio work.\n\nPlease RSVP using the link below.",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-26T09:00:00Z"),
    sendStartedAt: new Date("2026-03-26T08:59:50Z"),
    createdAt: new Date("2026-03-25T12:00:00Z"),
    updatedAt: new Date("2026-03-26T09:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c17,
    contentItemId: "ci-evt-007",
    position: 0,
  });
  const c17Rec = morgan.slice(0, 5);
  for (let i = 0; i < c17Rec.length; i++) {
    const rId = `cr-${pad3(17)}-${i}`;
    const token = `rsvp-${c17}-${i}`;
    let rsvpStatus: string | undefined;
    let rsvpAt: Date | undefined;
    if (i < 3) {
      rsvpStatus = "ACCEPTED";
      rsvpAt = new Date(`2026-03-${pad2(27 + i)}T15:00:00Z`);
    } else if (i === 3) {
      rsvpStatus = undefined;
    } else {
      rsvpStatus = undefined;
    }
    recipients.push({
      id: rId,
      campaignId: c17,
      contactId: c17Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-26T09:00:00Z"),
      rsvpToken: token,
      rsvpStatus,
      rsvpRespondedAt: rsvpAt,
    });
    if (i < 4) {
      engagements.push({
        id: `ce-${pad3(17)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-26T${pad2(10 + i)}:30:00Z`),
      });
    }
    if (rsvpStatus === "ACCEPTED") {
      engagements.push({
        id: `ce-${pad3(17)}-${i}-rsvp`,
        recipientId: rId,
        type: "EVENT_REGISTERED",
        contentItemId: "ci-evt-007",
        timestamp: rsvpAt!,
      });
    }
  }

  // --- Taylor Brooks (018–020) ---

  const c18 = "camp-mock-018";
  campaigns.push({
    id: c18,
    partnerId: "p-taylor-brooks",
    name: "Economic Potential of GenAI",
    subject: "The economic potential of generative AI — new analysis",
    bodyTemplate:
      "Hi {{name}},\n\nSharing McKinsey's latest view on the economic potential of GenAI — useful context for {{company}}'s investment planning.\n\nTaylor",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-02-22T13:00:00Z"),
    sendStartedAt: new Date("2026-02-22T12:59:50Z"),
    createdAt: new Date("2026-02-21T10:00:00Z"),
    updatedAt: new Date("2026-02-22T13:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c18,
    contentItemId: "ci-art-001",
    position: 0,
  });
  const c18Rec = taylor.slice(0, 4);
  for (let i = 0; i < c18Rec.length; i++) {
    const rId = `cr-${pad3(18)}-${i}`;
    recipients.push({
      id: rId,
      campaignId: c18,
      contactId: c18Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-02-22T13:00:00Z"),
    });
    if (i < 3) {
      engagements.push({
        id: `ce-${pad3(18)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-02-22T${pad2(14 + i)}:00:00Z`),
      });
    }
    if (i < 2) {
      engagements.push({
        id: `ce-${pad3(18)}-${i}-click`,
        recipientId: rId,
        type: "CLICKED",
        contentItemId: "ci-art-001",
        timestamp: new Date(`2026-02-23T10:00:00Z`),
      });
    }
  }

  const c19 = "camp-mock-019";
  campaigns.push({
    id: c19,
    partnerId: "p-taylor-brooks",
    name: "Supply Chain Leaders Forum — Invite",
    subject: "Invitation: Supply Chain Leaders Forum (May 28, Atlanta)",
    bodyTemplate:
      "Hi {{name}},\n\nI'd love to invite you to our Supply Chain Leaders Forum — timely given {{company}}'s operations footprint.\n\nRSVP below.",
    source: "ACTIVATE",
    status: "SENT",
    sentAt: new Date("2026-03-10T08:00:00Z"),
    sendStartedAt: new Date("2026-03-10T07:59:50Z"),
    createdAt: new Date("2026-03-09T10:00:00Z"),
    updatedAt: new Date("2026-03-10T08:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c19,
    contentItemId: "ci-evt-008",
    position: 0,
  });
  const c19Rec = taylor.slice(1, 6);
  const c19Rsvp: (string | null)[] = [
    "ACCEPTED",
    "ACCEPTED",
    "ACCEPTED",
    "DECLINED",
    null,
  ];
  for (let i = 0; i < c19Rec.length; i++) {
    const rId = `cr-${pad3(19)}-${i}`;
    const token = `rsvp-${c19}-${i}`;
    const st = c19Rsvp[i];
    recipients.push({
      id: rId,
      campaignId: c19,
      contactId: c19Rec[i].id,
      status: "SENT",
      sentAt: new Date("2026-03-10T08:00:00Z"),
      rsvpToken: token,
      rsvpStatus: st ?? undefined,
      rsvpRespondedAt: st ? new Date(`2026-03-1${1 + i}T14:00:00Z`) : undefined,
    });
    if (i < 4) {
      engagements.push({
        id: `ce-${pad3(19)}-${i}-open`,
        recipientId: rId,
        type: "OPENED",
        timestamp: new Date(`2026-03-10T${pad2(9 + i)}:30:00Z`),
      });
    }
    if (st === "ACCEPTED") {
      engagements.push({
        id: `ce-${pad3(19)}-${i}-rsvp`,
        recipientId: rId,
        type: "EVENT_REGISTERED",
        contentItemId: "ci-evt-008",
        timestamp: new Date(`2026-03-1${1 + i}T14:00:00Z`),
      });
    }
  }

  const c20 = "camp-mock-020";
  campaigns.push({
    id: c20,
    partnerId: "p-taylor-brooks",
    name: "AI Analytics Summit Draft",
    subject: "Draft: AI & Analytics Summit invitation",
    bodyTemplate:
      "Hi {{name}},\n\nDrafting an invite to the AI & Analytics Summit — would love your feedback before we send broadly.\n\nTaylor",
    source: "ACTIVATE",
    status: "DRAFT",
    createdAt: new Date("2026-03-27T16:00:00Z"),
    updatedAt: new Date("2026-03-27T16:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: c20,
    contentItemId: "ci-evt-001",
    position: 0,
  });
  const c20Rec = taylor.slice(0, 4);
  for (let i = 0; i < c20Rec.length; i++) {
    recipients.push({
      id: `cr-${pad3(20)}-${i}`,
      campaignId: c20,
      contactId: c20Rec[i].id,
      status: "PENDING",
    });
  }

  // ===================================================================
  // CENTRAL CAMPAIGNS — 1-2 per partner, cross-partner assignment
  // ===================================================================

  const approvalDeadline7 = new Date("2026-04-09T23:59:59Z");
  const approvalDeadline14 = new Date("2026-04-16T23:59:59Z");
  const approvalDeadline3 = new Date("2026-04-05T23:59:59Z");

  // --- Central Campaign 1: Global Energy Forum (PENDING_APPROVAL) ---
  // Assigned to Ava, Jordan, Morgan — mix of PENDING/APPROVED
  const cc1 = "camp-central-001";
  campaigns.push({
    id: cc1,
    partnerId: "p-ava-patel",
    name: "McKinsey Global Energy Forum — Invite",
    subject: "You're invited: McKinsey Global Energy Forum (Jun 12, London)",
    bodyTemplate:
      "Hi {{name}},\n\nOn behalf of McKinsey's Energy & Materials Practice, I'd like to personally invite you to our Global Energy Forum in London this June.\n\nGiven {{company}}'s strategic priorities, I think you'd find the sessions on energy transition especially valuable.\n\nPlease RSVP below.",
    source: "CENTRAL",
    status: "PENDING_APPROVAL",
    pointOfContact: "Sarah Mitchell, Global Events Lead",
    createdAt: new Date("2026-03-30T10:00:00Z"),
    updatedAt: new Date("2026-03-30T10:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: cc1,
    contentItemId: "ci-evt-001",
    position: 0,
  });
  const cc1Contacts = [
    ...ava.slice(0, 5),
    ...jordan.slice(0, 4),
    ...morgan.slice(0, 3),
  ];
  const cc1Partners = [
    "p-ava-patel", "p-ava-patel", "p-ava-patel", "p-ava-patel", "p-ava-patel",
    "p-jordan-kim", "p-jordan-kim", "p-jordan-kim", "p-jordan-kim",
    "p-morgan-chen", "p-morgan-chen", "p-morgan-chen",
  ];
  const cc1Approvals: (string | null)[] = [
    "APPROVED", "PENDING", "PENDING", "PENDING", "APPROVED",
    "APPROVED", "APPROVED", "PENDING", "PENDING",
    "PENDING", "PENDING", "APPROVED",
  ];
  for (let i = 0; i < cc1Contacts.length; i++) {
    const c = cc1Contacts[i];
    recipients.push({
      id: `cr-central-001-${i}`,
      campaignId: cc1,
      contactId: c.id,
      status: "PENDING",
      assignedPartnerId: cc1Partners[i],
      approvalStatus: cc1Approvals[i],
      approvalDeadline: approvalDeadline7,
      personalizedBody: `Hi ${c.name.split(" ")[0]},\n\nOn behalf of McKinsey's Energy & Materials Practice, I'd like to personally invite you to our Global Energy Forum in London this June.\n\nGiven your role as ${c.title}, I think you'd find the sessions on energy transition especially valuable.\n\nPlease RSVP below.`,
    });
  }

  // --- Central Campaign 2: Q2 Thought Leadership (PENDING_APPROVAL) ---
  // Assigned to Sam, Taylor — all still PENDING
  const cc2 = "camp-central-002";
  campaigns.push({
    id: cc2,
    partnerId: "p-ava-patel",
    name: "Q2 Thought Leadership: Digital Transformation",
    subject: "Sharing McKinsey's latest on digital transformation",
    bodyTemplate:
      "Hi {{name}},\n\nI wanted to share our latest thinking on digital transformation — particularly relevant given {{company}}'s strategic agenda.\n\nHappy to discuss further.",
    source: "CENTRAL",
    status: "PENDING_APPROVAL",
    pointOfContact: "David Park, Content Marketing",
    createdAt: new Date("2026-03-31T09:00:00Z"),
    updatedAt: new Date("2026-03-31T09:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: cc2,
    contentItemId: "ci-art-008",
    position: 0,
  });
  const cc2Contacts = [
    ...sam.slice(0, 5),
    ...taylor.slice(0, 4),
  ];
  const cc2Partners = [
    "p-sam-rivera", "p-sam-rivera", "p-sam-rivera", "p-sam-rivera", "p-sam-rivera",
    "p-taylor-brooks", "p-taylor-brooks", "p-taylor-brooks", "p-taylor-brooks",
  ];
  const cc2Approvals: (string | null)[] = [
    "PENDING", "PENDING", "APPROVED", "PENDING", "PENDING",
    "PENDING", "PENDING", "APPROVED", "PENDING",
  ];
  for (let i = 0; i < cc2Contacts.length; i++) {
    const c = cc2Contacts[i];
    recipients.push({
      id: `cr-central-002-${i}`,
      campaignId: cc2,
      contactId: c.id,
      status: "PENDING",
      assignedPartnerId: cc2Partners[i],
      approvalStatus: cc2Approvals[i],
      approvalDeadline: approvalDeadline14,
      personalizedBody: `Hi ${c.name.split(" ")[0]},\n\nI wanted to share our latest thinking on digital transformation — particularly relevant given your strategic agenda as ${c.title}.\n\nHappy to discuss further.`,
    });
  }

  // --- Central Campaign 3: AI Leaders Summit (PENDING_APPROVAL, near deadline) ---
  // Assigned to Ava, Sam — mostly APPROVED, one PENDING
  const cc3 = "camp-central-003";
  campaigns.push({
    id: cc3,
    partnerId: "p-ava-patel",
    name: "AI Leaders Summit — Exclusive Invite",
    subject: "Exclusive invitation: McKinsey AI Leaders Summit (May 8, NYC)",
    bodyTemplate:
      "Hi {{name}},\n\nYou're among a select group of leaders invited to our AI Leaders Summit in New York this May.\n\nThe agenda covers practical AI scaling strategies that align with {{company}}'s goals.\n\nWe'd love to see you there.",
    source: "CENTRAL",
    status: "PENDING_APPROVAL",
    pointOfContact: "Sarah Mitchell, Global Events Lead",
    createdAt: new Date("2026-03-28T14:00:00Z"),
    updatedAt: new Date("2026-03-28T14:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: cc3,
    contentItemId: "ci-evt-004",
    position: 0,
  });
  const cc3Contacts = [
    ...ava.slice(3, 7),
    ...sam.slice(3, 6),
    ...jordan.slice(0, 2),
  ];
  const cc3Partners = [
    "p-ava-patel", "p-ava-patel", "p-ava-patel", "p-ava-patel",
    "p-sam-rivera", "p-sam-rivera", "p-sam-rivera",
    "p-jordan-kim", "p-jordan-kim",
  ];
  const cc3Approvals: (string | null)[] = [
    "APPROVED", "APPROVED", "PENDING", "PENDING",
    "APPROVED", "PENDING", "APPROVED",
    "APPROVED", "PENDING",
  ];
  for (let i = 0; i < cc3Contacts.length; i++) {
    if (!cc3Contacts[i]) continue;
    const c = cc3Contacts[i];
    recipients.push({
      id: `cr-central-003-${i}`,
      campaignId: cc3,
      contactId: c.id,
      status: "PENDING",
      assignedPartnerId: cc3Partners[i],
      approvalStatus: cc3Approvals[i],
      approvalDeadline: approvalDeadline3,
      personalizedBody: `Hi ${c.name.split(" ")[0]},\n\nYou're among a select group of leaders invited to our AI Leaders Summit in New York this May.\n\nThe agenda covers practical AI scaling strategies that align with your work as ${c.title}.\n\nWe'd love to see you there.`,
    });
  }

  // --- Central Campaign 4: CFO Outlook (PENDING_APPROVAL) ---
  // Assigned to Morgan, Taylor
  const cc4 = "camp-central-004";
  campaigns.push({
    id: cc4,
    partnerId: "p-ava-patel",
    name: "CFO Outlook Series — Personalized Invite",
    subject: "McKinsey CFO Outlook: Capital allocation in an uncertain world",
    bodyTemplate:
      "Hi {{name}},\n\nOur CFO Outlook Series is exploring capital allocation strategies under uncertainty — a topic I know is top of mind for {{company}}.\n\nI'd love for you to join us.",
    source: "CENTRAL",
    status: "PENDING_APPROVAL",
    pointOfContact: "Rachel Foster, CFO Practice Marketing",
    createdAt: new Date("2026-04-01T08:00:00Z"),
    updatedAt: new Date("2026-04-01T08:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: cc4,
    contentItemId: "ci-evt-006",
    position: 0,
  });
  const cc4Contacts = [
    ...morgan.slice(2, 6),
    ...taylor.slice(2, 6),
  ];
  const cc4Partners = [
    "p-morgan-chen", "p-morgan-chen", "p-morgan-chen", "p-morgan-chen",
    "p-taylor-brooks", "p-taylor-brooks", "p-taylor-brooks", "p-taylor-brooks",
  ];
  const cc4Approvals: (string | null)[] = [
    "PENDING", "APPROVED", "PENDING", "PENDING",
    "PENDING", "PENDING", "APPROVED", "PENDING",
  ];
  for (let i = 0; i < cc4Contacts.length; i++) {
    if (!cc4Contacts[i]) continue;
    const c = cc4Contacts[i];
    recipients.push({
      id: `cr-central-004-${i}`,
      campaignId: cc4,
      contactId: c.id,
      status: "PENDING",
      assignedPartnerId: cc4Partners[i],
      approvalStatus: cc4Approvals[i],
      approvalDeadline: approvalDeadline7,
      personalizedBody: `Hi ${c.name.split(" ")[0]},\n\nOur CFO Outlook Series is exploring capital allocation strategies under uncertainty — a topic I know is top of mind given your role as ${c.title}.\n\nI'd love for you to join us.`,
    });
  }

  // --- Central Campaign 5: Cybersecurity Roundtable (PENDING_APPROVAL) ---
  // Assigned to Jordan, Taylor — mix
  const cc5 = "camp-central-005";
  campaigns.push({
    id: cc5,
    partnerId: "p-ava-patel",
    name: "Cybersecurity Executive Roundtable — Invite",
    subject: "Invitation: Cybersecurity Executive Roundtable (Jun 5, Virtual)",
    bodyTemplate:
      "Hi {{name}},\n\nCyber risk is top of mind for every board. I'd like to invite you to our upcoming Cybersecurity Roundtable — a small-group conversation with peers navigating similar challenges at {{company}}.\n\nPlease RSVP below.",
    source: "CENTRAL",
    status: "PENDING_APPROVAL",
    pointOfContact: "James Wu, Cybersecurity Practice Marketing",
    createdAt: new Date("2026-04-01T11:00:00Z"),
    updatedAt: new Date("2026-04-01T11:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: cc5,
    contentItemId: "ci-art-010",
    position: 0,
  });
  const cc5Contacts = [
    ...jordan.slice(2, 6),
    ...taylor.slice(0, 4),
  ];
  const cc5Partners = [
    "p-jordan-kim", "p-jordan-kim", "p-jordan-kim", "p-jordan-kim",
    "p-taylor-brooks", "p-taylor-brooks", "p-taylor-brooks", "p-taylor-brooks",
  ];
  const cc5Approvals: (string | null)[] = [
    "PENDING", "APPROVED", "PENDING", "PENDING",
    "APPROVED", "PENDING", "PENDING", "APPROVED",
  ];
  for (let i = 0; i < cc5Contacts.length; i++) {
    if (!cc5Contacts[i]) continue;
    const c = cc5Contacts[i];
    recipients.push({
      id: `cr-central-005-${i}`,
      campaignId: cc5,
      contactId: c.id,
      status: "PENDING",
      assignedPartnerId: cc5Partners[i],
      approvalStatus: cc5Approvals[i],
      approvalDeadline: approvalDeadline14,
      personalizedBody: `Hi ${c.name.split(" ")[0]},\n\nCyber risk is top of mind for every board. I'd like to invite you to our upcoming Cybersecurity Roundtable — a small-group conversation with peers navigating similar challenges in your role as ${c.title}.\n\nPlease RSVP below.`,
    });
  }

  // --- Central Campaign 6: Sustainability Insights (IN_PROGRESS — fully approved) ---
  // Assigned to Morgan, Sam — all APPROVED, already moved to IN_PROGRESS
  const cc6 = "camp-central-006";
  campaigns.push({
    id: cc6,
    partnerId: "p-ava-patel",
    name: "Sustainability & ESG Insights — Personalized Share",
    subject: "New McKinsey research: Sustainability leadership in practice",
    bodyTemplate:
      "Hi {{name}},\n\nSharing our latest research on sustainability leadership — timely for {{company}}'s ESG commitments.\n\nWould love to hear your thoughts.",
    source: "CENTRAL",
    status: "IN_PROGRESS",
    pointOfContact: "Lisa Novak, Sustainability Practice Marketing",
    sendStartedAt: new Date("2026-04-01T15:00:00Z"),
    createdAt: new Date("2026-03-27T10:00:00Z"),
    updatedAt: new Date("2026-04-01T15:00:00Z"),
  });
  campaignContents.push({
    id: nextCc(),
    campaignId: cc6,
    contentItemId: "ci-art-007",
    position: 0,
  });
  const cc6Contacts = [
    ...morgan.slice(0, 3),
    ...sam.slice(1, 4),
  ];
  const cc6Partners = [
    "p-morgan-chen", "p-morgan-chen", "p-morgan-chen",
    "p-sam-rivera", "p-sam-rivera", "p-sam-rivera",
  ];
  for (let i = 0; i < cc6Contacts.length; i++) {
    const c = cc6Contacts[i];
    recipients.push({
      id: `cr-central-006-${i}`,
      campaignId: cc6,
      contactId: c.id,
      status: "PENDING",
      assignedPartnerId: cc6Partners[i],
      approvalStatus: "APPROVED",
      approvalDeadline: new Date("2026-03-31T23:59:59Z"),
      personalizedBody: `Hi ${c.name.split(" ")[0]},\n\nSharing our latest research on sustainability leadership — timely given your work as ${c.title}.\n\nWould love to hear your thoughts.`,
    });
  }

  return { campaigns, campaignContents, recipients, engagements };
}

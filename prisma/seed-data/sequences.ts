interface ContactRef {
  id: string;
  name: string;
  companyId: string;
  partnerId: string;
  title: string;
}

function findContact(contacts: ContactRef[], name: string): ContactRef | undefined {
  return contacts.find((c) => c.name === name);
}

function daysAgo(d: number): Date {
  return new Date(Date.now() - d * 86_400_000);
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000);
}

const TYPE_LABELS: Record<string, string> = {
  COMPANY_NEWS: "company news",
  LINKEDIN_ACTIVITY: "LinkedIn activity",
  JOB_CHANGE: "executive transition",
  UPCOMING_EVENT: "upcoming event",
  EVENT_ATTENDED: "event follow-up",
  ARTICLE_READ: "content engagement",
};

export function generateSequenceData(contacts: ContactRef[]) {
  const now = new Date();

  // ── Contacts for REPLY_NEEDED (inbound unreplied emails) ──────────

  const inboundTargets: {
    name: string;
    daysAgo: number;
    summary: string;
  }[] = [
    {
      name: "Satya Nadella",
      daysAgo: 2,
      summary:
        "Satya sent a note asking about the Q2 digital transformation timeline and whether the team can present preliminary findings at their next leadership offsite.",
    },
    {
      name: "Jamie Dimon",
      daysAgo: 3,
      summary:
        "Jamie's office shared an updated compliance roadmap for the Asia-Pacific expansion and asked for our perspective on regulatory readiness.",
    },
    {
      name: "Marc Benioff",
      daysAgo: 1,
      summary:
        "Marc forwarded an internal strategy memo on Agentforce go-to-market and asked if we could schedule a working session next week.",
    },
    {
      name: "Jensen Huang",
      daysAgo: 4,
      summary:
        "Jensen's team sent over their updated datacenter capacity projections and requested feedback on the infrastructure scaling model.",
    },
    {
      name: "Ted Sarandos",
      daysAgo: 2,
      summary:
        "Ted reached out about the content monetization analysis we discussed at dinner — wants to loop in the finance team for a deeper look.",
    },
  ];

  const inboundInteractions: {
    id: string;
    contactId: string;
    type: string;
    date: Date;
    summary: string;
    sentiment: string;
    nextStep: string | null;
    direction: string;
    repliedAt: null;
  }[] = [];

  let inboundIdx = 0;
  for (const target of inboundTargets) {
    const contact = findContact(contacts, target.name);
    if (!contact) continue;
    inboundInteractions.push({
      id: `int-inbound-${String(inboundIdx).padStart(3, "0")}`,
      contactId: contact.id,
      type: "EMAIL",
      date: daysAgo(target.daysAgo),
      summary: target.summary,
      sentiment: "POSITIVE",
      nextStep: `Reply to ${contact.name.split(" ")[0]}'s email`,
      direction: "INBOUND",
      repliedAt: null,
    });
    inboundIdx++;
  }

  // ── Outbound email history ────────────────────────────────────────

  const outboundTargets: {
    name: string;
    daysAgo: number;
    summary: string;
  }[] = [
    {
      name: "Thomas Kurian",
      daysAgo: 3,
      summary:
        "Sent initial outreach about a potential cloud migration partnership and shared relevant case studies from the financial services sector.",
    },
    {
      name: "Colette Kress",
      daysAgo: 5,
      summary:
        "Sent second follow-up on GPU allocation forecasting and offered to connect their team with our supply-chain analytics practice.",
    },
    {
      name: "Colette Kress",
      daysAgo: 12,
      summary:
        "Sent initial email regarding NVIDIA's Q3 earnings insights and proposed a strategic review of their investor relations approach.",
    },
    {
      name: "Amy Hood",
      daysAgo: 2,
      summary:
        "Shared the executive summary of our cloud cost optimization framework with Amy and her finance leadership team.",
    },
    {
      name: "Ruth Porat",
      daysAgo: 7,
      summary:
        "Sent a thoughtful note on Alphabet's infrastructure capital allocation strategy and suggested a follow-up meeting.",
    },
    {
      name: "Marianne Lake",
      daysAgo: 10,
      summary:
        "Shared our latest fintech disruption report with Marianne and proposed a working session on digital banking trends.",
    },
    {
      name: "Robin Washington",
      daysAgo: 1,
      summary:
        "Sent introductory note after their recent CFO appointment, offering congratulations and our perspective on Salesforce's growth trajectory.",
    },
    {
      name: "Spencer Neumann",
      daysAgo: 14,
      summary:
        "Shared detailed benchmarking analysis on streaming platform unit economics compared to peers.",
    },
  ];

  const outboundInteractions: {
    id: string;
    contactId: string;
    type: string;
    date: Date;
    summary: string;
    sentiment: string;
    nextStep: string | null;
    direction: string;
  }[] = [];

  let outboundIdx = 0;
  for (const target of outboundTargets) {
    const contact = findContact(contacts, target.name);
    if (!contact) continue;
    outboundInteractions.push({
      id: `int-outbound-${String(outboundIdx).padStart(3, "0")}`,
      contactId: contact.id,
      type: "EMAIL",
      date: daysAgo(target.daysAgo),
      summary: target.summary,
      sentiment: "NEUTRAL",
      nextStep: null,
      direction: "OUTBOUND",
    });
    outboundIdx++;
  }

  // ── Active OutreachSequences ──────────────────────────────────────

  const thomasKurian = findContact(contacts, "Thomas Kurian");
  const coletteKress = findContact(contacts, "Colette Kress");
  const parkerHarris = findContact(contacts, "Parker Harris");

  const sequences: {
    id: string;
    contactId: string;
    partnerId: string;
    originNudgeId: string;
    status: string;
    currentStep: number;
    totalSteps: number;
    angleStrategy: string;
    nextStepAt: Date | null;
    createdAt: Date;
  }[] = [];

  const cadenceSteps: {
    id: string;
    sequenceId: string;
    stepNumber: number;
    type: string;
    status: string;
    scheduledAt: Date;
    executedAt: Date | null;
    emailSubject: string | null;
    emailBody: string | null;
    responseDetectedAt: Date | null;
  }[] = [];

  // Sequence 1: Thomas Kurian at Google Cloud — step 0 sent 3 days ago, waiting
  if (thomasKurian) {
    const seqId = "seq-demo-001";
    sequences.push({
      id: seqId,
      contactId: thomasKurian.id,
      partnerId: thomasKurian.partnerId,
      originNudgeId: "nudge-origin-seq1",
      status: "ACTIVE",
      currentStep: 0,
      totalSteps: 4,
      angleStrategy: "value-add",
      nextStepAt: daysAgo(-3),
      createdAt: daysAgo(3),
    });

    cadenceSteps.push(
      {
        id: "step-seq1-0",
        sequenceId: seqId,
        stepNumber: 0,
        type: "INITIAL",
        status: "SENT",
        scheduledAt: daysAgo(3),
        executedAt: daysAgo(3),
        emailSubject: "Cloud migration partnership — relevant case studies",
        emailBody: `Hi Thomas,\n\nI hope this note finds you well. I wanted to share some case studies from our recent work with major financial institutions on cloud migration — I think there are some directly applicable insights for Google Cloud's enterprise push.\n\nWe helped a Top 5 bank reduce their migration timeline by 40% while maintaining compliance across 12 jurisdictions. Given your team's focus on regulated industries, I thought this could be valuable.\n\nWould you have 20 minutes this week or next to discuss? Happy to work around your schedule.\n\nBest regards`,
        responseDetectedAt: null,
      },
      {
        id: "step-seq1-1",
        sequenceId: seqId,
        stepNumber: 1,
        type: "FOLLOW_UP",
        status: "PENDING",
        scheduledAt: daysAgo(-3),
        executedAt: null,
        emailSubject: "Following up — Google Cloud partnership opportunity",
        emailBody: `Hi Thomas,\n\nI wanted to follow up on my earlier note about the cloud migration case studies. I know things move fast at Google Cloud, so completely understand if the timing wasn't right.\n\nI also noticed your keynote at Next '26 — the multi-cloud strategy resonated with what we're seeing across the industry. Would love to share some data points that might be useful for your team's planning.\n\nWould a brief call work this week?\n\nBest`,
        responseDetectedAt: null,
      },
      {
        id: "step-seq1-2",
        sequenceId: seqId,
        stepNumber: 2,
        type: "FOLLOW_UP",
        status: "PENDING",
        scheduledAt: daysAgo(-10),
        executedAt: null,
        emailSubject: null,
        emailBody: null,
        responseDetectedAt: null,
      },
      {
        id: "step-seq1-3",
        sequenceId: seqId,
        stepNumber: 3,
        type: "FOLLOW_UP",
        status: "PENDING",
        scheduledAt: daysAgo(-17),
        executedAt: null,
        emailSubject: null,
        emailBody: null,
        responseDetectedAt: null,
      }
    );
  }

  // Sequence 2: Colette Kress at NVIDIA — two emails sent, waiting 5 days
  if (coletteKress) {
    const seqId = "seq-demo-002";
    sequences.push({
      id: seqId,
      contactId: coletteKress.id,
      partnerId: coletteKress.partnerId,
      originNudgeId: "nudge-origin-seq2",
      status: "ACTIVE",
      currentStep: 1,
      totalSteps: 4,
      angleStrategy: "check-in",
      nextStepAt: daysAgo(-2),
      createdAt: daysAgo(12),
    });

    cadenceSteps.push(
      {
        id: "step-seq2-0",
        sequenceId: seqId,
        stepNumber: 0,
        type: "INITIAL",
        status: "SENT",
        scheduledAt: daysAgo(12),
        executedAt: daysAgo(12),
        emailSubject: "NVIDIA Q3 investor relations — strategic review",
        emailBody: `Hi Colette,\n\nCongratulations on another strong quarter. The GPU demand narrative continues to be compelling, and your team's communication of the datacenter roadmap has been exceptionally clear.\n\nI wanted to reach out because we've been working with several semiconductor CFOs on investor messaging around AI capex cycles — and I think there's an interesting angle for NVIDIA given your unique position.\n\nWould you be open to a brief conversation? I'd love to share what we're seeing across the sector.\n\nBest regards`,
        responseDetectedAt: null,
      },
      {
        id: "step-seq2-1",
        sequenceId: seqId,
        stepNumber: 1,
        type: "FOLLOW_UP",
        status: "SENT",
        scheduledAt: daysAgo(5),
        executedAt: daysAgo(5),
        emailSubject: "GPU allocation forecasting — supply chain insights",
        emailBody: `Hi Colette,\n\nI wanted to follow up on my earlier note and share something that might be more immediately useful. Our supply-chain analytics team recently completed a deep dive on semiconductor allocation patterns — the findings on GPU supply/demand dynamics over the next 18 months are quite revealing.\n\nI'd be happy to share the executive summary or connect you with our team lead on this research.\n\nNo rush at all — just wanted to make sure this was on your radar.\n\nBest`,
        responseDetectedAt: null,
      },
      {
        id: "step-seq2-2",
        sequenceId: seqId,
        stepNumber: 2,
        type: "FOLLOW_UP",
        status: "PENDING",
        scheduledAt: daysAgo(-2),
        executedAt: null,
        emailSubject: null,
        emailBody: null,
        responseDetectedAt: null,
      },
      {
        id: "step-seq2-3",
        sequenceId: seqId,
        stepNumber: 3,
        type: "FOLLOW_UP",
        status: "PENDING",
        scheduledAt: daysAgo(-9),
        executedAt: null,
        emailSubject: null,
        emailBody: null,
        responseDetectedAt: null,
      }
    );
  }

  // Sequence 3: Parker Harris at Salesforce — just created, draft ready but not sent
  if (parkerHarris) {
    const seqId = "seq-demo-003";
    sequences.push({
      id: seqId,
      contactId: parkerHarris.id,
      partnerId: parkerHarris.partnerId,
      originNudgeId: "nudge-origin-seq3",
      status: "ACTIVE",
      currentStep: 0,
      totalSteps: 4,
      angleStrategy: "news-reference",
      nextStepAt: hoursAgo(2),
      createdAt: hoursAgo(6),
    });

    cadenceSteps.push(
      {
        id: "step-seq3-0",
        sequenceId: seqId,
        stepNumber: 0,
        type: "INITIAL",
        status: "PENDING",
        scheduledAt: hoursAgo(2),
        executedAt: null,
        emailSubject: "Agentforce launch — thoughts on the platform strategy",
        emailBody: `Hi Parker,\n\nI saw the Agentforce announcement — incredibly exciting to see Salesforce pushing the agentic AI frontier. The platform-level approach feels like the right bet, especially given what we're seeing in enterprise adoption patterns.\n\nI've been thinking about the developer ecosystem implications and how the partner channel might evolve. We recently published some research on AI platform economics that I think would resonate with your team's thinking.\n\nWould you be open to a quick call to exchange perspectives? I'd genuinely value your take on where the developer tooling is headed.\n\nBest regards`,
        responseDetectedAt: null,
      },
      {
        id: "step-seq3-1",
        sequenceId: seqId,
        stepNumber: 1,
        type: "FOLLOW_UP",
        status: "PENDING",
        scheduledAt: daysAgo(-7),
        executedAt: null,
        emailSubject: null,
        emailBody: null,
        responseDetectedAt: null,
      },
      {
        id: "step-seq3-2",
        sequenceId: seqId,
        stepNumber: 2,
        type: "FOLLOW_UP",
        status: "PENDING",
        scheduledAt: daysAgo(-14),
        executedAt: null,
        emailSubject: null,
        emailBody: null,
        responseDetectedAt: null,
      },
      {
        id: "step-seq3-3",
        sequenceId: seqId,
        stepNumber: 3,
        type: "FOLLOW_UP",
        status: "PENDING",
        scheduledAt: daysAgo(-21),
        executedAt: null,
        emailSubject: null,
        emailBody: null,
        responseDetectedAt: null,
      }
    );
  }

  // ── FOLLOW_UP and REPLY_NEEDED Nudges ─────────────────────────────

  const sequenceNudges: {
    id: string;
    contactId: string;
    ruleType: string;
    reason: string;
    priority: string;
    status: string;
    generatedEmail: string | null;
    metadata: string | null;
    sequenceId: string | null;
    cadenceStepId: string | null;
  }[] = [];

  let nudgeIdx = 0;

  // FOLLOW_UP nudges for active sequences — enriched with signal + interaction context
  if (thomasKurian) {
    sequenceNudges.push({
      id: `nudge-seq-${String(nudgeIdx++).padStart(3, "0")}`,
      contactId: thomasKurian.id,
      ruleType: "FOLLOW_UP",
      reason: "3 reasons to follow up with Thomas at Google (Alphabet): no response in 3 days, LinkedIn activity, and company news",
      priority: "MEDIUM",
      status: "OPEN",
      generatedEmail: JSON.stringify({
        subject: "Following up — Google Cloud partnership opportunity",
        body: "Hi Thomas,\n\nI wanted to follow up on my earlier note about the cloud migration case studies. I know things move fast at Google Cloud, so completely understand if the timing wasn't right.\n\nI also noticed your keynote at Next '26 — the multi-cloud strategy resonated with what we're seeing across the industry. Would love to share some data points that might be useful for your team's planning.\n\nWould a brief call work this week?\n\nBest",
      }),
      metadata: JSON.stringify({
        insights: [
          {
            type: "FOLLOW_UP",
            reason: "Follow up with Thomas — no response in 3 days",
            priority: "MEDIUM",
            lastEmailSubject: "Cloud migration partnership — relevant case studies",
            lastEmailSnippet: "sharing case studies from recent work with major financial institutions on cloud migration, including a Top 5 bank that reduced their migration timeline by 40%",
            waitingDays: 3,
            lastInteraction: {
              type: "CALL",
              date: "2026-03-20T00:00:00.000Z",
              summary: "Discussed Google Cloud's multi-cloud strategy and identified three areas for potential collaboration on enterprise migration tooling",
            },
          },
          {
            type: "LINKEDIN_ACTIVITY",
            reason: "Thomas Kurian shared article on digital commerce trends: \"This is exactly where our industry is headed\"",
            priority: "MEDIUM",
          },
          {
            type: "COMPANY_NEWS",
            reason: "Google (Alphabet): \"Alphabet will surge 40% as Google becomes an AI leader, Wells Fargo says\"",
            priority: "MEDIUM",
            signalContent: "Alphabet will surge 40% as Google becomes an AI leader, Wells Fargo says",
          },
        ],
      }),
      sequenceId: "seq-demo-001",
      cadenceStepId: "step-seq1-0",
    });
  }

  if (coletteKress) {
    sequenceNudges.push({
      id: `nudge-seq-${String(nudgeIdx++).padStart(3, "0")}`,
      contactId: coletteKress.id,
      ruleType: "FOLLOW_UP",
      reason: "3 reasons to follow up with Colette at Nvidia: no response in 5 days, company news, and LinkedIn activity",
      priority: "HIGH",
      status: "OPEN",
      generatedEmail: JSON.stringify({
        subject: "Checking in — NVIDIA supply chain research",
        body: "Hi Colette,\n\nI hope all is well. I wanted to check in one more time on the supply-chain research I mentioned — our team has since updated the model with Q1 allocation data and the GPU demand picture is even more nuanced than expected.\n\nI'd be happy to share the updated executive summary if that would be helpful. No pressure at all.\n\nBest regards",
      }),
      metadata: JSON.stringify({
        insights: [
          {
            type: "FOLLOW_UP",
            reason: "Follow up with Colette — no response in 5 days",
            priority: "HIGH",
            lastEmailSubject: "GPU allocation forecasting — supply chain insights",
            lastEmailSnippet: "deep dive on semiconductor allocation patterns and GPU supply/demand dynamics over the next 18 months",
            waitingDays: 5,
            lastInteraction: {
              type: "CALL",
              date: "2026-03-15T00:00:00.000Z",
              summary: "Negotiation call regarding contract renewal. Colette is pushing for better terms on talent and workforce analytics",
            },
          },
          {
            type: "COMPANY_NEWS",
            reason: "Nvidia: \"Could Nvidia change gaming forever?\" — BBC News coverage on NVIDIA's next-gen GPU architecture",
            priority: "MEDIUM",
            signalContent: "Could Nvidia change gaming forever? BBC News explores NVIDIA's next-gen GPU architecture",
          },
          {
            type: "LINKEDIN_ACTIVITY",
            reason: "Colette Kress celebrated work anniversary at Nvidia: \"5 years of building the future\"",
            priority: "LOW",
          },
        ],
      }),
      sequenceId: "seq-demo-002",
      cadenceStepId: "step-seq2-1",
    });
  }

  if (parkerHarris) {
    sequenceNudges.push({
      id: `nudge-seq-${String(nudgeIdx++).padStart(3, "0")}`,
      contactId: parkerHarris.id,
      ruleType: "FOLLOW_UP",
      reason: "Ready to reach out to Parker — Agentforce launch outreach",
      priority: "MEDIUM",
      status: "OPEN",
      generatedEmail: JSON.stringify({
        subject: "Agentforce launch — thoughts on the platform strategy",
        body: "Hi Parker,\n\nI saw the Agentforce announcement — incredibly exciting to see Salesforce pushing the agentic AI frontier. The platform-level approach feels like the right bet, especially given what we're seeing in enterprise adoption patterns.\n\nI've been thinking about the developer ecosystem implications and how the partner channel might evolve. We recently published some research on AI platform economics that I think would resonate with your team's thinking.\n\nWould you be open to a quick call to exchange perspectives? I'd genuinely value your take on where the developer tooling is headed.\n\nBest regards",
      }),
      metadata: JSON.stringify({
        insights: [
          {
            type: "FOLLOW_UP",
            reason: "Ready to reach out to Parker — Agentforce launch outreach",
            priority: "MEDIUM",
            lastEmailSubject: "Agentforce launch — thoughts on the platform strategy",
            lastEmailSnippet: "AI platform economics research and developer ecosystem implications of the Agentforce launch",
            waitingDays: 0,
          },
          {
            type: "COMPANY_NEWS",
            reason: "Salesforce: \"Agentforce reshapes enterprise AI\" — industry coverage on the platform launch",
            priority: "MEDIUM",
            signalContent: "Agentforce reshapes enterprise AI — Salesforce's platform bet",
          },
        ],
      }),
      sequenceId: "seq-demo-003",
      cadenceStepId: "step-seq3-0",
    });
  }

  // Per-contact signal + interaction context for REPLY_NEEDED nudges
  const replyEnrichment: Record<string, {
    signals: { type: string; reason: string; priority: string; signalContent?: string }[];
    lastInteraction?: { type: string; date: string; summary: string };
  }> = {
    "Satya Nadella": {
      signals: [
        {
          type: "COMPANY_NEWS",
          reason: "Microsoft: \"Microsoft president says building data centres requires trust of US communities\"",
          priority: "MEDIUM",
          signalContent: "Microsoft president says building data centres requires trust of US communities",
        },
      ],
      lastInteraction: {
        type: "MEETING",
        date: "2026-03-18T00:00:00.000Z",
        summary: "Quarterly check-in with Satya's team on the digital transformation roadmap and cloud migration milestones",
      },
    },
    "Jamie Dimon": {
      signals: [
        {
          type: "COMPANY_NEWS",
          reason: "JPMorgan: \"JPMorgan accelerates AI adoption across trading desks\"",
          priority: "MEDIUM",
          signalContent: "JPMorgan accelerates AI adoption across trading desks",
        },
      ],
      lastInteraction: {
        type: "CALL",
        date: "2026-03-14T00:00:00.000Z",
        summary: "Discussed regulatory readiness for the Asia-Pacific expansion and potential compliance consulting engagement",
      },
    },
    "Marc Benioff": {
      signals: [
        {
          type: "COMPANY_NEWS",
          reason: "Salesforce: \"Agentforce reshapes enterprise AI\" — industry coverage on the platform launch",
          priority: "MEDIUM",
          signalContent: "Agentforce reshapes enterprise AI — Salesforce's platform bet",
        },
      ],
      lastInteraction: {
        type: "MEETING",
        date: "2026-03-10T00:00:00.000Z",
        summary: "Strategy session on Agentforce go-to-market approach and partner ecosystem development",
      },
    },
    "Jensen Huang": {
      signals: [
        {
          type: "COMPANY_NEWS",
          reason: "Nvidia: \"Could Nvidia change gaming forever?\" — BBC News on next-gen GPU architecture",
          priority: "MEDIUM",
          signalContent: "Could Nvidia change gaming forever? BBC News explores NVIDIA's next-gen GPU architecture",
        },
        {
          type: "LINKEDIN_ACTIVITY",
          reason: "Jensen Huang posted about NVIDIA GTC 2026 keynote highlights",
          priority: "LOW",
        },
      ],
      lastInteraction: {
        type: "CALL",
        date: "2026-03-12T00:00:00.000Z",
        summary: "Reviewed datacenter capacity projections and discussed infrastructure scaling partnerships",
      },
    },
    "Ted Sarandos": {
      signals: [
        {
          type: "LINKEDIN_ACTIVITY",
          reason: "Ted Sarandos shared thoughts on content monetization trends in streaming",
          priority: "LOW",
        },
      ],
      lastInteraction: {
        type: "NOTE",
        date: "2026-03-16T00:00:00.000Z",
        summary: "Dinner meeting — discussed content monetization analysis and potential deeper engagement with their finance team",
      },
    },
  };

  // REPLY_NEEDED nudges for unreplied inbound emails
  for (const target of inboundTargets) {
    const contact = findContact(contacts, target.name);
    if (!contact) continue;

    const firstName = contact.name.split(" ")[0];
    const dayCount = target.daysAgo;
    const dayLabel = dayCount === 1 ? "1 day" : `${dayCount} days`;
    const priority =
      contact.name === "Satya Nadella" || contact.name === "Jamie Dimon" ? "URGENT" : "HIGH";

    const enrichment = replyEnrichment[contact.name];
    const replyInsight: Record<string, unknown> = {
      type: "REPLY_NEEDED",
      reason: `${firstName} emailed ${dayLabel} ago — waiting for your reply`,
      priority,
      inboundSummary: target.summary,
      waitingDays: target.daysAgo,
    };
    if (enrichment?.lastInteraction) {
      replyInsight.lastInteraction = enrichment.lastInteraction;
    }

    const allInsights: Record<string, unknown>[] = [replyInsight];
    if (enrichment?.signals) {
      allInsights.push(...enrichment.signals);
    }

    const reasonParts = enrichment?.signals?.length
      ? `${firstName} emailed ${dayLabel} ago — waiting for your reply. Also: ${enrichment.signals.map((s) => TYPE_LABELS[s.type] ?? s.type).join(", ")}`
      : `${firstName} emailed ${dayLabel} ago — waiting for your reply`;

    sequenceNudges.push({
      id: `nudge-seq-${String(nudgeIdx++).padStart(3, "0")}`,
      contactId: contact.id,
      ruleType: "REPLY_NEEDED",
      reason: reasonParts,
      priority,
      status: "OPEN",
      generatedEmail: null,
      metadata: JSON.stringify({ insights: allInsights }),
      sequenceId: null,
      cadenceStepId: null,
    });
  }

  // Origin nudge placeholders (referenced by sequences)
  const originNudges: typeof sequenceNudges = [];
  if (thomasKurian) {
    originNudges.push({
      id: "nudge-origin-seq1",
      contactId: thomasKurian.id,
      ruleType: "STALE_CONTACT",
      reason: "Haven't connected with Thomas in 45 days — time for a check-in",
      priority: "MEDIUM",
      status: "DONE",
      generatedEmail: null,
      metadata: null,
      sequenceId: null,
      cadenceStepId: null,
    });
  }
  if (coletteKress) {
    originNudges.push({
      id: "nudge-origin-seq2",
      contactId: coletteKress.id,
      ruleType: "COMPANY_NEWS",
      reason: "NVIDIA posted record earnings — good reason to reconnect with Colette",
      priority: "MEDIUM",
      status: "DONE",
      generatedEmail: null,
      metadata: null,
      sequenceId: null,
      cadenceStepId: null,
    });
  }
  if (parkerHarris) {
    originNudges.push({
      id: "nudge-origin-seq3",
      contactId: parkerHarris.id,
      ruleType: "COMPANY_NEWS",
      reason: "Salesforce launched Agentforce — great conversation starter with Parker",
      priority: "MEDIUM",
      status: "DONE",
      generatedEmail: null,
      metadata: null,
      sequenceId: null,
      cadenceStepId: null,
    });
  }

  return {
    inboundInteractions,
    outboundInteractions,
    sequences,
    cadenceSteps,
    sequenceNudges: [...originNudges, ...sequenceNudges],
  };
}

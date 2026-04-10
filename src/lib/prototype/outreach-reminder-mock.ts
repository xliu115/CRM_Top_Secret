/**
 * Static mock data for the Outreach Reminder Agent UI prototype.
 * No APIs — replace with real signals and Contact 360 when integrated.
 */

export type MockArticle = {
  id: string;
  title: string;
  source: string;
  url: string;
  snippet: string;
};

export type MockOutreachReminder = {
  id: string;
  contactName: string;
  title: string;
  company: string;
  /** Narrative "why now" — insights over data */
  whyNow: string;
  signalLabel: string;
  /** Principle 5: explicit when graph is thin */
  confidenceNote?: string;
  topic: {
    headline: string;
    detail: string;
  };
  articles: MockArticle[];
  draft: {
    subject: string;
    body: string;
  };
  tones: {
    professional: { subject: string; body: string };
    warm: { subject: string; body: string };
    concise: { subject: string; body: string };
  };
};

export const MOCK_PARTNER_NAME = "Jordan Kim";

export const MOCK_BRIEFING_DATE = "Thursday, April 9, 2026";

export const MOCK_REMINDERS: MockOutreachReminder[] = [
  {
    id: "r1",
    contactName: "Sarah Chen",
    title: "Chief Strategy Officer",
    company: "Northwind Healthcare",
    whyNow:
      "Sarah has not heard from you in 24 days — longer than her usual cadence. She was promoted to CSO three weeks ago (LinkedIn). A short congratulations note with our latest payer outlook ties the relationship to timely firm content.",
    signalLabel: "Job change + stale touch",
    confidenceNote:
      "Last meeting notes in CRM are thin; timing inferred from email headers and public LinkedIn.",
    topic: {
      headline: "Congratulate promotion + share payer outlook",
      detail:
        "Opens a natural check-in on Northwind’s growth agenda without asking for a meeting yet.",
    },
    articles: [
      {
        id: "a1",
        title: "US healthcare payers: margin pressure into 2027",
        source: "McKinsey Global Institute",
        url: "https://example.com/payer-outlook",
        snippet:
          "Commercial payers are renegotiating risk contracts faster than in prior cycles…",
      },
      {
        id: "a2",
        title: "How systems are redesigning care pathways post-merger",
        source: "Healthcare Practice",
        url: "https://example.com/care-pathways",
        snippet:
          "Three systems that scaled integration without losing physician trust…",
      },
    ],
    draft: {
      subject: "Congratulations on the CSO role — payer outlook attached",
      body: `Hi Sarah,

Congratulations again on stepping into the CSO role — well deserved. I thought you might find this short perspective on payer dynamics useful as you align the growth agenda with your board.

If helpful, I’d love to hear how Northwind is prioritizing the next 12 months on the payer side.

Best,
Jordan`,
    },
    tones: {
      professional: {
        subject: "Congratulations on your promotion — timely payer perspective",
        body: `Hi Sarah,

Congratulations on your appointment as Chief Strategy Officer. I am sharing a concise view on current payer dynamics that may support your strategic planning conversations.

Please let me know if a brief call would be useful to discuss implications for Northwind.

Best regards,
Jordan`,
      },
      warm: {
        subject: "So great to see you as CSO — sharing something timely",
        body: `Hi Sarah,

So wonderful to see you step into the CSO seat — I know how much you’ve put into Northwind. I pulled a short piece on payer pressure that might be useful as you set priorities with the team.

No rush — if it sparks anything you want to compare notes on, I’m here.

Warmly,
Jordan`,
      },
      concise: {
        subject: "Congrats + payer note",
        body: `Sarah — congrats on CSO. Attached perspective on payer dynamics may be useful for board prep. Happy to sync 15m if helpful.

— Jordan`,
      },
    },
  },
  {
    id: "r2",
    contactName: "Marcus Webb",
    title: "Managing Director",
    company: "Sterling Capital Partners",
    whyNow:
      "Sterling was mentioned in yesterday’s industry recap as exploring a carve-out in logistics. Marcus is a key stakeholder even though your last touch was 6 months ago — worth a light, informed ping before someone else does.",
    signalLabel: "News mention + dormant high-value",
    topic: {
      headline: "Acknowledge news + offer a relevant lens",
      detail: "Signals you are paying attention without being transactional.",
    },
    articles: [
      {
        id: "a3",
        title: "Logistics carve-outs: five diligence traps we’re seeing",
        source: "Private Capital Practice",
        url: "https://example.com/carve-outs",
        snippet:
          "Teams underestimate working-capital swings in the first 120 days…",
      },
      {
        id: "a4",
        title: "Industrial tech: where PE is still underwriting growth",
        source: "Global Institute",
        url: "https://example.com/industrial-tech",
        snippet:
          "Despite rate uncertainty, three sectors still show resilient exit paths…",
      },
    ],
    draft: {
      subject: "Sterling / logistics — quick thought",
      body: `Hi Marcus,

I saw Sterling in the recap on logistics carve-outs and thought of you. If useful, here’s a short note on diligence patterns we’re seeing — no agenda beyond staying in sync.

If you’d ever like a second pair of eyes on anything in that space, I’m glad to help.

Best,
Jordan`,
    },
    tones: {
      professional: {
        subject: "Sterling — logistics carve-out coverage",
        body: `Dear Marcus,

I noted recent coverage regarding Sterling’s interest in logistics carve-outs. I am sharing a brief diligence perspective that may be relevant should the team advance work in this area.

I remain available should a conversation be helpful.

Kind regards,
Jordan`,
      },
      warm: {
        subject: "Saw Sterling in the news — sending a lens you might like",
        body: `Hi Marcus,

I caught the mention of Sterling alongside logistics carve-outs and wanted to share a quick read on diligence traps we’re seeing — only if it’s useful given what’s on your plate.

Always good to stay loosely in touch.

Best,
Jordan`,
      },
      concise: {
        subject: "Sterling + logistics carve-outs",
        body: `Marcus — saw Sterling in yesterday’s recap. Sharing a short diligence lens on carve-outs. Ping me if useful.

— Jordan`,
      },
    },
  },
  {
    id: "r3",
    contactName: "Elena Ruiz",
    title: "VP Operations",
    company: "Harbor Freight Labs",
    whyNow:
      "Elena usually replies within 48 hours; it has been 9 days since your last thread. No external signal — this is a simple relationship maintenance nudge before the silence gets awkward.",
    signalLabel: "Inbound responsiveness drop",
    topic: {
      headline: "Friendly check-in on operations roadmap",
      detail: "Keeps the thread warm without inventing a false urgency.",
    },
    articles: [
      {
        id: "a5",
        title: "Operations leaders are resetting KPIs for AI workflows",
        source: "Operations Practice",
        url: "https://example.com/ops-kpis",
        snippet:
          "Teams that tie AI pilots to one or two KPIs see 2× adoption vs. broad mandates…",
      },
    ],
    draft: {
      subject: "Catching up — operations roadmap",
      body: `Hi Elena,

Hope you’re well. I realized our thread went quiet after the roadmap discussion — no rush on my side, but I didn’t want radio silence on my end.

If it’s useful, here’s a short piece on how ops leaders are reframing KPIs around AI workflows — happy to compare notes whenever you have a window.

Best,
Jordan`,
    },
    tones: {
      professional: {
        subject: "Following up — operations roadmap discussion",
        body: `Hi Elena,

I am following up on our prior discussion regarding the operations roadmap. Please find attached a brief perspective on KPI design for AI-enabled workflows that may inform your planning cycle.

I remain available at your convenience.

Best regards,
Jordan`,
      },
      warm: {
        subject: "Floating back — hope things are calm on your side",
        body: `Hi Elena,

I know how fast Q2 moves — just floating this back up in case helpful. Sending a light read on KPIs for AI workflows in case it overlaps with what you’re seeing in ops.

Always happy to catch up whenever it’s easy.

Jordan`,
      },
      concise: {
        subject: "Quick ping — ops roadmap",
        body: `Elena — checking in after our roadmap thread. Short read on ops KPIs + AI if useful. Free for a call when you are.

— Jordan`,
      },
    },
  },
];

export function getReminderById(id: string): MockOutreachReminder | undefined {
  return MOCK_REMINDERS.find((r) => r.id === id);
}

import type { Prisma } from "@prisma/client";

type ContentItemCreate = Prisma.ContentItemCreateManyInput;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function generateContentLibrary(): {
  articles: ContentItemCreate[];
  events: ContentItemCreate[];
} {
  const articles: ContentItemCreate[] = [
    {
      id: "ci-art-001",
      type: "ARTICLE",
      title: "The economic potential of generative AI: The next productivity frontier",
      description:
        "Explores how generative AI could add trillions in value across industries and what leaders should prioritize.",
      url: `https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/${slugify(
        "The economic potential of generative AI the next productivity frontier"
      )}`,
      practice: "Digital & Analytics",
      publishedAt: new Date("2025-06-12T12:00:00Z"),
    },
    {
      id: "ci-art-002",
      type: "ARTICLE",
      title: "What every CEO should know about generative AI",
      description:
        "A concise briefing on strategic choices, risks, and organizational implications of generative AI for CEOs.",
      url: `https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/${slugify(
        "What every CEO should know about generative AI"
      )}`,
      practice: "Strategy & Corporate Finance",
      publishedAt: new Date("2025-08-20T09:00:00Z"),
    },
    {
      id: "ci-art-003",
      type: "ARTICLE",
      title: "The state of AI: How organizations are rewiring to capture value",
      description:
        "Survey-based look at how companies are scaling AI, from talent to tech stack to operating model.",
      url: `https://www.mckinsey.com/capabilities/quantumblack/our-insights/${slugify(
        "The state of AI How organizations are rewiring to capture value"
      )}`,
      practice: "AI",
      publishedAt: new Date("2025-03-05T14:00:00Z"),
    },
    {
      id: "ci-art-004",
      type: "ARTICLE",
      title: "Agentic AI: The next frontier of generative AI",
      description:
        "Introduces agentic systems and how autonomous AI workflows may reshape enterprise processes.",
      url: `https://www.mckinsey.com/capabilities/quantumblack/our-insights/${slugify(
        "Agentic AI The next frontier of generative AI"
      )}`,
      practice: "AI",
      publishedAt: new Date("2025-11-18T11:00:00Z"),
    },
    {
      id: "ci-art-005",
      type: "ARTICLE",
      title: "Supercharging the value of generative AI in banking",
      description:
        "Examines use cases and guardrails for applying generative AI across banking value chains.",
      url: `https://www.mckinsey.com/industries/financial-services/our-insights/${slugify(
        "Supercharging the value of generative AI in banking"
      )}`,
      practice: "Financial Services",
      publishedAt: new Date("2025-09-30T08:00:00Z"),
    },
    {
      id: "ci-art-006",
      type: "ARTICLE",
      title: "Building resilient supply chains in a volatile world",
      description:
        "Outlines practical moves to improve visibility, flexibility, and risk management in global supply chains.",
      url: `https://www.mckinsey.com/capabilities/operations/our-insights/${slugify(
        "Building resilient supply chains in a volatile world"
      )}`,
      practice: "Operations",
      publishedAt: new Date("2025-04-22T13:30:00Z"),
    },
    {
      id: "ci-art-007",
      type: "ARTICLE",
      title: "Rethinking solar project delivery for a clean-energy future",
      description:
        "Discusses execution challenges and digital levers to accelerate solar deployment at scale.",
      url: `https://www.mckinsey.com/industries/oil-and-gas/our-insights/${slugify(
        "Rethinking solar project delivery for a clean energy future"
      )}`,
      practice: "GEM",
      publishedAt: new Date("2025-07-14T10:00:00Z"),
    },
    {
      id: "ci-art-008",
      type: "ARTICLE",
      title: "McKinsey Technology Trends Outlook 2025",
      description:
        "Annual perspective on technology investment themes, adoption curves, and implications for leaders.",
      url: `https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/${slugify(
        "McKinsey Technology Trends Outlook 2025"
      )}`,
      practice: "TMT",
      publishedAt: new Date("2025-12-03T15:00:00Z"),
    },
    {
      id: "ci-art-009",
      type: "ARTICLE",
      title: "How to future-proof your technology operating model",
      description:
        "Framework for aligning tech talent, platforms, and governance with business strategy.",
      url: `https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/${slugify(
        "How to future-proof your technology operating model"
      )}`,
      practice: "TMT",
      publishedAt: new Date("2026-01-21T09:45:00Z"),
    },
    {
      id: "ci-art-010",
      type: "ARTICLE",
      title: "Cybersecurity in the age of generative AI",
      description:
        "Explores emerging threats and defensive priorities as generative AI changes the cyber landscape.",
      url: `https://www.mckinsey.com/capabilities/risk-and-resilience/our-insights/${slugify(
        "Cybersecurity in the age of generative AI"
      )}`,
      practice: "Risk & Resilience",
      publishedAt: new Date("2025-10-08T12:00:00Z"),
    },
    {
      id: "ci-art-011",
      type: "ARTICLE",
      title: "Navigating the AI era: A CEO's guide to strategy and execution",
      description:
        "Board- and CEO-level guidance on sequencing AI investments and measuring impact.",
      url: `https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/${slugify(
        "Navigating the AI era A CEOs guide to strategy and execution"
      )}`,
      practice: "Strategy & Corporate Finance",
      publishedAt: new Date("2026-02-04T11:20:00Z"),
    },
    {
      id: "ci-art-012",
      type: "ARTICLE",
      title: "From potential to profit: Closing the AI impact gap",
      description:
        "Identifies why many AI pilots stall and how organizations convert experimentation into P&L impact.",
      url: `https://www.mckinsey.com/capabilities/quantumblack/our-insights/${slugify(
        "From potential to profit Closing the AI impact gap"
      )}`,
      practice: "AI",
      publishedAt: new Date("2026-03-01T08:00:00Z"),
    },
  ];

  const events: ContentItemCreate[] = [
    {
      id: "ci-evt-001",
      type: "EVENT",
      title: "McKinsey AI & Analytics Summit",
      description:
        "A senior-leader forum on scaling AI, analytics, and data products across the enterprise.",
      practice: "AI",
      eventDate: new Date("2026-05-15T13:00:00Z"),
      eventLocation: "New York",
      eventType: "In-person",
      url: "https://www.mckinsey.com/events/ai-analytics-summit-2026",
    },
    {
      id: "ci-evt-002",
      type: "EVENT",
      title: "McKinsey Transformation Summit",
      description:
        "Sessions on large-scale transformation, capability building, and sustaining performance.",
      practice: "Implementation",
      eventDate: new Date("2026-06-10T14:00:00Z"),
      eventLocation: "Chicago",
      eventType: "In-person",
      url: "https://www.mckinsey.com/events/transformation-summit-2026",
    },
    {
      id: "ci-evt-003",
      type: "EVENT",
      title: "McKinsey CDO Forum Caserta",
      description:
        "Chief data and analytics officer peer exchange on data strategy, governance, and GenAI.",
      practice: "Digital & Analytics",
      eventDate: new Date("2026-07-08T09:00:00Z"),
      eventLocation: "Caserta, Italy",
      eventType: "In-person",
      url: "https://www.mckinsey.com/events/cdo-forum-caserta-2026",
    },
    {
      id: "ci-evt-004",
      type: "EVENT",
      title: "McKinsey GenAI Executive Briefing",
      description:
        "Virtual executive briefing on practical GenAI adoption patterns and risk controls.",
      practice: "AI",
      eventDate: new Date("2026-04-22T15:00:00Z"),
      eventLocation: "Virtual",
      eventType: "Virtual",
      url: "https://www.mckinsey.com/events/genai-executive-briefing-2026",
    },
    {
      id: "ci-evt-005",
      type: "EVENT",
      title: "McKinsey CEO Leadership Forum",
      description:
        "Invitation-only dialogue for CEOs on macro trends, leadership, and stakeholder capitalism.",
      practice: "Strategy",
      eventDate: new Date("2026-09-18T12:00:00Z"),
      eventLocation: "Washington, DC",
      eventType: "In-person",
      url: "https://www.mckinsey.com/events/ceo-leadership-forum-2026",
    },
    {
      id: "ci-evt-006",
      type: "EVENT",
      title: "McKinsey CFO Forum",
      description:
        "Hybrid forum for CFOs on capital allocation, performance management, and transformation.",
      practice: "Strategy",
      eventDate: new Date("2026-08-05T13:30:00Z"),
      eventLocation: "Boston",
      eventType: "Hybrid",
      url: "https://www.mckinsey.com/events/cfo-forum-2026",
    },
    {
      id: "ci-evt-007",
      type: "EVENT",
      title: "McKinsey PE Operating Partners Summit",
      description:
        "Private equity operating partners discuss value creation, digital, and talent in portfolio companies.",
      practice: "Private Capital",
      eventDate: new Date("2026-10-12T09:00:00Z"),
      eventLocation: "Stamford, CT",
      eventType: "In-person",
      url: "https://www.mckinsey.com/events/pe-operating-partners-summit-2026",
    },
    {
      id: "ci-evt-008",
      type: "EVENT",
      title: "McKinsey Supply Chain Leaders Forum",
      description:
        "Operations and supply chain leaders explore resilience, planning, and supplier collaboration.",
      practice: "Operations",
      eventDate: new Date("2026-05-28T14:00:00Z"),
      eventLocation: "Atlanta",
      eventType: "In-person",
      url: "https://www.mckinsey.com/events/supply-chain-leaders-forum-2026",
    },
  ];

  return { articles, events };
}

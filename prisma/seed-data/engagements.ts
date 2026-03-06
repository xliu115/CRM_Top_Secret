interface ContactRef {
  id: string;
  name: string;
  companyId: string;
  partnerId: string;
  title: string;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// ── McKinsey Events ──────────────────────────────────────────────────

const eventNames = [
  "McKinsey Transformation Summit",
  "McKinsey Tech Forward",
  "McKinsey Global Energy & Materials Conference",
  "McKinsey CDO Forum Caserta",
  "McKinsey CIO Roundtable",
  "McKinsey CEO Leadership Forum",
  "McKinsey Digital Board Dinner",
  "McKinsey Private Equity Operating Partners Summit",
  "McKinsey Women in Leadership Forum",
  "McKinsey AI & Analytics Summit",
  "McKinsey TMT CEO Dinner",
  "McKinsey Supply Chain Leaders Forum",
  "McKinsey CFO Forum",
  "McKinsey Sustainability Summit",
  "McKinsey Healthcare Innovation Day",
  "McKinsey Financial Services Forum",
  "McKinsey Consumer & Retail Summit",
  "McKinsey Operations Transformation Workshop",
  "McKinsey Board Outreach — CXO Dinner",
  "McKinsey GenAI Executive Briefing",
];

const practices = [
  "AI",
  "TMT",
  "Private Capital",
  "Operations",
  "Strategy & Corporate Finance",
  "Digital & Analytics",
  "Risk & Resilience",
  "Marketing & Sales",
  "Sustainability",
  "Growth, Marketing & Sales",
  "People & Organizational Performance",
  "Implementation",
  "M&A",
  "GEM (Global Energy & Materials)",
];

const eventTypes = ["In-person", "Virtual", "Hybrid"];
const eventSizes = ["1-50", "51-100", "101-300", "301-500", "501+"];
const locations = [
  "Washington, DC",
  "New York",
  "Minneapolis",
  "Atlanta",
  "San Francisco",
  "Chicago",
  "London",
  "Boston",
  "Dallas",
  "Seattle",
  "Stamford",
  "Houston",
  "Denver",
  "Miami",
  "Toronto",
  "Caserta, Italy",
  "Davos",
  "Singapore",
];
const eventStatuses = [
  "Registered",
  "Invited",
  "Attended",
  "Attended",
  "Attended",
];

// ── McKinsey Articles (real titles from mckinsey.com/insights) ───────

const articleNames = [
  "The art of software pricing: Unleashing growth with data-driven insights",
  "Reimagining people development to overcome talent challenges",
  "The economic potential of generative AI: The next productivity frontier",
  "Capital allocation starts with governance and should be led by the CEO",
  "The art of data: Empowering art institutions with data and analytics",
  "How to unlock value from your data transformation",
  "Rethinking solar project delivery for a clean-energy future",
  "Supercharging the value of generative AI in banking",
  "Tech at the edge: Trends reshaping the future of IT and business",
  "A new future of work: The race to deploy AI and raise skills in Europe and beyond",
  "What is generative AI?",
  "The state of AI: How organizations are rewiring to capture value",
  "Capturing the full value of generative AI in banking",
  "What every CEO should know about generative AI",
  "The top trends in tech",
  "McKinsey Technology Trends Outlook 2025",
  "How CEOs can win at generative AI",
  "Navigating the AI era: A CEO's guide to strategy and execution",
  "Building resilient supply chains in a volatile world",
  "The next S-curve of growth: How CEOs can lead bold transformations",
  "Why digital trust truly matters",
  "Rewired: The McKinsey guide to outcompeting in the age of digital and AI",
  "The data dividend: Fueling generative AI",
  "From potential to profit: Closing the AI impact gap",
  "Agentic AI: The next frontier of generative AI",
  "How to future-proof your technology operating model",
  "Quantum computing: An emerging ecosystem and industry use cases",
  "Cloud cost optimization: Why it matters and where to start",
  "Cybersecurity in the age of generative AI",
  "How CIOs and CTOs can accelerate digital transformation",
];

const senderNames = [
  "Michel Nix",
  "David Bass",
  "Glenn Stewart",
  "Sharon Mason",
  "Julie Park",
  "Carlos Rivera",
  "Anita Gupta",
  "Tom Brennan",
  "Sarah Chen",
  "Rajesh Patel",
  "Emma Thornton",
  "Marcus Williams",
];

// ── McKinsey Campaign Outreach ──────────────────────────────────────

const campaignPrefixes = [
  "GEM-EPNG--EU--Article",
  "DNA-NA--Event In Person",
  "GEM-EPNG--NA--Article",
  "DNA-EU--Event Virtual",
  "GEM-OPS--NA--Newsletter",
  "DNA-NA--Board Outreach",
  "TMT-NA--Article",
  "TMT-EU--Event In Person",
  "AI-NA--Executive Briefing",
  "IMPL-NA--Workshop Invite",
  "PE-NA--Operating Partners",
  "GMS-NA--Article",
];

const campaignSuffixes = [
  "Rethinking solar project delivery",
  "CDO Forum Caserta",
  "Board Outreach Follow Ups from Asutosh",
  "O&G Companies in Renewables & ETLC",
  "GenAI adoption in banking",
  "Supply chain resilience insights",
  "Data transformation unlocked",
  "CEO transformation leadership",
  "Agentic AI executive briefing",
  "Tech Trends Outlook 2025",
  "CIO digital transformation guide",
  "Quantum computing use cases",
  "Cloud cost optimization playbook",
  "Cybersecurity in the GenAI era",
  "Rewired book launch invite",
  "AI impact gap closing strategies",
];

const campaignStatuses = ["Sent", "Opened", "Clicked", "Clicked", "Opened"];

function randomDate(rand: () => number, yearsBack: number): Date {
  const now = new Date();
  const msBack = yearsBack * 365 * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - rand() * msBack);
}

function recentDate(rand: () => number, daysBack: number): Date {
  const now = new Date();
  const msBack = daysBack * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - rand() * msBack);
}

export function generateEventRegistrations(contacts: ContactRef[]) {
  const rand = seededRandom(777);
  const events: {
    id: string;
    contactId: string;
    name: string;
    status: string;
    eventDate: Date;
    practice: string;
    type: string;
    eventSize: string;
    location: string;
  }[] = [];

  let idx = 0;
  for (const contact of contacts) {
    const count = Math.floor(rand() * 6) + 3;
    for (let i = 0; i < count; i++) {
      const isFuture = rand() < 0.2;
      const date = isFuture
        ? new Date(Date.now() + rand() * 60 * 24 * 60 * 60 * 1000)
        : randomDate(rand, 3);
      const status = isFuture
        ? rand() < 0.5
          ? "Registered"
          : "Invited"
        : eventStatuses[Math.floor(rand() * eventStatuses.length)];

      events.push({
        id: `ev-${String(idx).padStart(4, "0")}`,
        contactId: contact.id,
        name: eventNames[Math.floor(rand() * eventNames.length)],
        status,
        eventDate: date,
        practice: practices[Math.floor(rand() * practices.length)],
        type: eventTypes[Math.floor(rand() * eventTypes.length)],
        eventSize: eventSizes[Math.floor(rand() * eventSizes.length)],
        location: locations[Math.floor(rand() * locations.length)],
      });
      idx++;
    }
  }
  return events;
}

export function generateArticleEngagements(contacts: ContactRef[]) {
  const rand = seededRandom(888);
  const articles: {
    id: string;
    contactId: string;
    name: string;
    articleSent: string;
    views: number;
    sentFrom: string | null;
    lastViewDate: Date | null;
  }[] = [];

  let idx = 0;
  for (const contact of contacts) {
    const count = Math.floor(rand() * 6) + 3;
    for (let i = 0; i < count; i++) {
      const sent = rand() > 0.12 ? "Y" : "N";
      const views = Math.floor(rand() * 10);
      const isRecent = rand() < 0.3;
      articles.push({
        id: `art-${String(idx).padStart(4, "0")}`,
        contactId: contact.id,
        name: articleNames[Math.floor(rand() * articleNames.length)],
        articleSent: sent,
        views,
        sentFrom:
          sent === "Y"
            ? senderNames[Math.floor(rand() * senderNames.length)]
            : null,
        lastViewDate:
          views > 0
            ? isRecent
              ? recentDate(rand, 14)
              : randomDate(rand, 2)
            : null,
      });
      idx++;
    }
  }
  return articles;
}

export function generateCampaignOutreaches(contacts: ContactRef[]) {
  const rand = seededRandom(999);
  const campaigns: {
    id: string;
    contactId: string;
    name: string;
    status: string;
    statusDate: Date;
  }[] = [];

  let idx = 0;
  for (const contact of contacts) {
    const count = Math.floor(rand() * 6) + 3;
    for (let i = 0; i < count; i++) {
      const date = randomDate(rand, 3);
      const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
      const prefix =
        campaignPrefixes[Math.floor(rand() * campaignPrefixes.length)];
      const suffix =
        campaignSuffixes[Math.floor(rand() * campaignSuffixes.length)];

      campaigns.push({
        id: `camp-${String(idx).padStart(4, "0")}`,
        contactId: contact.id,
        name: `${dateStr}---${prefix}-${suffix}`,
        status: campaignStatuses[Math.floor(rand() * campaignStatuses.length)],
        statusDate: date,
      });
      idx++;
    }
  }
  return campaigns;
}

type InteractionType = "EMAIL" | "CALL" | "MEETING" | "NOTE";
type Sentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

interface ContactRef {
  id: string;
  name: string;
  companyId: string;
  title: string;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

const types: InteractionType[] = ["EMAIL", "CALL", "MEETING", "NOTE"];
const sentiments: Sentiment[] = ["POSITIVE", "NEUTRAL", "NEGATIVE"];

const summaryTemplates = [
  "Discussed {topic}. {name} expressed interest in expanding the partnership.",
  "Quick check-in call with {name}. They mentioned upcoming budget reviews for Q{q}.",
  "Sent follow-up email regarding the {topic} proposal. Awaiting feedback.",
  "Met with {name} at their office. Reviewed current engagement and identified new opportunities in {area}.",
  "Had a productive call about {topic}. {name} wants to schedule a deeper dive next week.",
  "Shared our latest whitepaper on {area} with {name}. They forwarded it to their leadership team.",
  "{name} reached out about challenges with {topic}. Offered to connect them with our specialists.",
  "Quarterly business review with {name} and their team. Overall positive sentiment on the relationship.",
  "Introductory call with {name} after their promotion. Discussed how we can support their new mandate.",
  "Debriefed with {name} after the industry conference. They're keen to explore {area} together.",
  "Negotiation call regarding contract renewal. {name} is pushing for better terms on {topic}.",
  "Sent congratulations to {name} on their team's recent achievement. Strengthening the personal connection.",
  "{name} flagged concerns about timeline on the {topic} initiative. Need to address promptly.",
  "Workshop session with {name}'s team on {area}. Great engagement and follow-up questions.",
  "Casual lunch meeting with {name}. Discussed industry trends and their strategic priorities for next year.",
];

const nextStepTemplates = [
  "Schedule follow-up meeting for next week",
  "Send proposal document by end of week",
  "Connect {name} with our {area} team",
  "Prepare ROI analysis for {topic}",
  "Set up demo session for their leadership",
  "Follow up after their board meeting next month",
  "Send case study examples from similar engagements",
  "Arrange introduction to our CEO",
  "Draft partnership framework document",
  "Wait for their Q{q} budget approval",
  null,
  null,
];

const topics = [
  "cloud migration strategy",
  "AI/ML implementation",
  "digital transformation roadmap",
  "cybersecurity posture",
  "data analytics platform",
  "enterprise software modernization",
  "supply chain optimization",
  "customer experience platform",
  "cost optimization initiative",
  "talent and workforce strategy",
  "sustainability reporting",
  "M&A integration support",
];

const areas = [
  "generative AI",
  "cloud infrastructure",
  "data governance",
  "process automation",
  "digital commerce",
  "platform engineering",
  "responsible AI",
  "edge computing",
];

export function generateInteractions(contacts: ContactRef[]) {
  const rand = seededRandom(123);
  const interactions: {
    id: string;
    contactId: string;
    type: InteractionType;
    date: Date;
    summary: string;
    sentiment: Sentiment;
    nextStep: string | null;
    direction: string | null;
  }[] = [];

  const now = new Date();
  let idx = 0;

  for (const contact of contacts) {
    const count = 3 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(rand() * 365);
      const date = new Date(now.getTime() - daysAgo * 86400000);
      const type = types[Math.floor(rand() * types.length)];
      const sentimentWeights = rand();
      const sentiment: Sentiment =
        sentimentWeights < 0.5
          ? "POSITIVE"
          : sentimentWeights < 0.85
          ? "NEUTRAL"
          : "NEGATIVE";

      const topic = topics[Math.floor(rand() * topics.length)];
      const area = areas[Math.floor(rand() * areas.length)];
      const q = Math.floor(rand() * 4) + 1;

      const template =
        summaryTemplates[Math.floor(rand() * summaryTemplates.length)];
      const summary = template
        .replace(/{name}/g, contact.name.split(" ")[0])
        .replace(/{topic}/g, topic)
        .replace(/{area}/g, area)
        .replace(/{q}/g, String(q));

      const nsTemplate =
        nextStepTemplates[Math.floor(rand() * nextStepTemplates.length)];
      const nextStep = nsTemplate
        ? nsTemplate
            .replace(/{name}/g, contact.name.split(" ")[0])
            .replace(/{topic}/g, topic)
            .replace(/{area}/g, area)
            .replace(/{q}/g, String(q))
        : null;

      interactions.push({
        id: `int-${String(idx).padStart(4, "0")}`,
        contactId: contact.id,
        type,
        date,
        summary,
        sentiment,
        nextStep,
        direction: type === "EMAIL" ? "OUTBOUND" : null,
      });
      idx++;
    }
  }

  return interactions;
}

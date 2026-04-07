import type { ArticleEngagement } from "@prisma/client";
import { differenceInDays } from "date-fns";

const PRACTICE_INDUSTRY_MAP: Record<string, string[]> = {
  "Technology": ["technology", "software", "saas", "cloud", "semiconductors", "enterprise software", "consumer electronics"],
  "Digital & Analytics": ["technology", "software", "saas", "cloud", "data", "semiconductors", "enterprise software"],
  "AI": ["technology", "software", "saas", "cloud", "semiconductors", "enterprise software"],
  "TMT": ["technology", "software", "social media", "consumer electronics", "entertainment", "streaming"],
  "Financial Services": ["financial", "banking", "fintech", "insurance", "investment"],
  "Consumer & Retail": ["consumer", "e-commerce", "apparel", "food", "beverage", "streaming", "entertainment", "consumer goods"],
  "Operations": ["manufacturing", "supply chain", "logistics"],
  "Risk & Resilience": ["financial", "banking", "technology", "insurance"],
  "GEM": ["energy", "oil", "gas", "mining", "solar"],
  "Strategy & Corporate Finance": [],
  "Strategy": [],
};

const IMPORTANCE_SCORE: Record<string, number> = {
  CRITICAL: 20,
  HIGH: 15,
  MEDIUM: 10,
  LOW: 5,
};

const MIN_SCORE = 30;
const MAX_CONTACTS = 15;

interface ScoringContact {
  id: string;
  importance: string;
  lastContacted: Date | null;
  company: { industry: string };
}

export function scoreContactsForArticle(params: {
  practice: string | null | undefined;
  contacts: ScoringContact[];
  articlesByContact: Map<string, ArticleEngagement[]>;
  now: Date;
}): { contactId: string; score: number }[] {
  const { practice, contacts, articlesByContact, now } = params;

  const keywords = practice ? PRACTICE_INDUSTRY_MAP[practice] : undefined;
  const isUniversal = keywords !== undefined && keywords.length === 0;

  const scored: { contactId: string; score: number }[] = [];

  for (const contact of contacts) {
    let score = 0;

    // 1. Industry match (0-40)
    if (isUniversal) {
      score += 20;
    } else if (keywords && keywords.length > 0) {
      const industry = contact.company.industry.toLowerCase();
      if (keywords.some((kw) => industry.includes(kw))) {
        score += 40;
      }
    }

    // 2. Engagement history (0-30)
    const articles = articlesByContact.get(contact.id) ?? [];
    const totalViews = articles.reduce((sum, a) => sum + (a.views > 0 ? a.views : 0), 0);
    if (totalViews > 0) {
      score += 15 + Math.min(15, totalViews * 3);
    }

    // 3. Importance (5-20)
    score += IMPORTANCE_SCORE[contact.importance] ?? 10;

    // 4. Interaction recency (0-10)
    if (contact.lastContacted) {
      const daysSince = differenceInDays(now, new Date(contact.lastContacted));
      if (daysSince <= 30) score += 10;
      else if (daysSince <= 60) score += 5;
    }

    if (score >= MIN_SCORE) {
      scored.push({ contactId: contact.id, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_CONTACTS);
}

import { contactRepo } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";

const DEFAULT_TOP_N = 25;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Scores contacts by recency, frequency, and importance to suggest "top" contacts.
 * Returns the set of contact IDs that are in the suggested top tier (top N by score).
 */
export async function getSuggestedTopContactIds(
  partnerId: string,
  since: Date,
  topN: number = DEFAULT_TOP_N
): Promise<Set<string>> {
  const contacts =
    await contactRepo.findInteractedInLastYearByPartnerId(partnerId, since);
  if (contacts.length === 0) return new Set();

  const contactIds = contacts.map((c) => c.id);
  const stats = await prisma.interaction.groupBy({
    by: ["contactId"],
    where: {
      contactId: { in: contactIds },
      date: { gte: since },
    },
    _count: { id: true },
    _max: { date: true },
  });

  const now = Date.now();
  const importanceWeight: Record<string, number> = {
    CRITICAL: 25,
    HIGH: 15,
    MEDIUM: 5,
    LOW: 0,
  };

  const scored = contacts.map((contact) => {
    const stat = stats.find((s) => s.contactId === contact.id);
    const count = stat?._count?.id ?? 0;
    const lastDate = stat?._max?.date ?? contact.lastContacted ?? contact.createdAt;
    const lastTs = lastDate.getTime();
    const daysSince = (now - lastTs) / (24 * 60 * 60 * 1000);
    const recencyScore = Math.max(0, 100 - daysSince);
    const frequencyScore = Math.log(1 + count) * 10;
    const importanceBonus = importanceWeight[contact.importance] ?? 5;
    const score = recencyScore + frequencyScore + importanceBonus;
    return { id: contact.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topIds = scored.slice(0, topN).map((s) => s.id);
  return new Set(topIds);
}

export function oneYearAgo(): Date {
  return new Date(Date.now() - ONE_YEAR_MS);
}

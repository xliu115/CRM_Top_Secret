import { contactRepo, interactionRepo } from "@/lib/repositories";
import { differenceInDays } from "date-fns";
import { DEFAULT_STALE_DAYS_BY_TIER } from "@/lib/utils/tier-review-suggestions";

export type TierRecommendationItem = {
  contactId: string;
  currentTier: string;
  suggestedTier: string;
  reason: string;
};

function effectiveStaleDays(importance: string, override: number | null): number {
  return override ?? DEFAULT_STALE_DAYS_BY_TIER[importance] ?? 60;
}

/**
 * Heuristic tier suggestions: downgrades for stale Critical/High, optional upgrade for engaged Medium/Low.
 */
export async function loadTierRecommendations(partnerId: string): Promise<TierRecommendationItem[]> {
  const contacts = await contactRepo.findByPartnerId(partnerId);
  if (contacts.length === 0) return [];

  const contactIds = contacts.map((c) => c.id);
  const allInteractions = await interactionRepo.findByContactIds(contactIds);

  const interactionsByContact = new Map<string, typeof allInteractions>();
  for (const i of allInteractions) {
    const arr = interactionsByContact.get(i.contactId);
    if (arr) arr.push(i);
    else interactionsByContact.set(i.contactId, [i]);
  }

  const now = new Date();
  const window90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const out: TierRecommendationItem[] = [];

  for (const c of contacts) {
    const list = interactionsByContact.get(c.id) ?? [];
    const sorted = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last = sorted[0];
    const daysSince = last ? differenceInDays(now, new Date(last.date)) : null;
    const count90 = sorted.filter((i) => new Date(i.date) >= window90).length;

    const tier = c.importance;
    const staleDays = effectiveStaleDays(tier, c.staleThresholdDays);

    if (tier === "CRITICAL") {
      if (daysSince === null || daysSince > staleDays) {
        out.push({
          contactId: c.id,
          currentTier: tier,
          suggestedTier: "HIGH",
          reason:
            daysSince === null
              ? "No logged interaction — Critical may be overstated."
              : `No contact in ${daysSince}d (threshold ${staleDays}d). Consider lowering from Critical.`,
        });
      }
      continue;
    }

    if (tier === "HIGH") {
      if (daysSince === null || daysSince > staleDays) {
        out.push({
          contactId: c.id,
          currentTier: tier,
          suggestedTier: "MEDIUM",
          reason:
            daysSince === null
              ? "No logged interaction — High may be overstated."
              : `No contact in ${daysSince}d (threshold ${staleDays}d). Consider lowering from High.`,
        });
      }
      continue;
    }

    if (tier === "MEDIUM" && count90 >= 5 && daysSince !== null && daysSince <= 14) {
      out.push({
        contactId: c.id,
        currentTier: tier,
        suggestedTier: "HIGH",
        reason: "Strong recent engagement — consider raising to High.",
      });
      continue;
    }

    if (tier === "LOW" && count90 >= 8 && daysSince !== null && daysSince <= 10) {
      out.push({
        contactId: c.id,
        currentTier: tier,
        suggestedTier: "MEDIUM",
        reason: "Frequent touchpoints — consider Medium instead of Standard.",
      });
    }
  }

  return out;
}

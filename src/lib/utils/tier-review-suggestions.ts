/** Defaults aligned with nudge rule config stale thresholds. */
export const DEFAULT_STALE_DAYS_BY_TIER: Record<string, number> = {
  CRITICAL: 30,
  HIGH: 45,
  MEDIUM: 60,
  LOW: 90,
};

export type PartnerStaleDaysConfig = {
  staleDaysCritical: number;
  staleDaysHigh: number;
  staleDaysMedium: number;
  staleDaysLow: number;
};

/** Partner-level defaults for “days without interaction” before reconnect (stale) nudges, by contact tier. */
export function getStaleDaysForTier(
  importance: string,
  partner: PartnerStaleDaysConfig | null
): number {
  if (!partner) return DEFAULT_STALE_DAYS_BY_TIER[importance] ?? 60;
  switch (importance) {
    case "CRITICAL":
      return partner.staleDaysCritical;
    case "HIGH":
      return partner.staleDaysHigh;
    case "MEDIUM":
      return partner.staleDaysMedium;
    case "LOW":
      return partner.staleDaysLow;
    default:
      return partner.staleDaysMedium;
  }
}

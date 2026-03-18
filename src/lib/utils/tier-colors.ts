/**
 * Consistent contact importance tier colors across the platform.
 *
 * CRITICAL — McKinsey Electric Blue (#2251FF)
 * HIGH     — Green (#16A34A)
 * MEDIUM   — Slate/neutral
 * LOW      — Light neutral
 */

export const TIER_COLORS = {
  CRITICAL: {
    bar: "bg-[#2251FF]",
    text: "text-[#2251FF]",
    badge: "bg-[#2251FF]/10 text-[#2251FF] border-[#2251FF]/20",
    dot: "bg-[#2251FF]",
  },
  HIGH: {
    bar: "bg-green-600",
    text: "text-green-600",
    badge: "bg-green-600/10 text-green-600 border-green-600/20",
    dot: "bg-green-600",
  },
  MEDIUM: {
    bar: "bg-slate-400",
    text: "text-slate-500",
    badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    dot: "bg-slate-400",
  },
  LOW: {
    bar: "bg-slate-300",
    text: "text-slate-400",
    badge: "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-700",
    dot: "bg-slate-300",
  },
} as const;

export type TierKey = keyof typeof TIER_COLORS;

export function getTierColors(importance: string) {
  return TIER_COLORS[importance as TierKey] ?? TIER_COLORS.MEDIUM;
}

import { differenceInDays, isSameDay } from "date-fns";

export type StoryKind =
  | "EXECUTIVE_TRANSITION"
  | "EARNINGS_INVESTOR"
  | "LEADERSHIP_NEWS"
  | "STRATEGIC_MA"
  | "EVENT_MILESTONE"
  | "GENERAL_NEWS";

export const STORY_KIND_LABEL: Record<StoryKind, string> = {
  EXECUTIVE_TRANSITION: "Executive transition",
  EARNINGS_INVESTOR: "Earnings & investor",
  LEADERSHIP_NEWS: "Leadership in the news",
  STRATEGIC_MA: "Strategic move",
  EVENT_MILESTONE: "Event / milestone",
  GENERAL_NEWS: "In the news",
};

const EARNINGS_RE = /\b(earnings|eps|guidance|quarterly|q[1-4]\s|investor call|earnings call|sec filing|10-?k|10-?q|shareholder|revenue guidance|profit warning)\b/i;
const LEADERSHIP_RE = /\b(ceo|cfo|chair|board|president|chief executive|chief financial|appointed|steps down|resigns|departs|succession)\b/i;
const STRATEGIC_RE = /\b(acquisition|merger|m&a|divest|spin-?off|layoff|restructur|takeover|buyout|sold to|acquires)\b/i;
const EXEC_ROLE_RE = /\b(promoted|new role|joins|named|title change|vp |svp |head of)\b/i;

export function isPriorityImportance(importance: string | undefined | null): boolean {
  return importance === "CRITICAL" || importance === "HIGH";
}

export function classifyStoryKind(
  signalType: string,
  content: string,
  _date: Date
): StoryKind {
  const c = content.toLowerCase();
  if (signalType === "JOB_CHANGE") return "EXECUTIVE_TRANSITION";
  if (signalType === "EVENT") return "EVENT_MILESTONE";
  if (signalType === "NEWS") {
    if (EARNINGS_RE.test(c)) return "EARNINGS_INVESTOR";
    if (LEADERSHIP_RE.test(c)) return "LEADERSHIP_NEWS";
    if (STRATEGIC_RE.test(c)) return "STRATEGIC_MA";
    if (EXEC_ROLE_RE.test(c)) return "EXECUTIVE_TRANSITION";
    return "GENERAL_NEWS";
  }
  return "GENERAL_NEWS";
}

export function isCriticalStoryKind(kind: StoryKind): boolean {
  return kind !== "GENERAL_NEWS";
}

export function isSignalRecentForBreaking(
  signalType: string,
  signalDate: Date,
  now: Date
): boolean {
  if (signalType === "EVENT") {
    const until = differenceInDays(signalDate, now);
    const ago = differenceInDays(now, signalDate);
    return (until >= 0 && until <= 21) || (ago >= 0 && ago <= 14);
  }
  const ago = differenceInDays(now, signalDate);
  return ago >= 0 && ago <= 14;
}

export function signalTouchesPriorityContact(
  signal: {
    contactId: string | null;
    companyId: string | null;
    contact: { id: string; importance: string } | null;
  },
  priorityCompanyIds: Set<string>
): boolean {
  if (signal.contact) {
    return isPriorityImportance(signal.contact.importance);
  }
  if (signal.companyId && priorityCompanyIds.has(signal.companyId)) {
    return true;
  }
  return false;
}

export function qualifiesForBreakingStrip(args: {
  storyKind: StoryKind;
  priorityContactRelevant: boolean;
  signalType: string;
  signalDate: Date;
  now: Date;
}): boolean {
  if (!args.priorityContactRelevant) return false;
  if (!isSignalRecentForBreaking(args.signalType, args.signalDate, args.now)) return false;
  if (isCriticalStoryKind(args.storyKind)) return true;
  if (args.storyKind === "GENERAL_NEWS" && args.signalType === "NEWS") {
    return isSameDay(args.now, args.signalDate);
  }
  return false;
}

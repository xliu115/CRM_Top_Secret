import {
  Sparkles,
  Bell,
  Newspaper,
  Calendar,
  TrendingUp,
  Radar,
  Megaphone,
  Grid3X3,
  History,
} from "lucide-react";

export type DashboardCardKey =
  | "aiAssistant"
  | "topNudges"
  | "clientNews"
  | "todaysMeetings"
  | "pipelinePulse"
  | "relationshipRadar"
  | "campaignMomentum"
  | "whitespace"
  | "recentTouchTimeline";

export type DashboardCardPrefs = Record<DashboardCardKey, boolean>;

export const DASHBOARD_CARD_DEFAULTS: DashboardCardPrefs = {
  aiAssistant: true,
  topNudges: true,
  clientNews: true,
  todaysMeetings: false,
  pipelinePulse: false,
  relationshipRadar: false,
  campaignMomentum: false,
  whitespace: false,
  recentTouchTimeline: false,
};

export const DASHBOARD_CARDS: {
  key: DashboardCardKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: "aiAssistant",
    label: "AI Assistant",
    description: "Morning briefing and quick-ask input",
    icon: Sparkles,
  },
  {
    key: "topNudges",
    label: "Today's Top Nudges",
    description: "Priority-sorted nudges and meeting prep cards",
    icon: Bell,
  },
  {
    key: "clientNews",
    label: "Client News",
    description: "Recent signals grouped by client company",
    icon: Newspaper,
  },
  {
    key: "todaysMeetings",
    label: "Today's Meetings & Briefs",
    description:
      "Compact list of today's/tomorrow's meetings with client name, time, and a one-line AI prep note or \"prep needed\" flag",
    icon: Calendar,
  },
  {
    key: "pipelinePulse",
    label: "Pipeline Pulse",
    description:
      "Open opportunities sorted by stage gate, close date, or staleness — with next step and last touch",
    icon: TrendingUp,
  },
  {
    key: "relationshipRadar",
    label: "Relationship Radar",
    description:
      "High-importance contacts and clients with no meaningful touch in N days, or declining interaction trends — prioritized by strategic importance",
    icon: Radar,
  },
  {
    key: "campaignMomentum",
    label: "Campaign & Content Dissemination Momentum",
    description:
      "Active campaigns with progress metrics (targets touched, replies, next wave) and recommended next actions",
    icon: Megaphone,
  },
  {
    key: "whitespace",
    label: "Whitespace",
    description:
      "Key clients with open pipeline, recent signals, and coverage gaps (e.g., single-threaded relationships, few senior contacts)",
    icon: Grid3X3,
  },
  {
    key: "recentTouchTimeline",
    label: "Recent Touch Timeline",
    description:
      "Chronological strip of latest emails, calls, and meetings across priority contacts — filterable by client or time window",
    icon: History,
  },
];

const LS_KEY = "dashboard-card-prefs";

export function loadDashboardPrefs(): DashboardCardPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DASHBOARD_CARD_DEFAULTS, ...parsed };
    }
  } catch {}
  return { ...DASHBOARD_CARD_DEFAULTS };
}

export function saveDashboardPrefs(prefs: DashboardCardPrefs): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {}
}

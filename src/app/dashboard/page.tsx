"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronRight,
  Clock,
  Briefcase,
  Newspaper,
  CalendarDays,
  ClipboardList,
  Ticket,
  CalendarCheck,
  BookOpen,
  Linkedin,
  Send,
  ExternalLink,
  Sparkles,
  Mic,
  Settings,
  AlignLeft,
  List,
  Forward,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isTomorrow, differenceInCalendarDays } from "date-fns";
import { buildSummaryFragments } from "@/lib/utils/nudge-summary";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { MarkdownContent } from "@/components/ui/markdown-content";
import {
  loadDashboardPrefs,
  type DashboardCardPrefs,
} from "@/lib/utils/dashboard-prefs";

/* ── Types ─────────────────────────────────────────────────────────── */

type DashboardData = {
  contactCount: number;
  openNudgeCount: number;
  upcomingMeetingCount: number;
  upcomingMeetings: Array<{
    id: string;
    title: string;
    purpose: string | null;
    startTime: string;
    generatedBrief: string | null;
    attendees: Array<{
      contact: {
        id: string;
        name: string;
        title: string;
        importance?: string;
        company: { id: string; name: string };
      };
    }>;
  }>;
  clientNews: Array<{
    id: string;
    type: string;
    date: string;
    content: string;
    url: string | null;
    contact: { name: string; importance?: string; company?: string } | null;
    company: { id: string; name: string } | null;
  }>;
};

type InsightData = {
  type: string;
  reason: string;
  priority: string;
  signalContent?: string;
  signalUrl?: string | null;
};

type Nudge = {
  id: string;
  ruleType: string;
  reason: string;
  priority: string;
  metadata?: string | null;
  contact: { id: string; name: string; title: string; company: { name: string } };
  signal?: { type: string; content: string; url?: string | null } | null;
};

type StructuredBriefingData = {
  nudges: {
    contactName: string;
    company: string;
    reason: string;
    priority: string;
    contactId: string;
    nudgeId: string;
    ruleType: string;
    daysSince?: number;
  }[];
  meetings: {
    title: string;
    startTime: string;
    attendeeNames: string[];
    meetingId: string;
  }[];
  news: {
    content: string;
    contactName?: string;
    company?: string;
    companyId?: string;
    url?: string | null;
  }[];
};

/* ── Helpers ───────────────────────────────────────────────────────── */

function parseInsights(metadata?: string | null): InsightData[] {
  if (!metadata) return [];
  try {
    const parsed = JSON.parse(metadata);
    return parsed?.insights ?? [];
  } catch { return []; }
}

function getPriorityClassName(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400";
    case "HIGH":
      return "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400";
    case "MEDIUM":
      return "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400";
    case "LOW":
      return "border-border bg-muted/50 text-muted-foreground-subtle";
    default:
      return "border-border bg-muted/50 text-muted-foreground-subtle";
  }
}

type NudgeTypeConfig = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
};

const NUDGE_TYPE_CONFIG: Record<string, NudgeTypeConfig> = {
  STALE_CONTACT: { icon: Clock, label: "Reconnect", color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/30" },
  JOB_CHANGE: { icon: Briefcase, label: "Executive Transition", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30" },
  COMPANY_NEWS: { icon: Newspaper, label: "Company News", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
  UPCOMING_EVENT: { icon: CalendarDays, label: "Upcoming Event", color: "text-teal-600", bgColor: "bg-teal-50 dark:bg-teal-950/30" },
  MEETING_PREP: { icon: ClipboardList, label: "Meeting Prep", color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-950/30" },
  EVENT_ATTENDED: { icon: Ticket, label: "Event Follow-Up", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/30" },
  EVENT_REGISTERED: { icon: CalendarCheck, label: "Event Outreach", color: "text-cyan-600", bgColor: "bg-cyan-50 dark:bg-cyan-950/30" },
  ARTICLE_READ: { icon: BookOpen, label: "Content Follow-Up", color: "text-rose-600", bgColor: "bg-rose-50 dark:bg-rose-950/30" },
  LINKEDIN_ACTIVITY: { icon: Linkedin, label: "LinkedIn Activity", color: "text-sky-600", bgColor: "bg-sky-50 dark:bg-sky-950/30" },
};

const DEFAULT_TYPE_CONFIG: NudgeTypeConfig = {
  icon: Send, label: "Nudge", color: "text-muted-foreground-subtle", bgColor: "bg-muted/50",
};

function getSignalTypeConfig(type: string): NudgeTypeConfig {
  const map: Record<string, NudgeTypeConfig> = {
    NEWS: NUDGE_TYPE_CONFIG.COMPANY_NEWS,
    JOB_CHANGE: NUDGE_TYPE_CONFIG.JOB_CHANGE,
    EVENT: NUDGE_TYPE_CONFIG.UPCOMING_EVENT,
  };
  return map[type] ?? DEFAULT_TYPE_CONFIG;
}

const IMPORTANCE_RANK: Record<string, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
};

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
};

type FeedNudgeItem = { kind: "nudge"; priority: string; nudge: Nudge };
type FeedMeetingItem = { kind: "meeting"; priority: string; meeting: DashboardData["upcomingMeetings"][number] };
type FeedItem = FeedNudgeItem | FeedMeetingItem;

function meetingToPriority(meeting: DashboardData["upcomingMeetings"][number]): string {
  const importanceToPriority: Record<string, string> = {
    CRITICAL: "URGENT", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW",
  };
  const topImportance = meeting.attendees
    .map((a) => a.contact.importance ?? "MEDIUM")
    .sort((a, b) => (IMPORTANCE_RANK[a] ?? 99) - (IMPORTANCE_RANK[b] ?? 99))[0];
  return importanceToPriority[topImportance ?? "MEDIUM"] ?? "HIGH";
}

const DASHBOARD_SUGGESTED_QUESTIONS = [
  "Summarize my week",
  "Who needs follow-up?",
  "Prep me for tomorrow's meetings",
  "What's the latest with my top clients?",
  "Which contacts haven't I spoken to in 60+ days?",
  "Who knows my contacts?",
];

function groupMeetingsByTimeBucket(
  meetings: DashboardData["upcomingMeetings"]
): { label: string; meetings: typeof meetings }[] {
  const today: typeof meetings = [];
  const tomorrow: typeof meetings = [];
  const later: typeof meetings = [];

  for (const m of meetings) {
    const d = new Date(m.startTime);
    if (isToday(d)) today.push(m);
    else if (isTomorrow(d)) tomorrow.push(m);
    else later.push(m);
  }

  const buckets: { label: string; meetings: typeof meetings }[] = [];
  if (today.length > 0) buckets.push({ label: "Today", meetings: today });
  if (tomorrow.length > 0) buckets.push({ label: "Tomorrow", meetings: tomorrow });
  if (later.length > 0) buckets.push({ label: "Later this week", meetings: later });
  return buckets;
}

function sortNewsByImportance(items: DashboardData["clientNews"]): DashboardData["clientNews"] {
  return [...items].sort((a, b) => {
    const rankA = IMPORTANCE_RANK[a.contact?.importance ?? ""] ?? 99;
    const rankB = IMPORTANCE_RANK[b.contact?.importance ?? ""] ?? 99;
    return rankA - rankB;
  });
}

function groupNewsByClient(news: DashboardData["clientNews"]): {
  clientName: string;
  topImportance: string;
  items: typeof news;
}[] {
  const groups = new Map<string, typeof news>();

  for (const item of news) {
    const key = item.contact?.company ?? item.company?.name ?? "Other";
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }

  return Array.from(groups.entries())
    .map(([clientName, items]) => {
      const topImportance = items
        .map((i) => i.contact?.importance ?? "")
        .sort((a, b) => (IMPORTANCE_RANK[a] ?? 99) - (IMPORTANCE_RANK[b] ?? 99))[0] || "";
      return {
        clientName,
        topImportance,
        items: sortNewsByImportance(items),
      };
    })
    .sort((a, b) => (IMPORTANCE_RANK[a.topImportance] ?? 99) - (IMPORTANCE_RANK[b.topImportance] ?? 99));
}

/* ── Structured Briefing View ──────────────────────────────────────── */

const RULE_TYPE_LABELS: Record<string, string> = {
  STALE_CONTACT: "overdue for a check-in",
  JOB_CHANGE: "executive transition",
  COMPANY_NEWS: "company news",
  UPCOMING_EVENT: "upcoming event",
  MEETING_PREP: "meeting prep",
  EVENT_ATTENDED: "event follow-up",
  EVENT_REGISTERED: "event outreach",
  ARTICLE_READ: "content engagement",
  LINKEDIN_ACTIVITY: "LinkedIn activity",
};

function summarizeNudgeReasons(nudges: StructuredBriefingData["nudges"], contactName: string, company: string): string {
  const contactNudges = nudges.filter(
    (n) => n.contactName === contactName && n.company === company
  );
  if (contactNudges.length === 0) return "";
  const reasons = contactNudges.map((n) => RULE_TYPE_LABELS[n.ruleType] ?? n.ruleType.toLowerCase().replace(/_/g, " "));
  const unique = [...new Set(reasons)];
  const count = unique.length;
  if (count <= 3) return unique.join(", ");
  return unique.slice(0, 2).join(", ") + `, and ${count - 2} more`;
}

type BriefingAction = {
  contactName: string;
  company: string;
  actionLabel: string;
  deeplink: string;
  detail: string;
};

/** Shape returned by GET /api/sequences (Prisma JSON). */
type ActiveSequenceBriefingItem = {
  id: string;
  currentStep: number;
  contact: { id: string; name: string; company: { name: string } };
  steps: Array<{ stepNumber: number; executedAt: string | null }>;
};

function formatActiveSequenceStatus(seq: ActiveSequenceBriefingItem): string {
  const current = seq.steps.find((s) => s.stepNumber === seq.currentStep);
  if (!current?.executedAt) {
    return "Ready to reach out";
  }
  const days = Math.max(
    0,
    differenceInCalendarDays(new Date(), new Date(current.executedAt)),
  );
  if (days === 0) {
    return "Waiting for response (today)";
  }
  return `Waiting for response (${days} day${days === 1 ? "" : "s"})`;
}

function StructuredBriefingView({
  data,
  actions,
  activeSequences,
  onQuick360,
}: {
  data: StructuredBriefingData | null;
  actions: BriefingAction[];
  activeSequences: ActiveSequenceBriefingItem[];
  onQuick360: (contactName: string) => void;
}) {
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground px-2">
        No briefing data available.
      </p>
    );
  }

  // Group contacts and sort groups by highest priority within
  const contactMap = new Map<string, StructuredBriefingData["nudges"][number][]>();
  for (const n of data.nudges) {
    const key = `${n.contactName}||${n.company}`;
    const list = contactMap.get(key) ?? [];
    list.push(n);
    contactMap.set(key, list);
  }

  const sortedContacts = [...contactMap.entries()].sort((a, b) => {
    const bestA = Math.min(...a[1].map((n) => PRIORITY_RANK[n.priority] ?? 99));
    const bestB = Math.min(...b[1].map((n) => PRIORITY_RANK[n.priority] ?? 99));
    return bestA - bestB;
  });

  // Group news by company, sorted by whether the company has a priority contact
  const nudgeCompanies = new Set(data.nudges.map((n) => n.company));
  const newsGrouped = new Map<string, StructuredBriefingData["news"]>();
  for (const item of data.news) {
    const key = item.company ?? "Other";
    const list = newsGrouped.get(key) ?? [];
    list.push(item);
    newsGrouped.set(key, list);
  }

  const sortedNews = [...newsGrouped.entries()].sort((a, b) => {
    const aHasPriority = nudgeCompanies.has(a[0]) ? 0 : 1;
    const bHasPriority = nudgeCompanies.has(b[0]) ? 0 : 1;
    return aHasPriority - bHasPriority;
  });

  return (
    <div className="space-y-6 px-1">
      {/* Priority Contacts */}
      {sortedContacts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-100 dark:bg-orange-950/40">
              <Clock className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Priority contacts for today
            </h3>
          </div>
          <div className="space-y-3 pl-8">
            {sortedContacts.map(([key, nudges]) => {
              const first = nudges[0];
              const bestPriority = nudges.reduce(
                (best, n) => ((PRIORITY_RANK[n.priority] ?? 99) < (PRIORITY_RANK[best] ?? 99) ? n.priority : best),
                nudges[0].priority,
              );
              const reasonsSummary = summarizeNudgeReasons(data.nudges, first.contactName, first.company);
              return (
                <div key={key} className="group">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <Link
                      href={`/contacts/${first.contactId}${first.nudgeId ? `?nudge=${first.nudgeId}` : ""}`}
                      className="text-sm font-semibold text-foreground hover:text-primary hover:underline transition-colors"
                    >
                      {first.contactName}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      at {first.company}
                    </span>
                    {bestPriority === "URGENT" && (
                      <Badge variant="outline" className="ml-1 border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400 text-[10px] py-0">
                        Urgent
                      </Badge>
                    )}
                    {bestPriority === "HIGH" && (
                      <Badge variant="outline" className="ml-1 border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400 text-[10px] py-0">
                        High
                      </Badge>
                    )}
                  </div>
                  {first.daysSince != null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      It&apos;s been {first.daysSince} days since your last conversation.
                    </p>
                  )}
                  {nudges.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {nudges.length} {nudges.length === 1 ? "reason" : "reasons"} to reach out: {reasonsSummary}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Active follow-ups (outreach sequences) */}
      {activeSequences.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-950/40">
              <Forward className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Active follow-ups
            </h3>
          </div>
          <div className="space-y-3 pl-8">
            {activeSequences.map((seq) => (
              <div key={seq.id}>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <Link
                    href={`/contacts/${seq.contact.id}`}
                    className="text-sm font-semibold text-foreground hover:text-primary hover:underline transition-colors"
                  >
                    {seq.contact.name}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    at {seq.contact.company.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatActiveSequenceStatus(seq)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Meetings */}
      {data.meetings.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-950/40">
              <CalendarDays className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Upcoming meetings
            </h3>
          </div>
          <div className="space-y-2.5 pl-8">
            {data.meetings.map((m) => (
              <div key={m.meetingId}>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <Link
                    href={`/meetings/${m.meetingId}`}
                    className="text-sm font-medium text-foreground hover:text-primary hover:underline transition-colors"
                  >
                    &ldquo;{m.title}&rdquo;
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    at {m.startTime}
                  </span>
                  {m.attendeeNames.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      with {m.attendeeNames.join(", ")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Company News — sorted by priority companies first */}
      {sortedNews.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-950/40">
              <Newspaper className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Company news
            </h3>
          </div>
          <div className="space-y-3 pl-8">
            {sortedNews.map(([company, items]) => (
              <div key={company}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{company}</p>
                  {nudgeCompanies.has(company) && (
                    <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[10px] py-0">
                      Priority
                    </Badge>
                  )}
                </div>
                <ul className="mt-1 space-y-1">
                  {items.map((item, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground leading-relaxed">
                      <span className="mr-1">•</span>
                      {item.content.length > 150
                        ? item.content.slice(0, 147) + "..."
                        : item.content}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 inline-flex items-center text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.nudges.length === 0 &&
        data.meetings.length === 0 &&
        data.news.length === 0 &&
        activeSequences.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing pressing on your plate today. Nice!
        </p>
      )}

      {/* CTA Actions — same as narrative view */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {actions.map((action, i) => (
              <Link
              key={`${action.deeplink}-${i}`}
              href={action.deeplink}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 min-h-[36px]"
            >
              <ChevronRight className="h-3 w-3" />
              {action.actionLabel} — {action.contactName}
            </Link>
          ))}
          {[...new Map(actions.map((a) => [a.contactName, a.contactName])).values()].map((name) => (
            <button
              key={`q360-struct-${name}`}
              onClick={() => onQuick360(name)}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 min-h-[36px]"
            >
              <ChevronRight className="h-3 w-3" />
              Quick 360 — {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Coming Soon placeholder ───────────────────────────────────────── */

function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge variant="outline" className="text-[10px] font-normal">Coming soon</Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Sparkles className="h-5 w-5 text-muted-foreground-subtle" />
          </div>
          <p className="text-sm text-muted-foreground-subtle">
            This card is under development. Enable it in{" "}
            <Link href="/dashboard/settings" className="text-primary hover:underline">
              Dashboard Settings
            </Link>{" "}
            to see it here when ready.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Dashboard Page ────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [topNudges, setTopNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  // Card visibility prefs
  const [cardPrefs, setCardPrefs] = useState<DashboardCardPrefs | null>(null);

  useEffect(() => {
    setCardPrefs(loadDashboardPrefs());
  }, []);

  // Briefing state
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingActions, setBriefingActions] = useState<
    { contactName: string; company: string; actionLabel: string; deeplink: string; detail: string }[]
  >([]);
  const [structuredData, setStructuredData] = useState<StructuredBriefingData | null>(null);
  const [activeSequences, setActiveSequences] = useState<ActiveSequenceBriefingItem[]>([]);
  const [briefingView, setBriefingView] = useState<"conversational" | "structured">("conversational");
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const chatInputRef = useRef<HTMLInputElement>(null);
  const pendingVoiceRef = useRef<string | null>(null);

  // Fetch dashboard data + auto-briefing in a single effect
  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setBriefingLoading(true);
      setError(null);
      try {
        const [dashboardRes, nudgesRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/nudges?status=OPEN"),
        ]);

        if (cancelled) return;

        if (!dashboardRes.ok) {
          const body = await dashboardRes.json().catch(() => ({}));
          const message = (body && typeof body.error === "string") ? body.error : "Failed to fetch dashboard";
          throw new Error(message);
        }
        const dashboard = await dashboardRes.json();
        setDashboardData(dashboard);

        if (nudgesRes.ok) {
          const nudges = await nudgesRes.json();
          setTopNudges(nudges.slice(0, 5));
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
        setBriefingLoading(false);
        return;
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Fetch briefing + active sequences after dashboard data is loaded
      try {
        const [briefingRes, sequencesRes] = await Promise.all([
          fetch("/api/dashboard/briefing"),
          fetch("/api/sequences?status=ACTIVE"),
        ]);
        if (cancelled) return;
        if (briefingRes.ok) {
          const data = await briefingRes.json();
          if (!cancelled) {
            if (data.briefing) setBriefing(data.briefing);
            if (Array.isArray(data.topActions)) setBriefingActions(data.topActions);
            if (data.structured) setStructuredData(data.structured);
          }
        }
        if (sequencesRes.ok) {
          const sequences = await sequencesRes.json();
          if (!cancelled && Array.isArray(sequences)) {
            setActiveSequences(sequences as ActiveSequenceBriefingItem[]);
          }
        }
      } catch {
        // Silently fail — the briefing is a nice-to-have
      } finally {
        if (!cancelled) setBriefingLoading(false);
      }
    }
    fetchAll();

    return () => { cancelled = true; };
  }, []);

  const userName = session?.user?.name ?? "Partner";

  function navigateToChat(text: string) {
    if (!text.trim()) return;
    router.push(`/chat?q=${encodeURIComponent(text.trim())}`);
  }

  function handleQuick360(contactName: string) {
    navigateToChat(`Contact 360 for ${contactName}`);
  }

  const handleVoiceResult = useCallback((transcript: string) => {
    pendingVoiceRef.current = transcript;
    setChatInput(transcript);
  }, []);

  const { isListening, transcript: liveTranscript, isSupported, startListening, stopListening } =
    useSpeechRecognition({ onResult: handleVoiceResult });

  useEffect(() => {
    if (pendingVoiceRef.current && !isListening) {
      const text = pendingVoiceRef.current;
      pendingVoiceRef.current = null;
      setChatInput("");
      navigateToChat(text);
    }
  }, [isListening]);

  useEffect(() => {
    if (isListening && liveTranscript) {
      setChatInput(liveTranscript);
    }
  }, [isListening, liveTranscript]);

  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    navigateToChat(text);
  }

  function handleSuggestedQuestion(q: string) {
    navigateToChat(q);
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="space-y-8">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-80" />
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Skeleton className="h-[28rem]" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      </DashboardShell>
    );
  }

  const meetingBuckets = dashboardData?.upcomingMeetings?.length
    ? groupMeetingsByTimeBucket(dashboardData.upcomingMeetings)
    : [];

  const todayMeetings = meetingBuckets.find((b) => b.label === "Today")?.meetings ?? [];
  const tomorrowMeetings = meetingBuckets.find((b) => b.label === "Tomorrow")?.meetings ?? [];
  const upcomingPrepMeetings = [...todayMeetings, ...tomorrowMeetings].slice(0, 3);

  const feedItems: FeedItem[] = [
    ...upcomingPrepMeetings.map((m): FeedItem => ({
      kind: "meeting", priority: meetingToPriority(m), meeting: m,
    })),
    ...topNudges.map((n): FeedItem => ({
      kind: "nudge", priority: n.priority, nudge: n,
    })),
  ].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99));

  const newsGroups = dashboardData?.clientNews?.length
    ? groupNewsByClient(dashboardData.clientNews)
    : [];

  const timeGreeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  })();

  const firstName = (userName ?? "Partner").split(/\s+/)[0] || userName || "Partner";

  return (
    <DashboardShell>
      {/* Settings gear — pinned top-right */}
      <div className="flex justify-end">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center justify-center rounded-md p-2.5 min-h-11 min-w-11 text-muted-foreground-subtle hover:text-foreground hover:bg-muted transition-colors"
          title="Dashboard Settings"
          aria-label="Dashboard settings"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>

      <div className="space-y-8 pt-[8vh]">
        {/* Greeting */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {timeGreeting}, {firstName}
          </h1>
          <p className="text-2xl font-semibold tracking-tight text-foreground/80">
            What&apos;s on{" "}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent font-bold">
              your mind
            </span>
            ?
          </p>
        </div>

        {/* Conversational Panel — Hero */}
        {cardPrefs?.aiAssistant !== false && (
        <div className="mx-auto w-full max-w-[80%]">
        <Card className="shadow-md border-primary/10">
          <div className="flex flex-col">
            {/* Briefing area */}
            <div className="p-5">
              {briefingLoading ? (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-sm text-muted-foreground-subtle">
                      Preparing your briefing...
                    </span>
                  </div>
                </div>
              ) : (briefing || structuredData) ? (
                <>
                  {/* View toggle */}
                  <div className="flex items-center justify-end mb-3">
                    <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
                      <button
                        type="button"
                        onClick={() => setBriefingView("conversational")}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[36px] ${
                          briefingView === "conversational"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground-subtle hover:text-foreground"
                        }`}
                        aria-label="Conversational view"
                      >
                        <AlignLeft className="h-3.5 w-3.5" />
                        Narrative
                      </button>
                      <button
                        type="button"
                        onClick={() => setBriefingView("structured")}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[36px] ${
                          briefingView === "structured"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground-subtle hover:text-foreground"
                        }`}
                        aria-label="Structured view"
                      >
                        <List className="h-3.5 w-3.5" />
                        Structured
                      </button>
                    </div>
                  </div>

                  {briefingView === "conversational" ? (
                    /* ── Conversational (narrative) view ── */
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground-subtle">Activate</p>
                        {briefing && (
                          <MarkdownContent content={briefing} className="text-sm text-foreground" />
                        )}
                        {briefingActions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {briefingActions.map((action, i) => (
                              <Link
                                key={`${action.deeplink}-${i}`}
                                href={action.deeplink}
                                className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 min-h-[36px]"
                              >
                                <ChevronRight className="h-3 w-3" />
                                {action.actionLabel} — {action.contactName}
                              </Link>
                            ))}
                            {/* Quick 360 buttons — navigate to chat with 360 query */}
                            {[...new Map(briefingActions.map((a) => [a.contactName, a.contactName])).values()].map((name) => (
                              <button
                                key={`q360-${name}`}
                                onClick={() => handleQuick360(name)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 min-h-[36px]"
                              >
                                <ChevronRight className="h-3 w-3" />
                                Quick 360 — {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* ── Structured (bullet-point) view ── */
                    <StructuredBriefingView
                      data={structuredData}
                      actions={briefingActions}
                      activeSequences={activeSequences}
                      onQuick360={handleQuick360}
                    />
                  )}
                </>
              ) : null}
            </div>

            {/* Input bar */}
            <div className="border-t border-border p-4">
              <form onSubmit={handleChatSubmit} className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex flex-1">
                    <Sparkles className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground-subtle" />
                    <input
                      ref={chatInputRef}
                      id="dashboard-chat"
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask AI a question or make a request..."
                      className="flex-1 rounded-lg border border-border bg-background pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {isSupported && (
                    <Button
                      type="button"
                      variant={isListening ? "destructive" : "ghost"}
                      size="icon"
                      onClick={isListening ? stopListening : startListening}
                      className={`h-11 w-11 shrink-0 relative ${
                        isListening ? "animate-pulse" : "text-muted-foreground-subtle hover:text-foreground"
                      }`}
                      title={isListening ? "Stop listening" : "Voice input"}
                    >
                      {isListening ? (
                        <>
                          <Mic className="h-4 w-4" />
                          <span className="absolute inset-0 rounded-md border-2 border-destructive animate-ping opacity-30" />
                        </>
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {isListening ? "Stop listening" : "Voice input"}
                      </span>
                    </Button>
                  )}
                  <Button type="submit" size="default" disabled={!chatInput.trim()}>
                    {isListening ? "Listening..." : "Ask"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DASHBOARD_SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSuggestedQuestion(q)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[36px]"
                    >
                      <Sparkles className="h-3 w-3 text-primary" />
                      {q}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          </div>
        </Card>
        </div>
        )}

        {/* Data Grid — secondary content */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[3fr_2fr]">
          {/* Left column */}
          <div className="space-y-6">
            {/* Today's Top Nudges */}
            {cardPrefs?.topNudges !== false && (
              <Card>
                <CardHeader>
                  <CardTitle>Today&apos;s Top Nudges</CardTitle>
                  <CardDescription>
                    Your highest-priority open nudges to act on
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {feedItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No open nudges right now.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {feedItems.map((item) => {
                        if (item.kind === "meeting") {
                          const meeting = item.meeting;
                          const topAttendee = meeting.attendees[0]?.contact;
                          const attendeeNames = meeting.attendees
                            .map((a) => a.contact.name)
                            .join(", ");
                          const summarySource = meeting.generatedBrief || meeting.purpose;
                          const summaryPreview = summarySource
                            ? summarySource.length > 200
                              ? summarySource.slice(0, 200).trimEnd() + "\u2026"
                              : summarySource
                            : null;
                          return (
                            <Card key={`mtg-${meeting.id}`} className="overflow-hidden">
                              <CardHeader className="pb-3 pt-5">
                                <div className="flex items-start gap-4">
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/30">
                                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <CardTitle className="text-lg font-bold">
                                        <Link href={`/meetings/${meeting.id}`} className="hover:text-primary hover:underline transition-colors">
                                          {meeting.title}
                                        </Link>
                                      </CardTitle>
                                      <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-400">
                                        Meeting Prep
                                      </Badge>
                                    </div>
                                    <CardDescription className="mt-0.5">
                                      {format(new Date(meeting.startTime), "EEE, MMM d · h:mm a")}
                                      {topAttendee?.company && ` · ${topAttendee.company.name}`}
                                    </CardDescription>
                                  </div>
                                </div>
                              </CardHeader>

                              <CardContent className="space-y-3">
                                <div className="rounded-xl border border-border bg-muted/30 px-5 py-4">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Sparkles className="h-4 w-4 text-indigo-600" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                                      {meeting.generatedBrief ? "Brief" : "Purpose"}
                                    </span>
                                  </div>
                                  {summaryPreview ? (
                                    <p className="text-sm text-foreground/70 leading-relaxed">{summaryPreview}</p>
                                  ) : (
                                    <p className="text-sm text-foreground/70 leading-relaxed">{attendeeNames}</p>
                                  )}
                                  {attendeeNames && summaryPreview && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      {attendeeNames}
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <Link
                                    href={`/meetings/${meeting.id}`}
                                    className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                                  >
                                    View more
                                    <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                                  </Link>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        }

                        const nudge = item.nudge;
                        const insights = parseInsights(nudge.metadata);
                        const fragments = buildSummaryFragments(nudge, insights);
                        return (
                          <Card key={nudge.id} className="overflow-hidden">
                            <CardHeader className="pb-3 pt-5">
                              <div className="flex items-start gap-4">
                                <Avatar name={nudge.contact.name} size="lg" className="shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <CardTitle className="text-lg font-bold">
                                      <Link href={`/contacts/${nudge.contact.id}`} className="hover:text-primary hover:underline transition-colors">
                                        {nudge.contact.name}
                                      </Link>
                                    </CardTitle>
                                    <Badge variant="outline" className={getPriorityClassName(nudge.priority)}>
                                      {nudge.priority}
                                    </Badge>
                                  </div>
                                  <CardDescription className="mt-0.5">
                                    {nudge.contact.title} at {nudge.contact.company.name}
                                  </CardDescription>
                                </div>
                              </div>
                            </CardHeader>

                            <CardContent className="space-y-3">
                              <div className="rounded-xl border border-border bg-muted/30 px-5 py-4">
                                <div className="flex items-center gap-1.5 mb-2.5">
                                  <Sparkles className="h-4 w-4 text-primary" />
                                  <span className="text-xs font-bold uppercase tracking-wider text-primary">AI Summary</span>
                                </div>
                                <p className="text-sm text-foreground/70 leading-relaxed">
                                  {fragments.map((f, i) =>
                                    f.bold ? (
                                      <strong key={i} className="font-semibold text-foreground/90">{f.text}</strong>
                                    ) : (
                                      <span key={i}>{f.text}</span>
                                    )
                                  )}
                                </p>
                              </div>

                              <div>
                                <Link
                                  href={`/contacts/${nudge.contact.id}?nudge=${nudge.id}`}
                                  className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                                >
                                  Take action
                                  <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                                </Link>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Today's Meetings & Briefs */}
            {cardPrefs?.todaysMeetings && (
              <Card>
                <CardHeader>
                  <CardTitle>Today&apos;s Meetings &amp; Briefs</CardTitle>
                  <CardDescription>
                    Your upcoming meetings with AI prep notes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(dashboardData?.upcomingMeetings?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No upcoming meetings.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {[...todayMeetings, ...tomorrowMeetings].slice(0, 6).map((meeting) => {
                        const topAttendee = meeting.attendees[0]?.contact;
                        const hasPrep = !!meeting.generatedBrief;
                        return (
                          <div key={meeting.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
                              <CalendarDays className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Link href={`/meetings/${meeting.id}`} className="text-sm font-medium text-foreground hover:text-primary hover:underline truncate">
                                  {meeting.title}
                                </Link>
                                <Badge variant="outline" className={hasPrep ? "border-green-200 bg-green-50 text-green-600 dark:border-green-900 dark:bg-green-950 dark:text-green-400 text-[10px]" : "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400 text-[10px]"}>
                                  {hasPrep ? "Brief ready" : "Prep needed"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground-subtle mt-0.5">
                                {format(new Date(meeting.startTime), "EEE h:mm a")}
                                {topAttendee?.company && ` · ${topAttendee.company.name}`}
                              </p>
                              {meeting.generatedBrief && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {meeting.generatedBrief}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Relationship Radar */}
            {cardPrefs?.relationshipRadar && (
              <ComingSoonCard
                title="Relationship Radar"
                description="High-importance contacts and clients with no meaningful touch in N days, or declining interaction trends — prioritized by strategic importance."
              />
            )}

            {/* Recent Touch Timeline */}
            {cardPrefs?.recentTouchTimeline && (
              <ComingSoonCard
                title="Recent Touch Timeline"
                description="Chronological strip of latest emails, calls, and meetings across priority contacts — filterable by client or time window."
              />
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Client News */}
            {cardPrefs?.clientNews !== false && (
              <Card>
                <CardHeader>
                  <CardTitle>Client News</CardTitle>
                  <CardDescription>
                    Recent signals across your contacts and companies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {newsGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No recent client news.
                    </p>
                  ) : (
                    <div className="space-y-5">
                      {newsGroups.map(({ clientName, topImportance, items }) => (
                        <div key={clientName}>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                              {clientName}
                            </p>
                            {topImportance && (
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getPriorityClassName(topImportance)}`}>
                                {topImportance}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-0 pl-0.5">
                            {items.slice(0, 4).map((item) => {
                              const cfg = getSignalTypeConfig(item.type);
                              const IIcon = cfg.icon;
                              return (
                                <div
                                  key={item.id}
                                  className="flex gap-3 pb-3 last:pb-0"
                                >
                                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                                    <IIcon className="h-3 w-3 text-muted-foreground-subtle" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    {item.contact?.name && (
                                      <p className="text-xs font-medium text-foreground">
                                        {item.contact.name}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {item.content}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground-subtle">
                                      {format(new Date(item.date), "MMM d")} · {item.type}
                                    </p>
                                    {item.url && (
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-0.5 inline-flex items-center text-xs font-medium text-primary hover:underline"
                                      >
                                        Read more
                                        <ExternalLink className="ml-0.5 h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pipeline Pulse */}
            {cardPrefs?.pipelinePulse && (
              <ComingSoonCard
                title="Pipeline Pulse"
                description="Open opportunities sorted by stage gate, close date, or staleness — with next step and last touch."
              />
            )}

            {/* Campaign & Content Dissemination Momentum */}
            {cardPrefs?.campaignMomentum && (
              <ComingSoonCard
                title="Campaign & Content Dissemination Momentum"
                description="Active campaigns with progress metrics (targets touched, replies, next wave) and recommended next actions."
              />
            )}

            {/* Whitespace */}
            {cardPrefs?.whitespace && (
              <ComingSoonCard
                title="Whitespace"
                description="Key clients with open pipeline, recent signals, and coverage gaps (e.g., single-threaded relationships, few senior contacts)."
              />
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

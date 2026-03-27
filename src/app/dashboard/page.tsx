"use client";

import { useEffect, useRef, useState } from "react";
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
  Activity,
  MessageCircle,
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
import { format, isToday, isTomorrow, isYesterday } from "date-fns";
import {
  buildExecutiveBriefing,
  buildSuggestedActionHeadline,
  formatRelativeNewsTime,
  priorityAssistantLabel,
  type BriefingParagraph,
} from "@/lib/dashboard-assistant-copy";

type CriticalBreakingItem = {
  id: string;
  storyKindLabel: string;
  catchyTitle: string;
  date: string;
  url: string | null;
  linkContactId: string | null;
  linkCompanyId: string | null;
};

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
    contact: { name: string; company?: string; id?: string } | null;
    company: { id: string; name: string } | null;
    storyKind: string;
    storyKindLabel: string;
    priorityContactRelevant: boolean;
  }>;
  criticalBreakingNews: CriticalBreakingItem[];
  recentInteractions?: Array<{
    id: string;
    type: string;
    date: string;
    summary: string;
    contact: { id: string; name: string; company: { name: string } };
  }>;
};

type InsightData = {
  type: string;
  reason: string;
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

function parseInsights(metadata?: string | null): InsightData[] {
  if (!metadata) return [];
  try {
    const parsed = JSON.parse(metadata);
    return parsed?.insights ?? [];
  } catch {
    return [];
  }
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
      return "border-border bg-muted/50 text-muted-foreground";
    default:
      return "border-border bg-muted/50 text-muted-foreground";
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
  JOB_CHANGE: { icon: Briefcase, label: "Executive transition", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30" },
  COMPANY_NEWS: { icon: Newspaper, label: "Company news", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
  UPCOMING_EVENT: { icon: CalendarDays, label: "Upcoming event", color: "text-teal-600", bgColor: "bg-teal-50 dark:bg-teal-950/30" },
  MEETING_PREP: { icon: ClipboardList, label: "Meeting prep", color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-950/30" },
  EVENT_ATTENDED: { icon: Ticket, label: "Event follow-up", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/30" },
  EVENT_REGISTERED: { icon: CalendarCheck, label: "Event outreach", color: "text-cyan-600", bgColor: "bg-cyan-50 dark:bg-cyan-950/30" },
  ARTICLE_READ: { icon: BookOpen, label: "Content follow-up", color: "text-rose-600", bgColor: "bg-rose-50 dark:bg-rose-950/30" },
  LINKEDIN_ACTIVITY: { icon: Linkedin, label: "LinkedIn activity", color: "text-sky-600", bgColor: "bg-sky-50 dark:bg-sky-950/30" },
};

const DEFAULT_TYPE_CONFIG: NudgeTypeConfig = {
  icon: Send,
  label: "Nudge",
  color: "text-muted-foreground",
  bgColor: "bg-muted/50",
};

function getTypeConfig(ruleType: string): NudgeTypeConfig {
  return NUDGE_TYPE_CONFIG[ruleType] ?? DEFAULT_TYPE_CONFIG;
}

function getSignalTypeConfig(type: string): NudgeTypeConfig {
  const map: Record<string, NudgeTypeConfig> = {
    NEWS: NUDGE_TYPE_CONFIG.COMPANY_NEWS,
    JOB_CHANGE: NUDGE_TYPE_CONFIG.JOB_CHANGE,
    EVENT: NUDGE_TYPE_CONFIG.UPCOMING_EVENT,
  };
  return map[type] ?? DEFAULT_TYPE_CONFIG;
}

const DASHBOARD_SUGGESTED_QUESTIONS = [
  "Give me a quick recap of my week",
  "Who should I check in with first?",
  "What should I know for tomorrow's meetings?",
  "Catch me up on my priority accounts",
  "Who haven't I spoken to in a while?",
  "Who in my network really knows my key contacts?",
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

function groupNewsByTime(news: DashboardData["clientNews"]): { label: string; items: typeof news }[] {
  const today: typeof news = [];
  const yesterday: typeof news = [];
  const thisWeek: typeof news = [];

  for (const item of news) {
    const d = new Date(item.date);
    if (isToday(d)) today.push(item);
    else if (isYesterday(d)) yesterday.push(item);
    else thisWeek.push(item);
  }

  const buckets: { label: string; items: typeof news }[] = [];
  if (today.length > 0) buckets.push({ label: "Today", items: today });
  if (yesterday.length > 0) buckets.push({ label: "Yesterday", items: yesterday });
  if (thisWeek.length > 0) buckets.push({ label: "This week", items: thisWeek });
  return buckets;
}

function breakingItemHref(item: CriticalBreakingItem): string | null {
  if (item.linkContactId) return `/contacts/${item.linkContactId}`;
  if (item.linkCompanyId) return `/companies/${item.linkCompanyId}`;
  return null;
}

const URGENT_PRIORITIES = new Set(["URGENT", "HIGH"]);

function renderMeetingPrepRow(meeting: DashboardData["upcomingMeetings"][0]) {
  const attendeeNames = meeting.attendees.map((a) => a.contact.name).join(", ");
  const topAttendee = meeting.attendees[0]?.contact;
  const d = new Date(meeting.startTime);
  const when = isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEE, MMM d");
  return (
    <Link
      key={meeting.id}
      href={`/meetings/${meeting.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-muted/30"
    >
      <div className="flex items-start gap-2 p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <ClipboardList className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {when}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(d, "h:mm a")}
            </span>
          </div>
          <p className="font-medium text-foreground text-sm mt-0.5">{meeting.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {attendeeNames}
            {topAttendee?.company && ` · ${topAttendee.company.name}`}
          </p>
          <span className="inline-flex items-center text-xs font-medium text-primary hover:underline mt-1">
            View brief
            <ChevronRight className="ml-0.5 h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [topNudges, setTopNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [dashboardRes, nudgesRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/nudges?status=OPEN"),
        ]);

        if (!dashboardRes.ok) {
          const body = await dashboardRes.json().catch(() => ({}));
          const message =
            body && typeof body.error === "string" ? body.error : "Failed to fetch dashboard";
          throw new Error(message);
        }
        const dashboard = await dashboardRes.json();
        setDashboardData(dashboard);

        if (nudgesRes.ok) {
          const nudges = await nudgesRes.json();
          setTopNudges(nudges.slice(0, 5));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const userName = session?.user?.name ?? "Partner";
  const chatInputRef = useRef<HTMLInputElement>(null);
  const now = new Date();

  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    router.push(`/chat?q=${encodeURIComponent(text)}`);
  }

  function handleSuggestedQuestion(q: string) {
    setChatInput(q);
    chatInputRef.current?.focus();
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="space-y-8">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-24 max-w-2xl mx-auto" />
          <Skeleton className="h-32" />
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Skeleton className="h-80" />
            <div className="space-y-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-48" />
            </div>
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
  const todayMeetingBucket = meetingBuckets.find((b) => b.label === "Today");
  const tomorrowMeetingBucket = meetingBuckets.find((b) => b.label === "Tomorrow");
  const laterMeetingBucket = meetingBuckets.find((b) => b.label === "Later this week");
  const meetingsTodayTomorrow = [
    ...(todayMeetingBucket?.meetings ?? []),
    ...(tomorrowMeetingBucket?.meetings ?? []),
  ];
  const hasLaterWeekMeetings = (laterMeetingBucket?.meetings.length ?? 0) > 0;

  const criticalBreaking = dashboardData?.criticalBreakingNews ?? [];
  const breakingIds = new Set(criticalBreaking.map((x) => x.id));
  const todayNewsForToday = (dashboardData?.clientNews ?? []).filter(
    (item) => isToday(new Date(item.date)) && !breakingIds.has(item.id)
  );
  const clientNewsNotToday = (dashboardData?.clientNews ?? []).filter(
    (item) => !isToday(new Date(item.date))
  );
  const newsBuckets = clientNewsNotToday.length ? groupNewsByTime(clientNewsNotToday) : [];

  const forTodayNudges = topNudges.filter((n) => URGENT_PRIORITIES.has(n.priority));
  const suggestedNudges = topNudges.filter((n) => !URGENT_PRIORITIES.has(n.priority));

  const timeGreeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  })();

  const firstName = (userName ?? "Partner").split(/\s+/)[0] || userName || "Partner";

  const briefingParagraphs: BriefingParagraph[] | null = dashboardData
    ? buildExecutiveBriefing(dashboardData, {
        criticalBreakingCount: criticalBreaking.length,
        criticalBreakingLeads: criticalBreaking.slice(0, 2).map((item) => ({
          catchyTitle: item.catchyTitle,
        })),
        todayTomorrowMeetingCount: meetingsTodayTomorrow.length,
        hasLaterWeekMeetings,
        forTodayUrgentNudgeCount: forTodayNudges.length,
        suggestedNudgeCount: suggestedNudges.length,
        topUrgentNudge: forTodayNudges[0]
          ? {
              contact: forTodayNudges[0].contact,
              ruleType: forTodayNudges[0].ruleType,
              reason: forTodayNudges[0].reason,
            }
          : undefined,
        meetingLeads: meetingsTodayTomorrow.slice(0, 2).map((m) => {
          const top = m.attendees[0]?.contact;
          return {
            title: m.title,
            startTime: m.startTime,
            primaryAttendeeName: top?.name,
            companyName: top?.company?.name,
          };
        }),
        suggestedStartNudge: suggestedNudges[0]
          ? {
              contact: suggestedNudges[0].contact,
              ruleType: suggestedNudges[0].ruleType,
            }
          : undefined,
      })
    : null;

  const forTodayHasContent =
    criticalBreaking.length > 0 ||
    meetingsTodayTomorrow.length > 0 ||
    todayNewsForToday.length > 0 ||
    forTodayNudges.length > 0;

  const recentMemory = dashboardData?.recentInteractions ?? [];

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div className="text-center space-y-1 max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {timeGreeting}, {firstName}
          </h1>
          <p className="text-lg text-muted-foreground">
            I&apos;ve got the key client updates ready—what do you want to know?
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          {briefingParagraphs && briefingParagraphs.length > 0 && (
            <div className="flex h-full min-h-0 items-start gap-1.5 rounded-2xl border border-border bg-muted/35 pt-6 pb-4 pl-4 pr-6 shadow-sm dark:bg-muted/25 sm:pr-7">
              <MessageCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:h-[1.125rem] sm:w-[1.125rem]"
                aria-hidden
              />
              <div className="flex min-w-0 max-w-prose flex-1 flex-col gap-3 text-xs leading-snug text-foreground/85 sm:text-sm">
                {briefingParagraphs.map((para, pi) => (
                  <p key={pi} className="m-0 text-pretty leading-snug">
                    {para.map((part, i) =>
                      part.type === "strong" ? (
                        <strong key={i} className="font-semibold text-foreground">
                          {part.value}
                        </strong>
                      ) : (
                        <span key={i}>{part.value}</span>
                      )
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}
          <Card className={`shadow-sm ${briefingParagraphs && briefingParagraphs.length > 0 ? "" : "lg:col-span-2"}`}>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-foreground mb-3">Quick question</p>
              <form onSubmit={handleChatSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex flex-1">
                    <Sparkles className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={chatInputRef}
                      id="dashboard-chat"
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask me anything—people, meetings, or what to do next…"
                      className="flex-1 rounded-lg border border-border bg-background pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <Button type="submit" size="default" disabled={!chatInput.trim()}>
                    Ask
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DASHBOARD_SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSuggestedQuestion(q)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Sparkles className="h-3 w-3 text-primary" />
                      {q}
                    </button>
                  ))}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle>For today</CardTitle>
            <CardDescription>
              Meetings, time-sensitive suggestions, priority alerts, and today&apos;s signals in one place
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {!forTodayHasContent && (
              <p className="text-sm text-muted-foreground">
                You&apos;re clear for the moment—nothing time-sensitive on the radar.
              </p>
            )}

            {meetingsTodayTomorrow.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Today &amp; tomorrow
                </h3>
                <div className="space-y-2">
                  {meetingsTodayTomorrow.map((m) => renderMeetingPrepRow(m))}
                </div>
              </div>
            )}

            {forTodayNudges.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Time-sensitive suggestions
                </h3>
                <div className="space-y-2">
                  {forTodayNudges.map((nudge) => {
                    const cfg = getTypeConfig(nudge.ruleType);
                    const actionLine = buildSuggestedActionHeadline(
                      nudge.ruleType,
                      nudge.contact.name,
                      nudge.contact.company.name,
                      cfg.label
                    );
                    return (
                      <button
                        key={nudge.id}
                        type="button"
                        onClick={() => router.push(`/contacts/${nudge.contact.id}`)}
                        className="flex w-full items-start gap-3 rounded-lg border border-border bg-background/80 p-3 text-left transition-colors hover:bg-muted/40 dark:bg-card/50"
                      >
                        <Avatar name={nudge.contact.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium ${getPriorityClassName(nudge.priority)}`}
                            >
                              {priorityAssistantLabel(nudge.priority)}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-foreground mt-1">{actionLine}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {nudge.reason}
                          </p>
                          <span className="text-xs font-medium text-primary mt-1 inline-flex items-center">
                            Open contact
                            <ChevronRight className="ml-0.5 h-3 w-3" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {criticalBreaking.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Priority contact alerts
                </h3>
                <div className="space-y-3">
                  {criticalBreaking.map((item) => {
                    const href = breakingItemHref(item);
                    const rel = formatRelativeNewsTime(new Date(item.date), now);
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border/80 bg-background/80 p-4 dark:bg-card/50"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-[10px] font-semibold">
                            {item.storyKindLabel}
                          </Badge>
                          <span className="text-xs text-muted-foreground tabular-nums">{rel}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground leading-snug">{item.catchyTitle}</p>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {href && (
                            <Link
                              href={href}
                              className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                            >
                              Open in Activate
                              <ChevronRight className="ml-0.5 h-3 w-3" />
                            </Link>
                          )}
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                            >
                              Read source
                              <ExternalLink className="ml-0.5 h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {todayNewsForToday.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Today&apos;s signals
                </h3>
                <div className="space-y-3">
                  {todayNewsForToday.slice(0, 8).map((item) => {
                    const cfg = getSignalTypeConfig(item.type);
                    const IIcon = cfg.icon;
                    const entity = item.contact
                      ? `${item.contact.name}${item.contact.company ? ` · ${item.contact.company}` : ""}`
                      : item.company?.name ?? "Unknown";
                    const rel = formatRelativeNewsTime(new Date(item.date), now);
                    return (
                      <div key={item.id} className="flex gap-3 rounded-lg border border-border/80 bg-background/80 p-3 dark:bg-card/50">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <IIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-medium">
                              {item.storyKindLabel ?? item.type}
                            </Badge>
                            {item.priorityContactRelevant && (
                              <Badge variant="secondary" className="text-[10px]">
                                Priority contact
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">{rel}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground mt-1">
                            {item.type === "NEWS" ? item.company?.name ?? entity : entity}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.content}</p>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center text-xs font-medium text-primary hover:underline"
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
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Suggested for you</CardTitle>
              <CardDescription>
                A few moves that strengthen relationships—tap a row to open the contact
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestedNudges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {forTodayNudges.length > 0
                    ? "Everything open is time-sensitive—see For today above."
                    : "You're all caught up—nothing queued here right now."}
                </p>
              ) : (
                <div className="space-y-2">
                  {suggestedNudges.map((nudge) => {
                    const cfg = getTypeConfig(nudge.ruleType);
                    const insights = parseInsights(nudge.metadata);
                    const actionLine = buildSuggestedActionHeadline(
                      nudge.ruleType,
                      nudge.contact.name,
                      nudge.contact.company.name,
                      cfg.label
                    );
                    const CfgIcon = cfg.icon;
                    return (
                      <button
                        key={nudge.id}
                        type="button"
                        onClick={() => router.push(`/contacts/${nudge.contact.id}`)}
                        className="flex w-full items-start gap-3 rounded-lg border border-border bg-background/80 p-3 text-left transition-colors hover:bg-muted/40 dark:bg-card/50"
                      >
                        <Avatar name={nudge.contact.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground leading-snug pr-2">
                              {actionLine}
                            </p>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-[10px] font-medium ${getPriorityClassName(nudge.priority)}`}
                            >
                              {priorityAssistantLabel(nudge.priority)}
                            </Badge>
                          </div>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CfgIcon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                            <span>
                              {nudge.contact.name} · {nudge.contact.title} at{" "}
                              {nudge.contact.company.name}
                            </span>
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                            {nudge.reason}
                          </p>
                          {insights.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {insights.slice(0, 3).map((insight, i) => {
                                const ic = getTypeConfig(insight.type);
                                const IIcon = ic.icon;
                                return (
                                  <div key={i} className="flex items-start gap-2 text-xs">
                                    <IIcon className={`h-3 w-3 mt-0.5 shrink-0 ${ic.color}`} />
                                    <span className="text-muted-foreground line-clamp-1">
                                      {insight.reason}
                                    </span>
                                  </div>
                                );
                              })}
                              {insights.length > 3 && (
                                <p className="text-xs text-muted-foreground pl-5">
                                  +{insights.length - 3} more insights
                                </p>
                              )}
                            </div>
                          )}
                          <span className="text-xs font-medium text-primary mt-2 inline-flex items-center">
                            Open contact
                            <ChevronRight className="ml-0.5 h-3 w-3" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Meetings I&apos;m tracking</CardTitle>
                <CardDescription>
                  Later this week (today &amp; tomorrow are in For today)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!laterMeetingBucket || laterMeetingBucket.meetings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No meetings later this week in the next seven days.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {laterMeetingBucket.meetings.map((meeting) => renderMeetingPrepRow(meeting))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What&apos;s moving in your accounts</CardTitle>
                <CardDescription>
                  Public signals you can use as conversation starters
                </CardDescription>
              </CardHeader>
              <CardContent>
                {newsBuckets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No other recent signals right now.</p>
                ) : (
                  <div className="space-y-4">
                    {newsBuckets.map(({ label, items }) => (
                      <div key={label}>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          {label}
                        </h3>
                        <div className="space-y-0">
                          {items.slice(0, 5).map((item) => {
                            const cfg = getSignalTypeConfig(item.type);
                            const IIcon = cfg.icon;
                            const entity = item.contact
                              ? `${item.contact.name}${item.contact.company ? ` · ${item.contact.company}` : ""}`
                              : item.company?.name ?? "Unknown";
                            const rel = formatRelativeNewsTime(new Date(item.date), now);
                            return (
                              <div key={item.id} className="flex gap-3 pb-4 last:pb-0">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                                  <IIcon className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 gap-y-1">
                                    <Badge variant="outline" className="text-[10px] font-medium">
                                      {item.storyKindLabel ?? item.type}
                                    </Badge>
                                    {item.priorityContactRelevant && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        Priority contact
                                      </Badge>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">{rel}</span>
                                  </div>
                                  <p className="text-sm font-medium text-foreground mt-1">
                                    {item.type === "NEWS" ? item.company?.name ?? entity : entity}
                                  </p>
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                    {item.content}
                                  </p>
                                  {item.url && (
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-1 inline-flex items-center text-xs font-medium text-primary hover:underline"
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
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What I remember from your last touches</CardTitle>
            <CardDescription>
              Recent interactions so nothing slips through the cracks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentMemory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent interactions logged yet.</p>
            ) : (
              <ul className="space-y-4">
                {recentMemory.map((interaction) => (
                  <li key={interaction.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        You last connected with{" "}
                        <Link
                          href={`/contacts/${interaction.contact.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {interaction.contact.name}
                        </Link>{" "}
                        at {interaction.contact.company.name}
                        {" — "}
                        {format(new Date(interaction.date), "MMM d, yyyy")}
                        {interaction.type
                          ? ` · ${interaction.type.replace(/_/g, " ").toLowerCase()}`
                          : ""}
                        .
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {interaction.summary}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

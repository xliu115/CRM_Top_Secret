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
import { buildSummaryFragments } from "@/lib/utils/nudge-summary";

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
    contact: { name: string; company?: string } | null;
    company: { id: string; name: string } | null;
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
  icon: Send, label: "Nudge", color: "text-muted-foreground", bgColor: "bg-muted/50",
};

function getSignalTypeConfig(type: string): NudgeTypeConfig {
  const map: Record<string, NudgeTypeConfig> = {
    NEWS: NUDGE_TYPE_CONFIG.COMPANY_NEWS,
    JOB_CHANGE: NUDGE_TYPE_CONFIG.JOB_CHANGE,
    EVENT: NUDGE_TYPE_CONFIG.UPCOMING_EVENT,
  };
  return map[type] ?? DEFAULT_TYPE_CONFIG;
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
  const now = new Date();
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
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const userName = session?.user?.name ?? "Partner";

  const chatInputRef = useRef<HTMLInputElement>(null);

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
          <Skeleton className="h-10 w-64" />
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
  const newsBuckets = dashboardData?.clientNews?.length
    ? groupNewsByTime(dashboardData.clientNews)
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
      <div className="space-y-8">
        {/* Centered greeting above chat — reference design */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {timeGreeting}, {firstName}
          </h1>
          <p className="text-3xl font-bold tracking-tight text-foreground">
            What&apos;s on{" "}
            <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
              your mind
            </span>
            ?
          </p>
        </div>

        {/* Chat bar */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
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
                    placeholder="Ask AI a question or make a request…"
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

        {/* Option D: 60% Nudges | 40% Meetings + News stacked */}
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          {/* Left: Today's Top Nudges */}
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Top Nudges</CardTitle>
              <CardDescription>
                Your highest-priority open nudges to act on
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topNudges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No open nudges right now.
                </p>
              ) : (
                <div className="space-y-4">
                  {topNudges.map((nudge) => {
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

          {/* Right column: Meeting Prep + Client News stacked */}
          <div className="space-y-6">
            {/* Meeting Prep — Next 7 Days */}
            <Card>
              <CardHeader>
                <CardTitle>Meeting Prep — Next 7 Days</CardTitle>
                <CardDescription>
                  Upcoming priority client meetings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {meetingBuckets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No meetings in the next 7 days.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {meetingBuckets.map(({ label, meetings }) => (
                      <div key={label}>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          {label}
                        </h3>
                        <div className="space-y-2">
                          {meetings.map((meeting) => {
                            const attendeeNames = meeting.attendees
                              .map((a) => a.contact.name)
                              .join(", ");
                            const topAttendee = meeting.attendees[0]?.contact;
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
                                    <p className="font-medium text-foreground text-sm">{meeting.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {format(new Date(meeting.startTime), "EEE, MMM d · h:mm a")}
                                    </p>
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
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Client News */}
            <Card>
              <CardHeader>
                <CardTitle>Client News</CardTitle>
                <CardDescription>
                  Recent signals across your contacts and companies
                </CardDescription>
              </CardHeader>
              <CardContent>
                {newsBuckets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recent client news.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {newsBuckets.map(({ label, items }) => (
                      <div key={label}>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          {label}
                        </h3>
                        <div className="space-y-0">
                          {items.slice(0, 5).map((item, idx) => {
                            const cfg = getSignalTypeConfig(item.type);
                            const IIcon = cfg.icon;
                            const entity = item.contact
                              ? `${item.contact.name}${item.contact.company ? ` · ${item.contact.company}` : ""}`
                              : item.company?.name ?? "Unknown";
                            return (
                              <div
                                key={item.id}
                                className="flex gap-3 pb-4 last:pb-0"
                              >
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                                  <IIcon className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground">
                                    {item.type === "NEWS" ? item.company?.name ?? entity : entity}
                                  </p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {item.content}
                                  </p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {format(new Date(item.date), "MMM d")} · {item.type}
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
      </div>
    </DashboardShell>
  );
}

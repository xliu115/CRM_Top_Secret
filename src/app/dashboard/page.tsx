"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Users,
  Bell,
  Calendar,
  ChevronRight,
  Activity,
  ExternalLink,
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
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

type DashboardData = {
  contactCount: number;
  openNudgeCount: number;
  upcomingMeetingCount: number;
  recentInteractions: Array<{
    id: string;
    type: string;
    date: string;
    summary: string;
    contact: {
      id: string;
      name: string;
      company: { name: string };
    };
  }>;
};

type Nudge = {
  id: string;
  reason: string;
  priority: string;
  contact: { id: string; name: string; title: string; company: { name: string } };
  signal?: { type: string; content: string; url?: string | null } | null;
};

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

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [topNudges, setTopNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          throw new Error("Failed to fetch dashboard");
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

  if (loading) {
    return (
      <DashboardShell>
        <div className="space-y-8">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
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

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Welcome back, {userName}. Here&apos;s what&apos;s happening today.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/contacts">
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Contacts
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {dashboardData?.contactCount ?? 0}
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/nudges">
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Open Nudges
                </CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {dashboardData?.openNudgeCount ?? 0}
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/meetings">
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Upcoming Meetings
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {dashboardData?.upcomingMeetingCount ?? 0}
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Today's Top Nudges */}
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
                  {topNudges.map((nudge) => (
                    <div
                      key={nudge.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/contacts/${nudge.contact.id}`)}
                      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/contacts/${nudge.contact.id}`); }}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                    >
                      <Avatar name={nudge.contact.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {nudge.contact.name}
                          </span>
                          <Badge variant="outline" className={getPriorityClassName(nudge.priority)}>
                            {nudge.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {nudge.contact.company.name}
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {nudge.reason}
                        </p>
                        {nudge.signal?.url && (
                          <a
                            href={nudge.signal.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Read article
                          </a>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Interactions</CardTitle>
              <CardDescription>
                Latest interactions across your contacts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!dashboardData?.recentInteractions?.length ? (
                <p className="text-sm text-muted-foreground">
                  No recent activity.
                </p>
              ) : (
                <div className="space-y-0">
                  {dashboardData.recentInteractions.map((interaction, idx) => (
                    <div
                      key={interaction.id}
                      className="flex gap-4 pb-6 last:pb-0"
                    >
                      <div className="relative flex flex-col items-center">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        </div>
                        {idx < dashboardData.recentInteractions.length - 1 && (
                          <div className="absolute top-8 left-1/2 h-full w-px -translate-x-px bg-border" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-sm font-medium text-foreground">
                          {interaction.contact.name} at{" "}
                          {interaction.contact.company.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {interaction.summary}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(interaction.date), "MMM d, yyyy")} ·{" "}
                          {interaction.type}
                        </p>
                        <Link
                          href={`/contacts/${interaction.contact.id}`}
                          className="mt-2 inline-flex items-center text-sm font-medium text-primary hover:underline"
                        >
                          View contact
                          <ChevronRight className="ml-0.5 h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, User, Moon, Check, ExternalLink } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
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

type Nudge = {
  id: string;
  reason: string;
  priority: string;
  status: string;
  contact: {
    id: string;
    name: string;
    title: string;
    company: { name: string };
  };
  signal?: {
    type: string;
    content: string;
    url?: string | null;
  } | null;
};

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "SNOOZED", label: "Snoozed" },
  { value: "DONE", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
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


export default function NudgesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNudges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const res = await fetch(`/api/nudges?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch nudges");
      const data = await res.json();
      setNudges(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchNudges();
  }, [fetchNudges]);

  async function handleRefreshNudges() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/nudges/refresh", { method: "POST" });
      if (!res.ok) throw new Error("Failed to refresh nudges");
      await fetchNudges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleUpdateStatus(nudgeId: string, status: string) {
    try {
      const res = await fetch(`/api/nudges/${nudgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update nudge");
      await fetchNudges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (loading && nudges.length === 0) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-12 w-full" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Nudges
            </h1>
            <p className="mt-1 text-muted-foreground">
              Action items and reminders for your contacts
            </p>
          </div>
          <Button
            onClick={handleRefreshNudges}
            disabled={refreshing}
            variant="secondary"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh Nudges
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Status:
            </span>
            {STATUS_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={statusFilter === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Priority:
            </span>
            {PRIORITY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={priorityFilter === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPriorityFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Nudge list */}
        <div className="space-y-4">
          {nudges.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No nudges found. Try adjusting your filters or refresh to generate new nudges.
              </CardContent>
            </Card>
          ) : (
            [...nudges].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)).map((nudge) => (
              <Card key={nudge.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4">
                    <Avatar name={nudge.contact.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">
                          {nudge.contact.name}
                        </CardTitle>
                        <Badge variant="outline" className={getPriorityClassName(nudge.priority)}>
                          {nudge.priority}
                        </Badge>
                      </div>
                      <CardDescription>
                        {nudge.contact.title} at {nudge.contact.company.name}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-foreground">{nudge.reason}</p>
                  {nudge.signal && (
                    <div className="rounded-md border border-border bg-muted/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Signal ({nudge.signal.type})
                        </p>
                        {nudge.signal.url && (
                          <a
                            href={nudge.signal.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View source
                          </a>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-foreground">
                        {nudge.signal.content}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="default" size="sm">
                      <Link href={`/contacts/${nudge.contact.id}`}>
                        <User className="h-4 w-4" />
                        View Contact
                      </Link>
                    </Button>
                    {nudge.status === "OPEN" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(nudge.id, "SNOOZED")}
                        >
                          <Moon className="h-4 w-4" />
                          Snooze
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(nudge.id, "DONE")}
                        >
                          <Check className="h-4 w-4" />
                          Done
                        </Button>
                      </>
                    )}
                    {nudge.status === "SNOOZED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus(nudge.id, "DONE")}
                      >
                        <Check className="h-4 w-4" />
                        Done
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

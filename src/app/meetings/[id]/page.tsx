"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Users,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownPreview } from "@/components/ui/markdown-preview";
import { FreshnessIndicator } from "@/components/meetings/freshness-indicator";
import { StructuredBriefCard } from "@/components/meetings/structured-brief-card";
import { NewsInsightsCard } from "@/components/meetings/news-insights-card";
import { ExecutiveProfileCard } from "@/components/meetings/executive-profile-card";
import { RelationshipHistoryCard } from "@/components/meetings/relationship-history-card";
import { AttendeeChipGrid } from "@/components/meetings/attendee-chip-grid";
import {
  parseStructuredBrief,
  formatBriefAsText,
} from "@/lib/types/structured-brief";

type Meeting = {
  id: string;
  title: string;
  purpose: string | null;
  startTime: string;
  createdAt?: string;
  generatedBrief: string | null;
  attendees: {
    contact: {
      id: string;
      name: string;
      title: string;
      company: { name: string };
    };
  }[];
};

export default function MeetingDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  async function fetchMeeting() {
    if (!id) return;
    try {
      const res = await fetch(`/api/meetings/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Meeting not found");
        throw new Error("Failed to fetch meeting");
      }
      const data = await res.json();
      setMeeting(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMeeting(null);
    setLoading(true);
    setError(null);
    setBriefError(null);
    fetchMeeting();
  }, [id]);

  async function handleGenerateBrief() {
    if (!id) return;
    setGeneratingBrief(true);
    setBriefError(null);
    try {
      const res = await fetch(`/api/meetings/${id}/brief?force=true`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Failed to generate brief"
        );
      }
      const { brief } = data as { brief: string };
      setMeeting((prev) =>
        prev ? { ...prev, generatedBrief: brief } : null
      );
    } catch (err) {
      setBriefError(
        err instanceof Error ? err.message : "Failed to generate brief"
      );
    } finally {
      setGeneratingBrief(false);
    }
  }

  async function handleCopyBrief() {
    if (!meeting?.generatedBrief) return;
    const structured = parseStructuredBrief(meeting.generatedBrief);
    const text = structured
      ? formatBriefAsText(structured)
      : meeting.generatedBrief;
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setBriefError("Failed to copy to clipboard");
      setTimeout(() => setBriefError(null), 3000);
    }
  }

  if (loading && !meeting) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardShell>
    );
  }

  if (error || !meeting) {
    return (
      <DashboardShell>
        <div className="space-y-4">
          <Button variant="ghost" asChild>
            <Link href="/meetings" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Meetings
            </Link>
          </Button>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error ?? "Meeting not found"}
          </div>
        </div>
      </DashboardShell>
    );
  }

  const structuredBrief = parseStructuredBrief(meeting.generatedBrief);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/meetings" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Meetings
          </Link>
        </Button>

        {/* Meeting Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{meeting.title}</CardTitle>
                <CardDescription className="mt-1">
                  {format(
                    new Date(meeting.startTime),
                    "EEEE, MMMM d, yyyy 'at' h:mm a"
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {meeting.generatedBrief && (
                  <FreshnessIndicator generatedAt={meeting.createdAt ?? null} />
                )}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {meeting.attendees.length}
                </div>
              </div>
            </div>
            {meeting.purpose && (
              <p className="text-foreground mt-2">{meeting.purpose}</p>
            )}
          </CardHeader>
        </Card>

        {/* Brief content — structured or legacy */}
        {structuredBrief ? (
          <>
            {/* Hero Card */}
            <StructuredBriefCard brief={structuredBrief} />

            {/* Detailed Prep divider */}
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Detailed Prep
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Prep Detail sections */}
            <NewsInsightsCard
              insights={structuredBrief.newsInsights}
              emptyReason={structuredBrief.newsEmptyReason}
            />
            <ExecutiveProfileCard
              profile={structuredBrief.executiveProfile}
            />
            <RelationshipHistoryCard
              history={structuredBrief.relationshipHistory}
            />
            <AttendeeChipGrid attendees={structuredBrief.attendees} />

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateBrief}
                disabled={generatingBrief}
              >
                {generatingBrief ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate Brief
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyBrief}
              >
                {copySuccess ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Brief
                  </>
                )}
              </Button>
              {briefError && (
                <p className="text-sm text-destructive">{briefError}</p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Legacy: Attendees card */}
            <Card>
              <CardHeader>
                <CardTitle>Attendees</CardTitle>
                <CardDescription>
                  People invited to this meeting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {meeting.attendees.map((a) => (
                    <Link
                      key={a.contact.id}
                      href={`/contacts/${a.contact.id}`}
                      className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                    >
                      <Avatar name={a.contact.name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {a.contact.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {a.contact.title} at {a.contact.company.name}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Legacy: Meeting Brief card */}
            <Card>
              <CardHeader>
                <CardTitle>Meeting Brief</CardTitle>
                <CardDescription>
                  AI-generated preparation brief for this meeting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {meeting.generatedBrief ? (
                  <>
                    <div className="rounded-md border border-border bg-muted/30 p-4">
                      <MarkdownPreview content={meeting.generatedBrief} />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyBrief}
                    >
                      {copySuccess ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Brief
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <Button
                      onClick={handleGenerateBrief}
                      disabled={generatingBrief}
                    >
                      {generatingBrief ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate Brief"
                      )}
                    </Button>
                    {briefError && (
                      <p className="text-sm text-destructive">{briefError}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

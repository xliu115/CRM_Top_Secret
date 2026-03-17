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

type Meeting = {
  id: string;
  title: string;
  purpose: string | null;
  startTime: string;
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
    fetchMeeting();
  }, [id]);

  async function handleGenerateBrief() {
    if (!id) return;
    setGeneratingBrief(true);
    try {
      const res = await fetch(`/api/meetings/${id}/brief`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate brief");
      const { brief } = await res.json();
      setMeeting((prev) =>
        prev ? { ...prev, generatedBrief: brief } : null
      );
    } catch {
      setError("Failed to generate brief");
    } finally {
      setGeneratingBrief(false);
    }
  }

  function handleCopyBrief() {
    if (!meeting?.generatedBrief) return;
    void navigator.clipboard.writeText(meeting.generatedBrief);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
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

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/meetings" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Meetings
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{meeting.title}</CardTitle>
            <CardDescription>
              {format(new Date(meeting.startTime), "EEEE, MMMM d, yyyy 'at' h:mm a")}
            </CardDescription>
            {meeting.purpose && (
              <p className="text-foreground">{meeting.purpose}</p>
            )}
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendees</CardTitle>
            <CardDescription>People invited to this meeting</CardDescription>
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
                    <p className="font-medium text-foreground">{a.contact.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.contact.title} at {a.contact.company.name}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

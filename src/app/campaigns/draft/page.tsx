"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Loader2, BookOpen, AlertCircle } from "lucide-react";
import Link from "next/link";

function DraftContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentItemId = searchParams.get("contentItemId");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!contentItemId || creating) return;
    setCreating(true);

    fetch("/api/campaigns/from-article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentItemId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to create campaign");
        }
        return res.json();
      })
      .then(({ campaignId }) => {
        router.replace(`/campaigns/new?edit=${campaignId}&step=recipients`);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Something went wrong");
      });
  }, [contentItemId, router, creating]);

  if (!contentItemId) {
    return (
      <DashboardShell>
        <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No article specified.</p>
          <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
            Back to dashboard
          </Link>
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell>
        <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
            Back to dashboard
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <BookOpen className="h-7 w-7 text-primary" />
        </div>
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Preparing your article campaign...
            </h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Matching contacts, generating personalized email drafts, and setting up
            your campaign. This may take a moment.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function DraftCampaignPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center gap-4">
            <div className="h-16 w-16 animate-pulse rounded-2xl bg-primary/10" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </DashboardShell>
      }
    >
      <DraftContent />
    </Suspense>
  );
}

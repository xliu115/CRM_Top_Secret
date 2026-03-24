"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Share2 } from "lucide-react";

export default function CampaignsPage() {
  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <Badge variant="secondary" className="mb-4">
            Coming soon
          </Badge>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Share2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Campaigns</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            You’ll be able to build, launch, and track outreach campaigns from here.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}

"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function PipelinePage() {
  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto mb-6 flex items-center justify-center gap-1.5">
            {[32, 44, 36, 48].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-primary"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Build opportunities from 0
          </h1>

          <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground leading-relaxed">
            Eliminate scattered scribbles and bring your impact discovery into
            one place. Enter one phrase, and we&apos;ll help with the heavy
            lifting.
          </p>

          <Button size="lg" className="mt-8 gap-2 text-base px-8">
            <Sparkles className="h-4.5 w-4.5" />
            Add new idea
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}

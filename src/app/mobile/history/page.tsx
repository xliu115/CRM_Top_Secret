"use client";

import Link from "next/link";
import { ArrowLeft, History, MessageSquare } from "lucide-react";
import { MobileShell } from "@/components/layout/mobile-shell";

export default function MobileChatHistoryPage() {
  return (
    <MobileShell>
      <div
        className="flex h-full flex-col"
        style={{ paddingTop: "var(--mobile-header-h)" }}
      >
        <div className="shrink-0 border-b border-border bg-card px-4 py-3">
          <Link
            href="/mobile"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-blue-600 active:text-blue-800 dark:text-blue-400 dark:active:text-blue-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to chat
          </Link>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <History className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">
              Chat history
            </h2>
            <p className="max-w-xs text-[15px] leading-relaxed text-muted-foreground">
              Past conversations will appear here so you can pick up where you
              left off.
            </p>
          </div>
          <Link
            href="/mobile"
            className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-blue-800"
          >
            <MessageSquare className="h-4 w-4" />
            Start a new chat
          </Link>
        </div>
      </div>
    </MobileShell>
  );
}

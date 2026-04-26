"use client";

import { Clock, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { StaleContactsListBlock } from "@/lib/types/chat-blocks";
import { cn } from "@/lib/utils/cn";

type SendMessageFn = (message: string) => void;

export function StaleContactsList({
  data,
  embedded = false,
  onSendMessage,
}: {
  data: StaleContactsListBlock["data"];
  embedded?: boolean;
  onSendMessage?: SendMessageFn;
}) {
  if (data.contacts.length === 0) return null;

  return (
    <div
      className={
        embedded
          ? "divide-y divide-border/50"
          : "rounded-xl border border-border bg-card overflow-hidden shadow-sm"
      }
    >
      {data.contacts.map((c, i) => {
        const showDays = c.daysSince > 0;
        const insight = c.insightPreview || c.signal;

        return (
          <button
            key={i}
            type="button"
            onClick={() =>
              onSendMessage?.(`Draft an email to ${c.name}`)
            }
            className={cn(
              "group flex w-full text-left transition-colors",
              "hover:bg-muted/30 active:bg-muted/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              i > 0 && "border-t border-border/50",
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5">
              <Avatar name={c.name} size="sm" className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {c.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.company}
                    </span>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                </div>

                {showDays && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                      <Clock className="h-2.5 w-2.5" />
                      No contact in {c.daysSince}d
                    </span>
                  </div>
                )}

                {insight && (
                  <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                    {insight}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

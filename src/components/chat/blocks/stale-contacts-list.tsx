"use client";

import Link from "next/link";
import { Clock, Zap } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { StaleContactsListBlock } from "@/lib/types/chat-blocks";

export function StaleContactsList({
  data,
  embedded = false,
}: {
  data: StaleContactsListBlock["data"];
  embedded?: boolean;
}) {
  if (data.contacts.length === 0) return null;

  return (
    <div className={embedded
      ? "divide-y divide-border/50"
      : "rounded-lg border border-border bg-card overflow-hidden divide-y divide-border"
    }>
      {data.contacts.map((c, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors first:pt-0">
          <Avatar name={c.name} size="sm" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/contacts/${c.contactId}`}
                className="text-sm font-medium text-foreground hover:text-primary hover:underline transition-colors truncate"
              >
                {c.name}
              </Link>
              <span className="text-xs text-muted-foreground shrink-0">{c.company}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                {c.daysSince} days
              </span>
              {c.signal && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
                  <Zap className="h-3 w-3 shrink-0" />
                  {c.signal}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

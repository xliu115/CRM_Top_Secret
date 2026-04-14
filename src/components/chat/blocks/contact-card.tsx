"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import type { ContactCardBlock } from "@/lib/types/chat-blocks";

function getPriorityVariant(priority: string): "default" | "destructive" | "warning" | "secondary" {
  switch (priority?.toUpperCase()) {
    case "URGENT": return "destructive";
    case "HIGH": return "warning";
    case "MEDIUM": return "default";
    default: return "secondary";
  }
}

export function ContactCard({
  data,
  embedded = false,
}: {
  data: ContactCardBlock["data"];
  embedded?: boolean;
}) {
  return (
    <div className={embedded
      ? "flex items-center gap-3"
      : "flex items-center gap-3 rounded-lg border border-border bg-card p-3"
    }>
      <Avatar name={data.name} size="md" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/contacts/${data.contactId}`}
            className="text-sm font-semibold text-foreground hover:text-primary hover:underline transition-colors"
          >
            {data.name}
          </Link>
          {data.priority && !embedded && (
            <Badge variant={getPriorityVariant(data.priority)} className="text-[10px]">
              {data.priority}
            </Badge>
          )}
        </div>
        {(data.title || data.company) && (
          <p className="text-xs text-muted-foreground truncate">
            {data.title}{data.title && data.company ? " at " : ""}{data.company}
          </p>
        )}
        {data.daysSince != null && (
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {data.daysSince} days since last conversation
          </p>
        )}
      </div>
    </div>
  );
}

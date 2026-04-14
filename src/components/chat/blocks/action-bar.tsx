"use client";

import {
  Mail, Reply, Forward, CalendarDays, Briefcase, Search,
  Share2, Copy, Send, User, ChevronRight, FileText,
} from "lucide-react";
import type { ActionBarBlock } from "@/lib/types/chat-blocks";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: Mail,
  reply: Reply,
  forward: Forward,
  calendar: CalendarDays,
  briefcase: Briefcase,
  search: Search,
  share: Share2,
  copy: Copy,
  send: Send,
  user: User,
  file: FileText,
};

function resolveIcon(name: string) {
  return ICON_MAP[name] ?? ChevronRight;
}

export function ActionBar({
  data,
  onSendMessage,
  embedded = false,
}: {
  data: ActionBarBlock["data"];
  onSendMessage?: (message: string) => void;
  embedded?: boolean;
}) {
  const PrimaryIcon = resolveIcon(data.primary.icon);
  const actionableSecondary = data.secondary.filter((a) => a.query);
  const showPrimary = data.primary.query && onSendMessage;

  return (
    <div className={embedded ? "space-y-2" : "space-y-2"}>
      {embedded && (
        <p className="text-[11px] font-medium text-muted-foreground">
          Suggested next steps
        </p>
      )}

      {showPrimary && (
        <button
          onClick={() => onSendMessage(data.primary.query)}
          className={embedded
            ? "w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            : "inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          }
        >
          <PrimaryIcon className="h-4 w-4" />
          {data.primary.label}
        </button>
      )}

      {actionableSecondary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actionableSecondary.map((action, i) => {
            const Icon = resolveIcon(action.icon);
            return (
              <button
                key={i}
                onClick={() => onSendMessage?.(action.query)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/50 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted"
              >
                <Icon className="h-3 w-3" />
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

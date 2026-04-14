"use client";

import { CalendarDays, Users, ChevronRight } from "lucide-react";
import type { MeetingCardBlock } from "@/lib/types/chat-blocks";

export function MeetingCard({
  data,
  onSendMessage,
  embedded = false,
}: {
  data: MeetingCardBlock["data"];
  onSendMessage?: (message: string) => void;
  embedded?: boolean;
}) {
  return (
    <div className={embedded
      ? "flex items-start gap-3 py-3 first:pt-0"
      : "rounded-lg border border-border bg-card overflow-hidden"
    }>
      {!embedded && (
        <div className="flex items-start gap-3 p-4">
          <MeetingContent data={data} onSendMessage={onSendMessage} showPrepLink={!embedded} />
        </div>
      )}
      {embedded && <MeetingContent data={data} onSendMessage={onSendMessage} showPrepLink={false} />}

      {!embedded && onSendMessage && (
        <div className="border-t border-border px-4 py-2">
          <button
            onClick={() => onSendMessage(`Prepare me for the ${data.title} meeting`)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Prep for this meeting
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function MeetingContent({
  data,
  onSendMessage,
  showPrepLink,
}: {
  data: MeetingCardBlock["data"];
  onSendMessage?: (message: string) => void;
  showPrepLink: boolean;
}) {
  return (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
        <CalendarDays className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{data.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{data.startTime}</p>

        {data.purpose && (
          <p className="text-xs text-foreground/70 mt-1">{data.purpose}</p>
        )}

        {data.attendees.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Users className="h-3 w-3 text-muted-foreground shrink-0" />
            {data.attendees.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/70"
              >
                {a.name}
              </span>
            ))}
          </div>
        )}

        {showPrepLink && onSendMessage && (
          <button
            onClick={() => onSendMessage(`Prepare me for the ${data.title} meeting`)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-2"
          >
            Prep for this meeting
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </>
  );
}

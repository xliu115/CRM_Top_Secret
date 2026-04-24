"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { ActionBar } from "./action-bar";
import { buildMeetingBriefActionBar } from "@/lib/services/mobile-action-bars";
import type { SendMessageFn } from "@/hooks/use-chat-session";
import type { MeetingBriefBlock } from "@/lib/types/chat-blocks";

const TEMPERATURE_STYLES: Record<string, string> = {
  HOT: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900",
  WARM: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900",
  COOL: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900",
  COLD: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800",
};

export function MeetingBrief({
  data,
  embedded = false,
  onSendMessage,
}: {
  data: MeetingBriefBlock["data"];
  embedded?: boolean;
  onSendMessage?: SendMessageFn;
}) {
  const [expanded, setExpanded] = useState(false);
  const tempClass = data.temperature ? TEMPERATURE_STYLES[data.temperature] : "";

  return (
    <div
      className={
        embedded
          ? "py-1"
          : "rounded-lg border border-border bg-card overflow-hidden"
      }
    >
      <div className={embedded ? "" : "p-4"}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
            <CalendarDays className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{data.meetingTitle}</p>
              {data.temperature && (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tempClass}`}
                >
                  {data.temperature}
                </span>
              )}
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground whitespace-pre-line">
              {data.synthesis}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <ActionBar
            data={buildMeetingBriefActionBar({
              expanded,
              firstAttendeeName: data.firstAttendeeName,
            })}
            onSendMessage={(query) => {
              if (query === "__toggle_brief__") {
                setExpanded((v) => !v);
                return;
              }
              onSendMessage?.(query);
            }}
          />
        </div>

        {expanded && (
          <div className="mt-4 border-t border-border pt-4">
            <MarkdownContent
              content={data.fullBrief}
              className="text-[15px] leading-relaxed text-foreground"
            />
          </div>
        )}
      </div>
    </div>
  );
}

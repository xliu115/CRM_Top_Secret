"use client";

import { useRef, useState } from "react";
import { CalendarDays, Sparkles } from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { ActionBar } from "./action-bar";
import { buildMeetingBriefActionBar } from "@/lib/services/mobile-action-bars";
import { SENTINEL_TOGGLE_BRIEF } from "@/lib/services/chat-sentinels";
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
  const expandedAnchorRef = useRef<HTMLDivElement>(null);
  const bottomActionBarRef = useRef<HTMLDivElement>(null);

  const actionBarData = buildMeetingBriefActionBar({
    expanded,
    firstAttendeeName: data.firstAttendeeName,
  });

  const handleActionQuery = (query: string) => {
    if (query === SENTINEL_TOGGLE_BRIEF) {
      const next = !expanded;
      setExpanded(next);
      // After expanding, anchor the start of the brief to the top of the
      // viewport so users read top→bottom and meet the bottom action bar at
      // the natural endpoint. After collapsing, re-anchor the (now-top) action
      // bar so the user doesn't lose their place above the briefing card.
      requestAnimationFrame(() => {
        if (next) {
          expandedAnchorRef.current?.scrollIntoView({
            block: "start",
            behavior: "smooth",
          });
        } else {
          bottomActionBarRef.current?.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
          });
        }
      });
      return;
    }
    onSendMessage?.(query);
  };

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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
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
          </div>
        </div>

        {/* Top-of-mind / synthesis sits as a full-width sibling so it spans
            the card edge-to-edge instead of being inset by the icon plate. */}
        {data.topOfMind ? (
          <div className="mt-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Top-of-Mind · {data.topOfMind.subjectName}
              </p>
            </div>
            <p className="text-[15px] leading-relaxed text-foreground/90">
              {data.topOfMind.content}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[15px] leading-relaxed text-foreground whitespace-pre-line">
            {data.synthesis}
          </p>
        )}

        <div ref={bottomActionBarRef} className="mt-3">
          <ActionBar data={actionBarData} onSendMessage={handleActionQuery} />
        </div>

        {expanded && (
          <>
            <div
              ref={expandedAnchorRef}
              className="mt-4 border-t border-border pt-4 scroll-mt-4"
            >
              <MarkdownContent
                content={data.fullBrief}
                className="text-[15px] leading-relaxed text-foreground"
              />
            </div>
            {/* Mirror action bar at the end of the expanded brief so users can
                act on what they just read without scrolling back up. */}
            <div className="mt-4">
              <ActionBar data={actionBarData} onSendMessage={handleActionQuery} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Check, X, CalendarClock, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { CalendarActionBlock } from "@/lib/types/chat-blocks";

type Response = "accepted" | "declined" | "proposed_new_time";

type Props = {
  data: CalendarActionBlock["data"];
  embedded?: boolean;
  onSendMessage?: (message: string) => void;
};

export function CalendarAction({ data, embedded = false, onSendMessage }: Props) {
  const [status, setStatus] = useState<Response | "pending">(data.currentStatus ?? "pending");
  const [loading, setLoading] = useState<Response | null>(null);

  async function respond(action: Response) {
    setLoading(action);
    try {
      const res = await fetch(`/api/meetings/${data.meetingId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: action }),
      });
      if (res.ok) {
        setStatus(action);
        if (action === "proposed_new_time") {
          onSendMessage?.(`Propose a new time for "${data.title}".`);
        }
      }
    } catch {
      // Fail silently; user can retry
    } finally {
      setLoading(null);
    }
  }

  const when = (() => {
    try {
      const d = new Date(data.startIso);
      return format(d, "EEE MMM d 'at' h:mm a");
    } catch {
      return data.startIso;
    }
  })();

  const outerClass = embedded
    ? ""
    : "rounded-lg border border-border bg-card p-4";

  const statusBanner = status !== "pending" && (
    <div
      className={`mb-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
        status === "accepted"
          ? "bg-green-500/10 text-green-700 dark:text-green-400"
          : status === "declined"
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-foreground"
      }`}
    >
      {status === "accepted" && <Check className="h-3.5 w-3.5" />}
      {status === "declined" && <X className="h-3.5 w-3.5" />}
      {status === "proposed_new_time" && <CalendarClock className="h-3.5 w-3.5" />}
      <span>
        {status === "accepted" && "Accepted"}
        {status === "declined" && "Declined"}
        {status === "proposed_new_time" && "Proposed a new time"}
      </span>
    </div>
  );

  return (
    <div className={outerClass}>
      {statusBanner}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{data.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {when}
            {data.durationMinutes ? ` · ${data.durationMinutes} min` : ""}
            {data.organizerName ? ` · from ${data.organizerName}` : ""}
          </p>
        </div>
      </div>

      {status === "pending" && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => respond("declined")}
            disabled={loading != null}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background/60 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted disabled:opacity-50"
          >
            {loading === "declined" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Decline
          </button>
          <button
            type="button"
            onClick={() => respond("proposed_new_time")}
            disabled={loading != null}
            className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted disabled:opacity-50"
          >
            {loading === "proposed_new_time" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            New time
          </button>
          <button
            type="button"
            onClick={() => respond("accepted")}
            disabled={loading != null}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading === "accepted" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Accept
          </button>
        </div>
      )}
    </div>
  );
}

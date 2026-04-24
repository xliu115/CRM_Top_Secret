"use client";

import { useState } from "react";
import { CalendarDays, Clock, Users, Check, Send } from "lucide-react";
import { format } from "date-fns";
import type { MeetingSchedulerBlock } from "@/lib/types/chat-blocks";

type Props = {
  data: MeetingSchedulerBlock["data"];
  embedded?: boolean;
  onSendMessage?: (message: string) => void;
};

export function MeetingScheduler({ data, embedded = false, onSendMessage }: Props) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const selected = data.slots.find((s) => s.slotId === selectedSlotId);

  function handleConfirm() {
    if (!selected || !onSendMessage) return;
    setConfirmed(true);
    const attendeesText = data.attendees.map((a) => a.name).join(", ");
    const when = (() => {
      try {
        const d = new Date(selected.startIso);
        return format(d, "EEE MMM d 'at' h:mm a");
      } catch {
        return selected.label;
      }
    })();
    onSendMessage(
      `Send calendar invite "${data.title}" to ${attendeesText} for ${when}.`,
    );
  }

  const outerClass = embedded
    ? ""
    : "rounded-lg border border-border bg-card p-4";

  return (
    <div className={outerClass}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-primary/80">
              Schedule meeting
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">{data.title}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {data.durationMinutes} min · with{" "}
            {data.attendees.map((a) => a.name).join(", ")}
          </p>
        </div>
        <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-3 space-y-1.5">
        {data.slots.map((slot) => {
          const active = slot.slotId === selectedSlotId;
          return (
            <button
              key={slot.slotId}
              type="button"
              onClick={() => setSelectedSlotId(slot.slotId)}
              disabled={confirmed}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/60 hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className={`h-3.5 w-3.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm ${active ? "font-semibold text-foreground" : "text-foreground/90"}`}>
                  {slot.label}
                </span>
              </div>
              {active && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selected || confirmed}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {confirmed ? (
            <>
              <Check className="h-4 w-4" />
              Sent
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {selected ? "Send invite" : "Pick a time"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

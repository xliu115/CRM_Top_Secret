"use client";

import { CheckCircle, XCircle, Send, BellOff, Trash2 } from "lucide-react";
import type { ConfirmationCardBlock } from "@/lib/types/chat-blocks";
import type { PendingAction } from "@/hooks/use-chat-session";

const ACTION_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  dismiss_nudge: Trash2,
  snooze_nudge: BellOff,
  send_email: Send,
};

export function ConfirmationCard({
  data,
  onConfirm,
  onCancel,
}: {
  data: ConfirmationCardBlock["data"];
  onConfirm?: (action: PendingAction) => void;
  onCancel?: () => void;
}) {
  const Icon = ACTION_ICON[data.action.type] ?? CheckCircle;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{data.title}</p>
            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">{data.description}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border/60 bg-muted/20">
        <button
          onClick={() => onConfirm?.(data.action)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {data.confirmLabel}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted"
        >
          <XCircle className="h-3.5 w-3.5" />
          {data.cancelLabel}
        </button>
      </div>
    </div>
  );
}

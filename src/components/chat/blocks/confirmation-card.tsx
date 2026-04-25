"use client";

import { CheckCircle, XCircle, Send, BellOff, Trash2 } from "lucide-react";
import type { ConfirmationCardBlock } from "@/lib/types/chat-blocks";
import type { PendingAction } from "@/hooks/use-chat-session";
import { stripMarkdownToPlainText } from "@/lib/utils/strip-markdown";

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
  const descriptionPlain = stripMarkdownToPlainText(data.description);
  const isDestructive = data.action.type === "dismiss_nudge";

  const primaryClass = isDestructive
    ? "relative inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 text-white px-4 text-sm font-semibold min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-red-800"
    : "relative inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white px-4 text-sm font-semibold min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-blue-800";

  const secondaryClass =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600/60 bg-transparent px-4 text-sm font-medium text-blue-600 min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-blue-50 dark:active:bg-blue-950";

  function handleConfirm() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(isDestructive ? [20, 40, 20] : 10);
    }
    onConfirm?.(data.action);
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{stripMarkdownToPlainText(data.title)}</p>
            <p
              className="mt-1 text-xs text-muted-foreground whitespace-pre-line line-clamp-2"
              title={descriptionPlain}
            >
              {descriptionPlain}
            </p>
          </div>
        </div>
      </div>
      <div
        data-cta-row
        className="flex items-stretch gap-2 px-4 py-3 border-t border-border/60 bg-muted/20"
      >
        <button type="button" onClick={handleConfirm} className={primaryClass}>
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span>{data.confirmLabel}</span>
        </button>
        <button type="button" onClick={onCancel} className={secondaryClass}>
          <XCircle className="h-4 w-4" aria-hidden="true" />
          <span>{data.cancelLabel}</span>
        </button>
      </div>
    </div>
  );
}

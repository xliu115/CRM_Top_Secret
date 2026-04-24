"use client";

import { useState, createElement } from "react";
import {
  Mail, Reply, Forward, CalendarDays, Briefcase, Search,
  Share2, Copy, Send, User, ChevronRight, FileText, Check,
  Sparkles, Scissors, Trash2, BellOff, ChevronDown, ChevronUp,
} from "lucide-react";
import type { ActionBarBlock, EmailPreviewBlock } from "@/lib/types/chat-blocks";
import type { SendMessageFn } from "@/hooks/use-chat-session";
import {
  SENTINEL_COPY_EMAIL,
  SENTINEL_EDIT_EMAIL,
} from "@/lib/services/chat-sentinels";

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
  sparkles: Sparkles,
  scissors: Scissors,
  trash: Trash2,
  "bell-off": BellOff,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
};

function resolveIcon(name: string) {
  return ICON_MAP[name] ?? ChevronRight;
}

function vibratePrimary() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

export function ActionBar({
  data,
  emailData,
  onSendMessage,
  onEditEmail,
  pulsePrimary = false,
}: {
  data: ActionBarBlock["data"];
  emailData?: EmailPreviewBlock["data"];
  onSendMessage?: SendMessageFn;
  onEditEmail?: () => void;
  pulsePrimary?: boolean;
  /** @deprecated retained for backward compat with existing callers; ignored. Removed in Task 6 when callers are updated. */
  embedded?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const showPrimary = Boolean(data.primary.query) && Boolean(onSendMessage);

  const secondaryItem = data.secondary[0];
  const showSecondary = Boolean(secondaryItem?.query);

  const tertiary = data.tertiary ?? data.secondary.slice(1);
  const isDestructive = data.variant === "destructive_primary";

  function handleCopyEmail() {
    if (!emailData) return;
    navigator.clipboard.writeText(`Subject: ${emailData.subject}\n\n${emailData.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function dispatch(query: string) {
    if (query === SENTINEL_COPY_EMAIL) {
      handleCopyEmail();
      return;
    }
    if (query === SENTINEL_EDIT_EMAIL) {
      onEditEmail?.();
      return;
    }
    if (!onSendMessage) return;
    // Only the primary action enriches with the latest edited subject/body.
    // Tertiary/secondary actions like "Send a follow-up …" should never
    // hijack the draft context — that path stays scoped to primary intent.
    const isPrimarySend =
      query === data.primary.query && /^send\b/i.test(data.primary.label);
    if (isPrimarySend && emailData) {
      onSendMessage(query, { currentSubject: emailData.subject, currentBody: emailData.body });
    } else {
      onSendMessage(query);
    }
  }

  function handlePrimary() {
    vibratePrimary();
    dispatch(data.primary.query);
  }

  const primaryClass = isDestructive
    ? "relative inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 text-white px-4 text-sm font-semibold min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-red-800"
    : "relative inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white px-4 text-sm font-semibold min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-blue-800";

  const secondaryClass =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600/60 bg-transparent px-4 text-sm font-medium text-blue-600 min-h-[44px] flex-1 motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-blue-50 dark:active:bg-blue-950";

  const tertiaryClass =
    "inline-flex items-center gap-1.5 rounded-md bg-transparent px-2 py-1.5 text-xs font-medium text-muted-foreground min-h-[32px] motion-safe:transition-colors motion-safe:active:scale-[0.97] active:bg-muted/60";

  return (
    <div data-cta-row className="space-y-2">
      <div className="flex items-stretch gap-2">
        {showPrimary && (
          <button
            type="button"
            data-cta-primary
            onClick={handlePrimary}
            className={primaryClass}
            aria-label={data.primary.label}
          >
            {createElement(resolveIcon(data.primary.icon), { className: "h-4 w-4" })}
            <span>{data.primary.label}</span>
            {pulsePrimary && (
              <span
                aria-hidden="true"
                className={`motion-safe:animate-ping pointer-events-none absolute inset-0 rounded-lg ring-2 opacity-60 ${
                  isDestructive ? "ring-red-400" : "ring-blue-400"
                }`}
              />
            )}
          </button>
        )}
        {showSecondary && (
          <button
            type="button"
            onClick={() => dispatch(secondaryItem!.query)}
            className={secondaryClass}
            aria-label={secondaryItem!.label}
          >
            {createElement(resolveIcon(secondaryItem!.icon), { className: "h-4 w-4" })}
            <span>{secondaryItem!.label}</span>
          </button>
        )}
      </div>

      {tertiary.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
          {tertiary.map((action, i) => {
            const isCopy = action.query === SENTINEL_COPY_EMAIL;
            const isDismiss = action.label.toLowerCase() === "dismiss";
            const cls = isDismiss
              ? `${tertiaryClass} text-red-600/70`
              : tertiaryClass;
            return (
              <button
                key={i}
                type="button"
                onClick={() => dispatch(action.query)}
                className={cls}
                aria-label={action.label}
              >
                {isCopy && copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  createElement(resolveIcon(action.icon), { className: "h-3.5 w-3.5" })
                )}
                <span>{isCopy && copied ? "Copied!" : action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

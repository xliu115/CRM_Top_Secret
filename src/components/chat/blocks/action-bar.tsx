"use client";

import { useState } from "react";
import {
  Mail, Reply, Forward, CalendarDays, Briefcase, Search,
  Share2, Copy, Send, User, ChevronRight, FileText, Check,
} from "lucide-react";
import type { ActionBarBlock, EmailPreviewBlock } from "@/lib/types/chat-blocks";

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
  emailData,
  onSendMessage,
  embedded = false,
}: {
  data: ActionBarBlock["data"];
  emailData?: EmailPreviewBlock["data"];
  onSendMessage?: (message: string) => void;
  embedded?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const PrimaryIcon = resolveIcon(data.primary.icon);
  const actionableSecondary = data.secondary.filter((a) => a.query);
  const showPrimary = data.primary.query && onSendMessage;

  function handleCopyEmail() {
    if (!emailData) return;
    const text = `Subject: ${emailData.subject}\n\n${emailData.body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center min-h-[44px]">
      <div className="flex flex-wrap items-center gap-2">
        {showPrimary && (
          <button
            onClick={() => onSendMessage(data.primary.query)}
            className={embedded
              ? "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              : "inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            }
          >
            <PrimaryIcon className="h-3.5 w-3.5" />
            {data.primary.label}
          </button>
        )}

        {actionableSecondary.map((action, i) => {
          if (action.query === "__copy_email__" && emailData) {
            return (
              <button
                key={i}
                onClick={handleCopyEmail}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : action.label}
              </button>
            );
          }
          const Icon = resolveIcon(action.icon);
          return (
            <button
              key={i}
              onClick={() => onSendMessage?.(action.query)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted"
            >
              <Icon className="h-3.5 w-3.5" />
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

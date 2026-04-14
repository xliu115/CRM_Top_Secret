"use client";

import { useState } from "react";
import { Mail, Copy, Check } from "lucide-react";
import type { EmailPreviewBlock } from "@/lib/types/chat-blocks";

export function EmailPreview({
  data,
  embedded = false,
}: {
  data: EmailPreviewBlock["data"];
  embedded?: boolean;
}) {
  const [copied, setCopied] = useState<"subject" | "body" | "all" | null>(null);

  function handleCopy(target: "subject" | "body" | "all") {
    const text =
      target === "subject" ? data.subject
        : target === "body" ? data.body
        : `Subject: ${data.subject}\n\n${data.body}`;
    navigator.clipboard.writeText(text);
    setCopied(target);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className={embedded
      ? "overflow-hidden"
      : "rounded-lg border border-border bg-card overflow-hidden"
    }>
      <div className={`flex items-center gap-2 px-4 py-2.5 ${embedded ? "bg-muted/20 rounded-md" : "border-b border-border bg-muted/30"}`}>
        <Mail className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
          Email Draft
        </span>
        <div className="ml-auto">
          <button
            onClick={() => handleCopy("all")}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {copied === "all" ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            {copied === "all" ? "Copied" : "Copy All"}
          </button>
        </div>
      </div>

      <div className={`py-3 space-y-3 ${embedded ? "" : "px-4"}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground shrink-0 w-12">To:</span>
          <span className="text-sm text-foreground">{data.to}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground shrink-0 w-12">Subject:</span>
          <span className="text-sm font-medium text-foreground">{data.subject}</span>
        </div>

        <div className="border-t border-border pt-3">
          <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {data.body}
          </div>
        </div>
      </div>
    </div>
  );
}

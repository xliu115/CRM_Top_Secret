"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { EmailPreviewBlock } from "@/lib/types/chat-blocks";

const COLLAPSED_HEIGHT = 160;

export function EmailPreview({
  data,
  embedded = false,
}: {
  data: EmailPreviewBlock["data"];
  embedded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={embedded
      ? "overflow-hidden"
      : "rounded-lg border border-border bg-card overflow-hidden"
    }>
      {!embedded && (
        <div className="px-4 pt-3 pb-2">
          <span className="text-sm font-semibold text-foreground">Email Draft</span>
        </div>
      )}
      {embedded && (
        <div className="pb-1">
          <span className="text-sm font-semibold text-foreground">Email Draft</span>
        </div>
      )}

      <div className={`space-y-2.5 ${embedded ? "" : "px-4 pb-3"}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground shrink-0 w-12">To:</span>
          <span className="text-sm text-foreground">{data.to}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground shrink-0 w-12">Subject:</span>
          <span className="text-sm font-medium text-foreground">{data.subject}</span>
        </div>

        <div className="border-t border-border/40 pt-2.5">
          <div className="relative">
            <div
              className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap overflow-hidden transition-all duration-200"
              style={{ maxHeight: expanded ? "none" : `${COLLAPSED_HEIGHT}px` }}
            >
              {data.body}
            </div>
            {!expanded && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
            )}
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <>Show less <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>Read full email <ChevronDown className="h-3 w-3" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

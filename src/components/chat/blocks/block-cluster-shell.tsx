"use client";

import type { ReactNode } from "react";

function getPriorityBorderClass(priority?: string): string {
  switch (priority?.toUpperCase()) {
    case "URGENT": return "border-t border-t-destructive/40";
    case "HIGH": return "border-t border-t-orange-400/40";
    default: return "";
  }
}

export function BlockClusterShell({
  priority,
  header,
  eyebrow,
  body,
  footer,
}: {
  priority?: string;
  header?: ReactNode;
  eyebrow?: string;
  body?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden ${getPriorityBorderClass(priority)}`}>
      {(header || eyebrow) && (
        <div className="px-4 pt-4 pb-2">
          {eyebrow && (
            <p className="text-[11px] font-medium text-muted-foreground mb-2">
              {eyebrow}
            </p>
          )}
          {header}
        </div>
      )}

      {body && (
        <div className="px-4 pb-4">
          {body}
        </div>
      )}

      {footer && (
        <div className="px-4 py-3 border-t border-border/60 bg-muted/20">
          {footer}
        </div>
      )}
    </div>
  );
}

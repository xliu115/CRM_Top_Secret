"use client";

import { useState } from "react";
import { ExternalLink, ChevronDown } from "lucide-react";
import { INSIGHT_TYPE_LABELS } from "@/lib/utils/nudge-summary";
import type { NudgeEvidenceBlock } from "@/lib/types/chat-blocks";

type Insight = NudgeEvidenceBlock["data"]["insights"][0];

const TYPE_ORDER: Record<string, number> = {
  MEETING_PREP: 0, REPLY_NEEDED: 1, JOB_CHANGE: 2, STALE_CONTACT: 3,
  FOLLOW_UP: 4, CAMPAIGN_APPROVAL: 5, ARTICLE_CAMPAIGN: 6,
  LINKEDIN_ACTIVITY: 7, EVENT_ATTENDED: 8, EVENT_REGISTERED: 9,
  ARTICLE_READ: 10, UPCOMING_EVENT: 11, COMPANY_NEWS: 12,
};

function groupByType(insights: Insight[]): { type: string; label: string; items: Insight[] }[] {
  const map = new Map<string, Insight[]>();
  for (const insight of insights) {
    const existing = map.get(insight.type);
    if (existing) existing.push(insight);
    else map.set(insight.type, [insight]);
  }
  return Array.from(map.entries())
    .map(([type, items]) => ({
      type,
      label: INSIGHT_TYPE_LABELS[type] ?? type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      items,
    }))
    .sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99));
}

function isGenericReason(reason: string, type: string): boolean {
  const lower = reason.toLowerCase();
  const typeWords = type.replace(/_/g, " ").toLowerCase();
  if (lower.includes("signal detected")) return true;
  if (lower.startsWith(`${typeWords} signal`)) return true;
  if (/^\d+ reasons? to reach out/.test(lower)) return true;
  return false;
}

export function NudgeEvidence({
  data,
  embedded = false,
}: {
  data: NudgeEvidenceBlock["data"];
  embedded?: boolean;
}) {
  if (data.insights.length === 0) return null;

  const groups = groupByType(data.insights);

  return (
    <div className={embedded ? "space-y-0 divide-y divide-border/50" : "space-y-2"}>
      {groups.map((group) => (
        <EvidenceTypeGroup key={group.type} group={group} embedded={embedded} />
      ))}
    </div>
  );
}

function EvidenceTypeGroup({
  group,
  embedded,
}: {
  group: { type: string; label: string; items: Insight[] };
  embedded: boolean;
}) {
  const count = group.items.length;
  const hasMultiple = count > 1;

  return (
    <div className={embedded ? "py-3 first:pt-0" : "rounded-lg border border-border bg-card overflow-hidden"}>
      {/* Group header */}
      <div className={embedded
        ? "flex items-baseline gap-2 mb-1.5"
        : "flex items-baseline gap-2 border-b border-border/50 bg-muted/30 px-3 py-2"
      }>
        <p className="text-sm font-semibold text-foreground">{group.label}</p>
        {hasMultiple && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </div>

      {/* Insight items */}
      <div className={embedded
        ? hasMultiple ? "pl-3 border-l-2 border-border/60 space-y-2" : ""
        : hasMultiple ? "px-3 pb-2 space-y-2" : "px-3 pb-2"
      }>
        {group.items.map((insight, i) => (
          <InsightDetail key={`${group.type}-${i}`} insight={insight} groupType={group.type} />
        ))}
      </div>
    </div>
  );
}

function InsightDetail({
  insight,
  groupType,
}: {
  insight: Insight;
  groupType: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSignal = !!insight.signalContent;
  const reasonIsGeneric = isGenericReason(insight.reason, groupType);
  const showReason = !reasonIsGeneric && insight.reason;
  const primaryText = hasSignal ? insight.signalContent! : insight.reason;
  const isLong = primaryText.length > 180;

  return (
    <div className="py-1.5 first:pt-1 space-y-1">
      {/* Primary content: signal content if available, otherwise reason */}
      <div className="relative">
        <p className={`text-sm text-foreground/80 leading-relaxed ${!expanded && isLong ? "line-clamp-3" : ""}`}>
          {primaryText}
        </p>
        {isLong && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            Show more
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Show reason as secondary context only if it adds info beyond the signal */}
      {hasSignal && showReason && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {insight.reason}
        </p>
      )}

      {insight.signalUrl && (
        <a
          href={insight.signalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View source
        </a>
      )}
    </div>
  );
}

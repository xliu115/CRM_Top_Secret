"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { INSIGHT_TYPE_LABELS } from "@/lib/utils/nudge-summary";
import type { InsightData, NudgeForSummary } from "@/lib/utils/nudge-summary";
import type { StrategicInsight } from "@/lib/services/llm-insight";

const TYPE_ORDER: Record<string, number> = {
  MEETING_PREP: 0, REPLY_NEEDED: 1, JOB_CHANGE: 2, STALE_CONTACT: 3,
  FOLLOW_UP: 4, CAMPAIGN_APPROVAL: 5, ARTICLE_CAMPAIGN: 6,
  LINKEDIN_ACTIVITY: 7, EVENT_ATTENDED: 8, EVENT_REGISTERED: 9,
  ARTICLE_READ: 10, UPCOMING_EVENT: 11, COMPANY_NEWS: 12,
};

function renderNarrativeWithBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground/90">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function groupInsightsByType(insights: InsightData[]) {
  const map = new Map<string, InsightData[]>();
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

export function StrategicInsightBlock({
  strategicInsight,
  insights,
  nudge,
}: {
  strategicInsight?: StrategicInsight | null;
  insights: InsightData[];
  nudge: NudgeForSummary;
}) {
  const [showEvidence, setShowEvidence] = useState(false);

  if (!strategicInsight) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Generating insight…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-foreground/80 leading-relaxed">
        <p>{renderNarrativeWithBold(strategicInsight.narrative)}</p>
      </div>

      {insights.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {showEvidence ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {showEvidence ? "Hide" : "Show"} Evidence ({insights.length} signal{insights.length !== 1 ? "s" : ""})
          </button>

          {showEvidence && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              {groupInsightsByType(insights).map((group) => (
                <div key={group.type}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <p className="text-xs font-semibold text-foreground">{group.label}</p>
                    {group.items.length > 1 && (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-semibold tabular-nums text-primary">
                        {group.items.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {group.items.map((ins, i) => (
                      <div key={`${group.type}-${i}`} className="text-xs text-foreground/70 leading-relaxed">
                        <p>
                          {ins.signalContent
                            ? ins.signalContent.length > 200
                              ? ins.signalContent.slice(0, 200) + "\u2026"
                              : ins.signalContent
                            : ins.reason}
                        </p>
                        {ins.signalUrl && (
                          <a
                            href={ins.signalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-0.5 text-xs font-medium text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View source
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

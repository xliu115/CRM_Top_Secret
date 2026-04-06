"use client";

import type { StructuredBrief } from "@/lib/types/structured-brief";
import { PrepDetailSection } from "./prep-detail-section";
import { Newspaper } from "lucide-react";

interface NewsInsightsCardProps {
  insights: StructuredBrief["newsInsights"];
  emptyReason?: string;
}

export function NewsInsightsCard({
  insights,
  emptyReason,
}: NewsInsightsCardProps) {
  if (insights.length === 0 && !emptyReason) return null;

  return (
    <PrepDetailSection
      title="Client News Insights"
      icon={<Newspaper className="h-3.5 w-3.5 text-indigo-600" />}
    >
      {insights.length > 0 ? (
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-muted/20 p-4"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                {insight.headline}
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed">
                {insight.body}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">{emptyReason}</p>
      )}
    </PrepDetailSection>
  );
}

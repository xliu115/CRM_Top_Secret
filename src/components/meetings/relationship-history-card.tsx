"use client";

import type { StructuredBrief } from "@/lib/types/structured-brief";
import { PrepDetailSection } from "./prep-detail-section";
import { cn } from "@/lib/utils/cn";
import { Handshake } from "lucide-react";

interface RelationshipHistoryCardProps {
  history: StructuredBrief["relationshipHistory"];
}

const temperatureConfig = {
  COLD: {
    label: "Cold",
    barClass: "bg-blue-400",
    width: "w-1/4",
    textClass: "text-blue-600 dark:text-blue-400",
  },
  COOL: {
    label: "Cool",
    barClass: "bg-sky-400",
    width: "w-2/4",
    textClass: "text-sky-600 dark:text-sky-400",
  },
  WARM: {
    label: "Warm",
    barClass: "bg-orange-400",
    width: "w-3/4",
    textClass: "text-orange-600 dark:text-orange-400",
  },
  HOT: {
    label: "Hot",
    barClass: "bg-red-500",
    width: "w-full",
    textClass: "text-red-600 dark:text-red-400",
  },
};

export function RelationshipHistoryCard({
  history,
}: RelationshipHistoryCardProps) {
  const config = temperatureConfig[history.temperature];

  return (
    <PrepDetailSection
      title="Relationship History"
      icon={<Handshake className="h-3.5 w-3.5 text-indigo-600" />}
    >
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Temperature
            </span>
            <span className={cn("text-xs font-bold uppercase", config.textClass)}>
              {config.label}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={cn("h-2 rounded-full transition-all", config.barClass, config.width)}
            />
          </div>
        </div>

        <p className="text-sm text-foreground/80 leading-relaxed">
          {history.summary}
        </p>

        {history.engagements.length > 0 && (
          <div className="space-y-2 border-l-2 border-border pl-4">
            {history.engagements.map((eng, i) => (
              <div key={i}>
                <span className="text-xs font-medium text-muted-foreground">
                  {eng.period}
                </span>
                <p className="text-sm text-foreground/80">{eng.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PrepDetailSection>
  );
}

"use client";

import type { StructuredBrief } from "@/lib/types/structured-brief";
import { PrepDetailSection } from "./prep-detail-section";
import { UserCircle, Sparkles } from "lucide-react";

interface ExecutiveProfileCardProps {
  profile: StructuredBrief["executiveProfile"];
}

export function ExecutiveProfileCard({ profile }: ExecutiveProfileCardProps) {
  return (
    <PrepDetailSection
      title="Executive Profile"
      icon={<UserCircle className="h-3.5 w-3.5 text-indigo-600" />}
    >
      <div className="space-y-4">
        <p className="text-sm text-foreground/80 leading-relaxed">
          {profile.bioSummary}
        </p>

        {profile.topOfMind && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/20 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Top-of-Mind
              </p>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {profile.topOfMind}
            </p>
          </div>
        )}

        {profile.recentMoves.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Recent Moves
            </p>
            <div className="space-y-2 border-l-2 border-indigo-200 dark:border-indigo-800 pl-4">
              {profile.recentMoves.map((move, i) => (
                <div key={i}>
                  <span className="text-xs font-medium text-muted-foreground">
                    {move.date}
                  </span>
                  <p className="text-sm text-foreground/80">{move.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.patternCallout && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-950/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-400 mb-1">
              Pattern
            </p>
            <p className="text-sm text-yellow-800 dark:text-yellow-300 leading-relaxed">
              {profile.patternCallout}
            </p>
          </div>
        )}
      </div>
    </PrepDetailSection>
  );
}

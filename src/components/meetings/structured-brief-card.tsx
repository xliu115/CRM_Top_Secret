"use client";

import type { StructuredBrief } from "@/lib/types/structured-brief";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Target, User, MessageCircle } from "lucide-react";

interface StructuredBriefCardProps {
  brief: StructuredBrief;
}

export function StructuredBriefCard({ brief }: StructuredBriefCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Meeting Prep Card</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Meeting Goal */}
        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-4 border border-indigo-100 dark:border-indigo-900/50">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Meeting Goal
            </span>
          </div>
          <p className="text-sm font-medium text-foreground leading-relaxed">
            {brief.meetingGoal.statement}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Success = {brief.meetingGoal.successCriteria}
          </p>
        </div>

        {/* Primary Contact in 3 Bullets */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              {brief.primaryContactProfile.name} in{" "}
              {brief.primaryContactProfile.bullets.length} Bullets
            </span>
          </div>
          {brief.primaryContactProfile.bullets.length > 0 ? (
            <ul className="space-y-2.5">
              {brief.primaryContactProfile.bullets.map((bullet, i) => (
                <li key={i} className="text-sm text-foreground/80 leading-relaxed">
                  <span className="font-semibold text-foreground">
                    {bullet.label}.
                  </span>{" "}
                  {bullet.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {brief.primaryContactProfile.emptyReason ??
                "Limited information available."}
            </p>
          )}
        </div>

        {/* Conversation Starters */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Conversation Starters
            </span>
          </div>
          <div className="space-y-3">
            {brief.conversationStarters.map((starter, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-muted/20 px-4 py-3"
              >
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  &ldquo;{starter.question}&rdquo;
                </p>
                <p className="text-xs text-muted-foreground italic mt-1">
                  → {starter.tacticalNote}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

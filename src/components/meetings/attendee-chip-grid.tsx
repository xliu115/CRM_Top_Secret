"use client";

import type { StructuredBrief } from "@/lib/types/structured-brief";
import { PrepDetailSection } from "./prep-detail-section";
import { Avatar } from "@/components/ui/avatar";
import { Users } from "lucide-react";

interface AttendeeChipGridProps {
  attendees: StructuredBrief["attendees"];
}

export function AttendeeChipGrid({ attendees }: AttendeeChipGridProps) {
  if (attendees.length <= 1) return null;

  return (
    <PrepDetailSection
      title="Also Attending"
      icon={<Users className="h-3.5 w-3.5 text-indigo-600" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {attendees.map((attendee, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border p-2.5"
          >
            <Avatar name={attendee.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {attendee.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {attendee.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </PrepDetailSection>
  );
}

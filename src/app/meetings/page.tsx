"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, isToday, isTomorrow, isPast, isThisWeek } from "date-fns";
import { ArrowRight, Calendar, Clock, Users, ChevronDown } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Meeting = {
  id: string;
  title: string;
  purpose: string | null;
  startTime: string;
  attendees: {
    contact: {
      id: string;
      name: string;
      company?: { name: string };
    };
  }[];
};

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isThisWeek(date, { weekStartsOn: 1 }))
    return format(date, "EEEE");
  return format(date, "EEEE, MMM d");
}

function groupByDate(meetings: Meeting[]): { label: string; date: string; meetings: Meeting[] }[] {
  const groups = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const key = format(new Date(m.startTime), "yyyy-MM-dd");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  return Array.from(groups.entries()).map(([date, meetings]) => ({
    label: getDateLabel(meetings[0].startTime),
    date,
    meetings,
  }));
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    async function fetchMeetings() {
      try {
        const res = await fetch("/api/meetings");
        if (!res.ok) throw new Error("Failed to fetch meetings");
        const data: Meeting[] = await res.json();
        setMeetings(data);
      } catch {
        setMeetings([]);
      } finally {
        setLoading(false);
      }
    }
    fetchMeetings();
  }, []);

  const now = new Date();
  const upcoming = meetings
    .filter((m) => new Date(m.startTime) >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const past = meetings
    .filter((m) => new Date(m.startTime) < now)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const upcomingGroups = groupByDate(upcoming);
  const pastGroups = groupByDate(past);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Meetings
            </h1>
            <p className="mt-1 text-muted-foreground">
              Your client meeting timeline
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{upcoming.length} upcoming</span>
            </div>
            <span className="text-border">·</span>
            <span>{past.length} past</span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-8">
            {[1, 2].map((g) => (
              <div key={g} className="space-y-3">
                <Skeleton className="h-5 w-32" />
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No meetings found.
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

            {/* Upcoming meetings */}
            {upcomingGroups.length > 0 && (
              <div className="space-y-6">
                {upcomingGroups.map((group) => (
                  <div key={group.date} className="relative space-y-3">
                    {/* Date label */}
                    <div className="flex items-center gap-3 pl-0">
                      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">
                          {group.label}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(group.date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    {/* Meeting cards */}
                    <div className="space-y-2 pl-[40px]">
                      {group.meetings.map((meeting) => (
                        <TimelineMeetingCard
                          key={meeting.id}
                          meeting={meeting}
                          isPast={false}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Now marker */}
            {upcoming.length > 0 && past.length > 0 && (
              <div className="relative my-6 flex items-center gap-3">
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background">
                  <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
                </div>
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">
                  NOW
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            {/* Past meetings */}
            {past.length > 0 && (
              <div className="space-y-2">
                {!showPast ? (
                  <div className="pl-[40px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPast(true)}
                      className="text-muted-foreground"
                    >
                      <ChevronDown className="h-4 w-4" />
                      Show {past.length} past meeting{past.length !== 1 ? "s" : ""}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {pastGroups.map((group) => (
                      <div key={group.date} className="relative space-y-3">
                        <div className="flex items-center gap-3 pl-0">
                          <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background">
                            <Calendar className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                          <div>
                            <h2 className="text-sm font-semibold text-muted-foreground">
                              {group.label}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(group.date), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 pl-[40px]">
                          {group.meetings.map((meeting) => (
                            <TimelineMeetingCard
                              key={meeting.id}
                              meeting={meeting}
                              isPast={true}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="pl-[40px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPast(false)}
                        className="text-muted-foreground"
                      >
                        Hide past meetings
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function TimelineMeetingCard({
  meeting,
  isPast,
}: {
  meeting: Meeting;
  isPast: boolean;
}) {
  const meetingDate = new Date(meeting.startTime);

  return (
    <Link href={`/meetings/${meeting.id}`}>
      <Card
        className={`transition-colors hover:bg-muted/50 ${isPast ? "opacity-70" : ""}`}
      >
        <CardContent className="flex items-start gap-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground line-clamp-1">
                {meeting.title}
              </h3>
              {isToday(meetingDate) && !isPast && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Today
                </Badge>
              )}
              {isTomorrow(meetingDate) && (
                <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                  Tomorrow
                </Badge>
              )}
              {isPast && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Past
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {format(meetingDate, "h:mm a")}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? "s" : ""}
              </span>
            </div>

            {meeting.purpose && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {meeting.purpose}
              </p>
            )}

            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {meeting.attendees.slice(0, 4).map((a) => (
                  <Avatar
                    key={a.contact.id}
                    name={a.contact.name}
                    size="sm"
                    className="ring-2 ring-background"
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {meeting.attendees
                  .slice(0, 3)
                  .map((a) => a.contact.name.split(" ")[0])
                  .join(", ")}
                {meeting.attendees.length > 3 &&
                  ` +${meeting.attendees.length - 3}`}
              </span>
            </div>
          </div>

          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

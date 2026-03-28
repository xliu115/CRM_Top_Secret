"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  format, isToday, isTomorrow, isThisWeek, startOfDay, endOfDay,
  startOfWeek, endOfWeek, addDays,
} from "date-fns";
import {
  ArrowRight, Calendar, Clock, Users, ChevronDown, ChevronUp,
  Star, X, ClipboardList, Filter,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getTierColors, type TierKey } from "@/lib/utils/tier-colors";

type Meeting = {
  id: string;
  title: string;
  purpose: string | null;
  startTime: string;
  attendees: {
    isRequired: boolean;
    contact: {
      id: string;
      name: string;
      importance: string;
      company?: { name: string };
    };
  }[];
};

type SmartView = "all" | "priority";
type DateRange = "today" | "this_week" | "next_7" | "next_30" | "all";
type AttendanceFilter = "all" | "required" | "optional";

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "next_7", label: "Next 7 Days" },
  { value: "next_30", label: "Next 30 Days" },
  { value: "all", label: "All" },
];

const ATTENDANCE_OPTIONS: { value: AttendanceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "required", label: "Required" },
  { value: "optional", label: "Optional" },
];

const TIER_OPTIONS: TierKey[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, "EEEE");
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

function meetingHasPriorityAttendee(m: Meeting): boolean {
  return m.attendees.some((a) => a.contact.importance === "CRITICAL" || a.contact.importance === "HIGH");
}

function getHighestTier(m: Meeting): string {
  const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  for (const tier of order) {
    if (m.attendees.some((a) => a.contact.importance === tier)) return tier;
  }
  return "LOW";
}

function matchesDateRange(startTime: string, range: DateRange): boolean {
  if (range === "all") return true;
  const date = new Date(startTime);
  const now = new Date();
  switch (range) {
    case "today":
      return date >= startOfDay(now) && date <= endOfDay(now);
    case "this_week":
      return date >= startOfWeek(now, { weekStartsOn: 1 }) && date <= endOfWeek(now, { weekStartsOn: 1 });
    case "next_7":
      return date >= startOfDay(now) && date <= endOfDay(addDays(now, 7));
    case "next_30":
      return date >= startOfDay(now) && date <= endOfDay(addDays(now, 30));
    default:
      return true;
  }
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [nudgeContactIds, setNudgeContactIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);

  const [smartView, setSmartView] = useState<SmartView>("all");
  const [dateRange, setDateRange] = useState<DateRange>("this_week");
  const [attendance, setAttendance] = useState<AttendanceFilter>("all");
  const [selectedTiers, setSelectedTiers] = useState<Set<TierKey>>(new Set());
  const [needsPrep, setNeedsPrep] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function fetchMeetings() {
      try {
        const res = await fetch("/api/meetings");
        if (!res.ok) throw new Error("Failed to fetch meetings");
        const data = await res.json();
        setMeetings(data.meetings);
        setNudgeContactIds(new Set(data.nudgeContactIds ?? []));
      } catch {
        setMeetings([]);
      } finally {
        setLoading(false);
      }
    }
    fetchMeetings();
  }, []);

  const allCompanies = useMemo(() => {
    const names = new Set<string>();
    for (const m of meetings) {
      for (const a of m.attendees) {
        if (a.contact.company?.name) names.add(a.contact.company.name);
      }
    }
    return [...names].sort();
  }, [meetings]);

  const hasActiveFilters = smartView !== "all" || dateRange !== "this_week" || attendance !== "all"
    || selectedTiers.size > 0 || needsPrep || selectedCompanies.size > 0;

  function clearAllFilters() {
    setSmartView("all");
    setDateRange("this_week");
    setAttendance("all");
    setSelectedTiers(new Set());
    setNeedsPrep(false);
    setSelectedCompanies(new Set());
  }

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      if (smartView === "priority" && !meetingHasPriorityAttendee(m)) return false;
      if (!matchesDateRange(m.startTime, dateRange)) return false;
      if (attendance === "required" && !m.attendees.some((a) => a.isRequired)) return false;
      if (attendance === "optional" && !m.attendees.some((a) => !a.isRequired)) return false;
      if (selectedTiers.size > 0 && !m.attendees.some((a) => selectedTiers.has(a.contact.importance as TierKey))) return false;
      if (needsPrep && !m.attendees.some((a) => nudgeContactIds.has(a.contact.id))) return false;
      if (selectedCompanies.size > 0 && !m.attendees.some((a) => a.contact.company?.name && selectedCompanies.has(a.contact.company.name))) return false;
      return true;
    });
  }, [meetings, smartView, dateRange, attendance, selectedTiers, needsPrep, selectedCompanies, nudgeContactIds]);

  const now = new Date();
  const upcoming = filtered
    .filter((m) => new Date(m.startTime) >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const past = filtered
    .filter((m) => new Date(m.startTime) < now)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const upcomingGroups = groupByDate(upcoming);
  const pastGroups = groupByDate(past);

  const activeFilterChips: { label: string; onRemove: () => void }[] = [];
  if (smartView === "priority") activeFilterChips.push({ label: "Priority Only", onRemove: () => setSmartView("all") });
  if (dateRange !== "this_week") {
    const label = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ?? dateRange;
    activeFilterChips.push({ label: `Date: ${label}`, onRemove: () => setDateRange("this_week") });
  }
  if (attendance !== "all") activeFilterChips.push({ label: attendance === "required" ? "Required" : "Optional", onRemove: () => setAttendance("all") });
  for (const tier of selectedTiers) {
    activeFilterChips.push({ label: tier, onRemove: () => { const next = new Set(selectedTiers); next.delete(tier); setSelectedTiers(next); } });
  }
  if (needsPrep) activeFilterChips.push({ label: "Needs Prep", onRemove: () => setNeedsPrep(false) });
  for (const company of selectedCompanies) {
    activeFilterChips.push({ label: company, onRemove: () => { const next = new Set(selectedCompanies); next.delete(company); setSelectedCompanies(next); } });
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Meetings</h1>
            <p className="mt-1 text-muted-foreground">Your client meeting timeline</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground-subtle">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{upcoming.length} upcoming</span>
            </div>
            <span className="text-border">&middot;</span>
            <span>{past.length} past</span>
            {filtered.length !== meetings.length && (
              <>
                <span className="text-border">&middot;</span>
                <span className="text-primary font-medium">{filtered.length} of {meetings.length} shown</span>
              </>
            )}
          </div>
        </div>

        {/* Smart view + filter toggle */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Button variant={smartView === "all" ? "default" : "outline"} size="sm" onClick={() => setSmartView("all")}>
                All Meetings
              </Button>
              <Button variant={smartView === "priority" ? "default" : "outline"} size="sm" onClick={() => setSmartView("priority")}>
                <Star className="h-3.5 w-3.5" />
                Priority Meetings
              </Button>
            </div>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <Button key={opt.value} variant={dateRange === opt.value ? "default" : "outline"} size="sm" onClick={() => setDateRange(opt.value)}>
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-3.5 w-3.5" />
              Filters
              {(attendance !== "all" || selectedTiers.size > 0 || needsPrep || selectedCompanies.size > 0) && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {(attendance !== "all" ? 1 : 0) + selectedTiers.size + (needsPrep ? 1 : 0) + selectedCompanies.size}
                </span>
              )}
            </Button>
          </div>

          {/* Expanded filter panel */}
          {showFilters && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
              {/* Attendance */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground-subtle w-24 shrink-0">Attendance:</span>
                {ATTENDANCE_OPTIONS.map((opt) => (
                  <Button key={opt.value} variant={attendance === opt.value ? "default" : "outline"} size="sm" onClick={() => setAttendance(opt.value)}>
                    {opt.label}
                  </Button>
                ))}
              </div>

              {/* Tier */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground-subtle w-24 shrink-0">Tier:</span>
                {TIER_OPTIONS.map((tier) => {
                  const colors = getTierColors(tier);
                  const isActive = selectedTiers.has(tier);
                  return (
                    <Button
                      key={tier}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const next = new Set(selectedTiers);
                        if (next.has(tier)) next.delete(tier); else next.add(tier);
                        setSelectedTiers(next);
                      }}
                    >
                      <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                      {tier}
                    </Button>
                  );
                })}
              </div>

              {/* Needs Prep */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground-subtle w-24 shrink-0">Prep:</span>
                <Button variant={needsPrep ? "default" : "outline"} size="sm" onClick={() => setNeedsPrep(!needsPrep)}>
                  <ClipboardList className="h-3.5 w-3.5" />
                  Needs Prep
                </Button>
              </div>

              {/* Company */}
              {allCompanies.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground-subtle w-24 shrink-0">Company:</span>
                  {allCompanies.map((company) => {
                    const isActive = selectedCompanies.has(company);
                    return (
                      <Button
                        key={company}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const next = new Set(selectedCompanies);
                          if (next.has(company)) next.delete(company); else next.add(company);
                          setSelectedCompanies(next);
                        }}
                      >
                        {company}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Active filter chips */}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary"
                >
                  {chip.label}
                  <button onClick={chip.onRemove} className="ml-0.5 rounded-full p-0.5 hover:bg-primary/10">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {hasActiveFilters && (
                <button onClick={clearAllFilters} className="text-xs text-muted-foreground-subtle hover:text-foreground underline">
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Timeline */}
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
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground-subtle">
              {meetings.length === 0
                ? "No meetings found."
                : "No meetings match your filters. Try adjusting or clearing filters."}
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

            {upcomingGroups.length > 0 && (
              <div className="space-y-6">
                {upcomingGroups.map((group) => (
                  <div key={group.date} className="relative space-y-3">
                    <div className="flex items-center gap-3 pl-0">
                      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
                        <p className="text-xs text-muted-foreground-subtle">{format(new Date(group.date), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                    <div className="space-y-2 pl-[40px]">
                      {group.meetings.map((meeting) => (
                        <TimelineMeetingCard key={meeting.id} meeting={meeting} isPast={false} nudgeContactIds={nudgeContactIds} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {upcoming.length > 0 && past.length > 0 && (
              <div className="relative my-6 flex items-center gap-3">
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background">
                  <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
                </div>
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground-subtle">NOW</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            {past.length > 0 && (
              <div className="space-y-2">
                {!showPast ? (
                  <div className="pl-[40px]">
                    <Button variant="ghost" size="sm" onClick={() => setShowPast(true)} className="text-muted-foreground-subtle">
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
                            <Calendar className="h-4 w-4 text-muted-foreground-subtle" />
                          </div>
                          <div>
                            <h2 className="text-sm font-semibold text-muted-foreground-subtle">{group.label}</h2>
                            <p className="text-xs text-muted-foreground-subtle">{format(new Date(group.date), "MMM d, yyyy")}</p>
                          </div>
                        </div>
                        <div className="space-y-2 pl-[40px]">
                          {group.meetings.map((meeting) => (
                            <TimelineMeetingCard key={meeting.id} meeting={meeting} isPast={true} nudgeContactIds={nudgeContactIds} />
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="pl-[40px]">
                      <Button variant="ghost" size="sm" onClick={() => setShowPast(false)} className="text-muted-foreground-subtle">
                        <ChevronUp className="h-4 w-4" />
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
  nudgeContactIds,
}: {
  meeting: Meeting;
  isPast: boolean;
  nudgeContactIds: Set<string>;
}) {
  const meetingDate = new Date(meeting.startTime);
  const highestTier = getHighestTier(meeting);
  const tierColors = getTierColors(highestTier);
  const isPriority = highestTier === "CRITICAL" || highestTier === "HIGH";
  const hasOptionalOnly = meeting.attendees.every((a) => !a.isRequired);
  const hasPrepNudge = meeting.attendees.some((a) => nudgeContactIds.has(a.contact.id));

  return (
    <Link href={`/meetings/${meeting.id}`}>
      <Card className={`transition-colors hover:bg-muted/50${isPast ? " bg-muted/10" : ""}`}>
        <CardContent className="flex items-start gap-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {isPriority && (
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${tierColors.dot}`} title={`${highestTier} attendee`} />
              )}
              <h3 className="font-semibold text-foreground line-clamp-1">{meeting.title}</h3>
              {isToday(meetingDate) && !isPast && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Today</Badge>
              )}
              {isTomorrow(meetingDate) && (
                <Badge variant="warning" className="text-[10px] px-1.5 py-0">Tomorrow</Badge>
              )}
              {isPast && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Past</Badge>
              )}
              {hasOptionalOnly && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground-subtle">Optional</Badge>
              )}
              {hasPrepNudge && !isPast && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-indigo-200 text-indigo-600 bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:bg-indigo-950/30">
                  Needs Prep
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground-subtle">
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
              <p className="text-sm text-muted-foreground line-clamp-1">{meeting.purpose}</p>
            )}

            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {meeting.attendees.slice(0, 4).map((a) => (
                  <Avatar key={a.contact.id} name={a.contact.name} size="sm" className="ring-2 ring-background" />
                ))}
              </div>
              <span className="text-xs text-muted-foreground-subtle">
                {meeting.attendees.slice(0, 3).map((a) => a.contact.name.split(" ")[0]).join(", ")}
                {meeting.attendees.length > 3 && ` +${meeting.attendees.length - 3}`}
              </span>
            </div>
          </div>

          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground-subtle" />
        </CardContent>
      </Card>
    </Link>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Users,
  Globe,
  ExternalLink,
  CalendarDays,
  BookOpen,
  Megaphone,
  Clock,
  Bell,
  Activity,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownPreview } from "@/components/ui/markdown-preview";
import { getTierColors } from "@/lib/utils/tier-colors";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";

type CompanyInfo = {
  id: string;
  name: string;
  industry: string;
  description: string;
  employeeCount: number;
  website: string;
};

type ContactSummary = {
  id: string;
  name: string;
  title: string;
  email: string;
  importance: string;
  lastContacted: string | null;
  daysSinceLastInteraction: number | null;
  lastInteraction: { type: string; summary: string; date: string } | null;
  openNudgeCount: number;
  otherPartners: string[];
};

type Interaction = {
  id: string;
  contactId: string;
  type: string;
  date: string;
  summary: string;
  sentiment: string;
  nextStep: string | null;
};

type Signal = {
  id: string;
  type: string;
  date: string;
  content: string;
  url: string | null;
  confidence: number;
};

type EventRegistration = {
  id: string;
  name: string;
  status: string;
  eventDate: string;
  practice: string;
  type: string;
  eventSize: string | null;
  location: string | null;
};

type ArticleEngagement = {
  id: string;
  name: string;
  articleSent: string;
  views: number;
  sentFrom: string | null;
  lastViewDate: string | null;
};

type CampaignOutreach = {
  id: string;
  name: string;
  status: string;
  statusDate: string;
};

type CompanyMeeting = {
  id: string;
  title: string;
  purpose: string | null;
  startTime: string;
  generatedBrief: string | null;
  attendees: {
    contact: {
      id: string;
      name: string;
      title: string;
      company: { name: string };
    };
  }[];
};

type FirmRelationship = {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  contactId: string;
  contactName: string;
  contactTitle: string;
  isCurrentUser: boolean;
  interactionCount: number;
  lastInteractionDate: string | null;
  lastInteractionType: string | null;
  lastInteractionSummary: string | null;
  daysSinceLastInteraction: number | null;
  intensity: "Very High" | "High" | "Medium" | "Light";
  intensityScore: number;
  contactsAtCompany: number;
};

type FirmRelationshipData = {
  companyName: string;
  totalPartners: number;
  totalContacts: number;
  relationships: FirmRelationship[];
};

function TierBadge({ importance }: { importance: string }) {
  const colors = getTierColors(importance);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}
    >
      {importance}
    </span>
  );
}

function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case "POSITIVE":
      return "bg-green-500";
    case "NEGATIVE":
      return "bg-red-500";
    default:
      return "bg-muted-foreground";
  }
}

function getIntensityStyle(intensity: string): string {
  switch (intensity) {
    case "Very High":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800";
    case "High":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
    case "Medium":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600";
  }
}

function formatDaysAgo(days: number | null): string {
  if (days === null) return "No interactions";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const COL = {
  bar: "w-1 shrink-0",
  name: "flex-[2] min-w-0",
  lastInteraction: "flex-[1.5] min-w-0 hidden md:block",
  daysSince: "flex-[0.9] min-w-0",
  otherPartners: "flex-[1.5] min-w-0 hidden lg:block",
  nudge: "flex-[0.7] min-w-0 shrink-0",
} as const;

function ContactTableRow({ contact }: { contact: ContactSummary }) {
  const colors = getTierColors(contact.importance);
  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="flex items-center gap-6 px-5 py-3.5 transition-[background-color,box-shadow] duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
    >
      <div className={`${COL.bar} self-stretch rounded-r ${colors.bar}`} />
      <div className={`${COL.name} flex items-center gap-3`}>
        <Avatar name={contact.name} size="sm" className="shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {contact.name}
          </p>
          <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
            {contact.title}
          </p>
        </div>
      </div>
      <div className={COL.lastInteraction}>
        {contact.lastInteraction ? (
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-tight">
              <span className="font-medium text-foreground/80">
                {contact.lastInteraction.type}
              </span>
              {" · "}
              {format(new Date(contact.lastInteraction.date), "MMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground/70 truncate leading-tight mt-0.5">
              {contact.lastInteraction.summary}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </div>
      <div className={COL.daysSince}>
        {contact.daysSinceLastInteraction !== null ? (
          <span className="text-sm font-semibold tabular-nums text-primary">
            {contact.daysSinceLastInteraction}d
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </div>
      <div
        className={`${COL.otherPartners} text-xs text-muted-foreground truncate`}
      >
        {contact.otherPartners.length > 0
          ? contact.otherPartners.join(", ")
          : "—"}
      </div>
      <div className={COL.nudge}>
        {contact.openNudgeCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary border border-primary/20">
            <Bell className="h-2.5 w-2.5" />
            {contact.openNudgeCount}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </div>
    </Link>
  );
}

export default function CompanyDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [events, setEvents] = useState<EventRegistration[]>([]);
  const [articles, setArticles] = useState<ArticleEngagement[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOutreach[]>([]);
  const [meetings, setMeetings] = useState<CompanyMeeting[]>([]);
  const [firmRelData, setFirmRelData] = useState<FirmRelationshipData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/companies/${id}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Company not found");
          throw new Error("Failed to fetch company");
        }
        const data = await res.json();
        setCompany(data.company);
        setContacts(data.contacts ?? []);
        setInteractions(data.interactions ?? []);
        setSignals(data.signals ?? []);
        setEvents(data.engagements?.events ?? []);
        setArticles(data.engagements?.articles ?? []);
        setCampaigns(data.engagements?.campaigns ?? []);
        setMeetings(data.meetings ?? []);
        setFirmRelData(data.firmRelationships ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading && !company) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardShell>
    );
  }

  if (error || !company) {
    return (
      <DashboardShell>
        <div className="space-y-4">
          <Button variant="ghost" asChild>
            <Link href="/companies">
              <ArrowLeft className="h-4 w-4" />
              Back to Institutions
            </Link>
          </Button>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error ?? "Company not found"}
          </div>
        </div>
      </DashboardShell>
    );
  }

  const now = new Date();
  const upcomingMeetings = meetings
    .filter((m) => new Date(m.startTime) >= now)
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  const pastMeetings = meetings
    .filter((m) => new Date(m.startTime) < now)
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/companies" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Institutions
          </Link>
        </Button>

        {/* Company header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <CardTitle className="text-2xl">{company.name}</CardTitle>
                <CardDescription>{company.description}</CardDescription>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-sm text-muted-foreground">
                  <Badge variant="outline">{company.industry}</Badge>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {company.employeeCount.toLocaleString()} employees
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    {contacts.length} contact
                    {contacts.length !== 1 ? "s" : ""}
                  </span>
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Website
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Stats summary */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{contacts.length}</p>
                  <p className="text-xs text-muted-foreground">Contacts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{interactions.length}</p>
                  <p className="text-xs text-muted-foreground">Interactions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{signals.length}</p>
                  <p className="text-xs text-muted-foreground">Signals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{meetings.length}</p>
                  <p className="text-xs text-muted-foreground">Meetings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="contacts" className="w-full">
          <TabsList>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="interactions">Interactions</TabsTrigger>
            <TabsTrigger value="signals">Signals</TabsTrigger>
            <TabsTrigger value="engagement">Reach & Engagement</TabsTrigger>
            <TabsTrigger value="firm-relationship">
              Firm Relationship
            </TabsTrigger>
          </TabsList>

          {/* Contacts Tab — mirrors the Contacts list table */}
          <TabsContent value="contacts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Contacts at {company.name}</CardTitle>
                <CardDescription>
                  {contacts.length} contact{contacts.length !== 1 ? "s" : ""}{" "}
                  you manage at this company
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {contacts.length === 0 ? (
                  <div className="px-6 pb-6">
                    <p className="text-sm text-muted-foreground">
                      No contacts at this company.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-6 px-5 h-11 border-b border-border text-sm text-muted-foreground select-none">
                      <div className="w-1 shrink-0" />
                      <div className={COL.name}>Contact</div>
                      <div className={COL.lastInteraction}>
                        Last Interaction
                      </div>
                      <div className={COL.daysSince}>Days Since</div>
                      <div className={COL.otherPartners}>Other Partners</div>
                      <div className={COL.nudge}>Nudges</div>
                    </div>
                    <div className="divide-y divide-border/30">
                      {contacts.map((ct) => (
                        <ContactTableRow key={ct.id} contact={ct} />
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interactions Tab — includes Meetings */}
          <TabsContent value="interactions" className="mt-4 space-y-6">
            {/* Meetings */}
            {meetings.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Meetings ({meetings.length})
                      </CardTitle>
                      <CardDescription>
                        {upcomingMeetings.length > 0
                          ? `${upcomingMeetings.length} upcoming`
                          : "No upcoming meetings"}
                        {pastMeetings.length > 0 &&
                          ` · ${pastMeetings.length} past`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcomingMeetings.map((meeting) => (
                      <CompanyMeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        isPast={false}
                      />
                    ))}
                    {pastMeetings.length > 0 && (
                      <PastMeetingsSection meetings={pastMeetings} />
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Past Interactions */}
            <Card>
              <CardHeader>
                <CardTitle>Past Interactions</CardTitle>
                <CardDescription>
                  All interactions with contacts at {company.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {interactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No interactions yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {interactions.map((interaction) => (
                      <div
                        key={interaction.id}
                        className="flex gap-4 rounded-lg border border-border p-4"
                      >
                        <div
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${getSentimentColor(interaction.sentiment)}`}
                          title={interaction.sentiment}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {interaction.type}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(
                                new Date(interaction.date),
                                "MMM d, yyyy"
                              )}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-foreground">
                            {interaction.summary}
                          </p>
                          {interaction.nextStep && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Next: {interaction.nextStep}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Signals Tab */}
          <TabsContent value="signals" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>External Signals</CardTitle>
                <CardDescription>
                  News, events, and activity for {company.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {signals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No signals for this company.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {signals.map((signal) => (
                      <div
                        key={signal.id}
                        className="flex flex-col gap-2 rounded-lg border border-border p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge variant="outline">{signal.type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(signal.date), "MMM d, yyyy")} ·{" "}
                            {(signal.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <p className="text-sm text-foreground">
                          {signal.content}
                        </p>
                        {signal.url && (
                          <a
                            href={signal.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View source
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reach & Engagement Tab */}
          <TabsContent value="engagement" className="mt-4 space-y-6">
            {/* Events */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Events ({events.length})
                    </CardTitle>
                    <CardDescription>Sorted by date</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No event registrations.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">#</th>
                          <th className="pb-2 pr-4 font-medium">Name</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 pr-4 font-medium">Event Date</th>
                          <th className="pb-2 pr-4 font-medium">Practice</th>
                          <th className="pb-2 pr-4 font-medium">Type</th>
                          <th className="pb-2 pr-4 font-medium">Event Size</th>
                          <th className="pb-2 font-medium">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.slice(0, 10).map((ev, i) => (
                          <tr
                            key={ev.id}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {i + 1}
                            </td>
                            <td className="py-2.5 pr-4 font-medium text-primary">
                              {ev.name}
                            </td>
                            <td className="py-2.5 pr-4">
                              <Badge
                                variant={
                                  ev.status === "Attended"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {ev.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {format(new Date(ev.eventDate), "MM/dd/yyyy")}
                            </td>
                            <td className="py-2.5 pr-4">{ev.practice}</td>
                            <td className="py-2.5 pr-4">{ev.type}</td>
                            <td className="py-2.5 pr-4">
                              {ev.eventSize ?? "—"}
                            </td>
                            <td className="py-2.5">{ev.location ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {events.length > 10 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Showing 10 of {events.length} events
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Articles */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Articles ({articles.length})
                    </CardTitle>
                    <CardDescription>Sorted by engagement</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {articles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No article engagements.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">#</th>
                          <th className="pb-2 pr-4 font-medium">Name</th>
                          <th className="pb-2 pr-4 font-medium">
                            Article Sent
                          </th>
                          <th className="pb-2 pr-4 font-medium">
                            Number of Views
                          </th>
                          <th className="pb-2 pr-4 font-medium">Sent from</th>
                          <th className="pb-2 font-medium">Last View Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {articles.slice(0, 10).map((art, i) => (
                          <tr
                            key={art.id}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {i + 1}
                            </td>
                            <td className="py-2.5 pr-4 font-medium text-primary">
                              {art.name}
                            </td>
                            <td className="py-2.5 pr-4">{art.articleSent}</td>
                            <td className="py-2.5 pr-4">{art.views}</td>
                            <td className="py-2.5 pr-4">
                              {art.sentFrom ?? "—"}
                            </td>
                            <td className="py-2.5">
                              {art.lastViewDate
                                ? format(
                                    new Date(art.lastViewDate),
                                    "MM/dd/yyyy"
                                  )
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {articles.length > 10 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Showing 10 of {articles.length} articles
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Campaign Outreach */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Campaign Outreach ({campaigns.length})
                    </CardTitle>
                    <CardDescription>Sorted by status date</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No campaign outreach records.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">#</th>
                          <th className="pb-2 pr-4 font-medium">Name</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 font-medium">Status Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.slice(0, 10).map((camp, i) => (
                          <tr
                            key={camp.id}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="py-2.5 pr-4 text-muted-foreground">
                              {i + 1}
                            </td>
                            <td className="py-2.5 pr-4 font-medium">
                              {camp.name}
                            </td>
                            <td className="py-2.5 pr-4">
                              <Badge
                                variant={
                                  camp.status === "Clicked"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {camp.status}
                              </Badge>
                            </td>
                            <td className="py-2.5">
                              {format(
                                new Date(camp.statusDate),
                                "MM/dd/yyyy"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {campaigns.length > 10 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Showing 10 of {campaigns.length} campaigns
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Firm Relationship Tab — anchored on Contacts, show # of Partners */}
          <TabsContent value="firm-relationship" className="mt-4">
            <FirmRelationshipTab
              firmRelData={firmRelData}
              companyName={company.name}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

function FirmRelationshipTab({
  firmRelData,
  companyName,
}: {
  firmRelData: FirmRelationshipData | null;
  companyName: string;
}) {
  const [expandedContactIds, setExpandedContactIds] = useState<Set<string>>(
    new Set()
  );

  const contactsWithPartners = useMemo(() => {
    if (!firmRelData?.relationships.length) return [];
    const byContact = new Map<
      string,
      {
        contactId: string;
        contactName: string;
        contactTitle: string;
        partners: FirmRelationship[];
      }
    >();
    for (const rel of firmRelData.relationships) {
      const existing = byContact.get(rel.contactId);
      if (existing) {
        existing.partners.push(rel);
      } else {
        byContact.set(rel.contactId, {
          contactId: rel.contactId,
          contactName: rel.contactName,
          contactTitle: rel.contactTitle,
          partners: [rel],
        });
      }
    }
    return Array.from(byContact.values()).sort(
      (a, b) => b.partners.length - a.partners.length
    );
  }, [firmRelData]);

  function toggleExpand(contactId: string) {
    setExpandedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Firm Relationship</CardTitle>
              <CardDescription className="text-pretty">
                {firmRelData
                  ? `Contacts at ${firmRelData.companyName}. Expand a row to see which partners have a relationship.`
                  : `Partner relationships at ${companyName}.`}
              </CardDescription>
            </div>
          </div>
          {firmRelData && contactsWithPartners.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-end sm:text-right">
              <span>
                <span className="font-semibold tabular-nums text-foreground">
                  {contactsWithPartners.length}
                </span>{" "}
                contact
                {contactsWithPartners.length !== 1 ? "s" : ""}
              </span>
              <span>
                <span className="font-semibold tabular-nums text-foreground">
                  {firmRelData.totalPartners}
                </span>{" "}
                partner link
                {firmRelData.totalPartners !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {contactsWithPartners.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No firm relationships found for this institution.
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {contactsWithPartners.map((c) => {
              const isExpanded = expandedContactIds.has(c.contactId);
              return (
                <div
                  key={c.contactId}
                  className={cn(
                    "transition-colors",
                    isExpanded && "bg-muted/20"
                  )}
                >
                  <div className="relative">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`firm-partners-${c.contactId}`}
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} partners for ${c.contactName}`}
                      onClick={() => toggleExpand(c.contactId)}
                      className="absolute inset-0 z-0 rounded-none hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    />
                    <div className="pointer-events-none relative z-10 flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground shadow-sm"
                          aria-hidden
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                        <Avatar
                          name={c.contactName}
                          size="md"
                          className="shrink-0 ring-2 ring-background"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            id={`firm-contact-label-${c.contactId}`}
                            className="text-sm font-semibold leading-tight text-foreground"
                          >
                            {c.contactName}
                          </p>
                          {c.contactTitle ? (
                            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                              {c.contactTitle}
                            </p>
                          ) : null}
                          <p className="mt-2 sm:hidden">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                              <Users className="h-3 w-3 shrink-0" />
                              {c.partners.length} partner
                              {c.partners.length !== 1 ? "s" : ""}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-2 pl-[5.25rem] sm:flex-row sm:items-center sm:gap-3 sm:pl-0">
                        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          <span className="tabular-nums">{c.partners.length}</span>
                          <span className="font-normal text-primary/90">
                            partner{c.partners.length !== 1 ? "s" : ""}
                          </span>
                        </span>
                        <Link
                          href={`/contacts/${c.contactId}`}
                          className="pointer-events-auto relative z-20 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          View contact
                        </Link>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <div
                      id={`firm-partners-${c.contactId}`}
                      role="region"
                      aria-labelledby={`firm-contact-label-${c.contactId}`}
                      className="border-t border-border/50 bg-muted/25 px-5 pb-5 pt-1"
                    >
                      <p className="px-1 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Partners
                      </p>
                      <ul className="overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm divide-y divide-border/50">
                        {c.partners.map((rel) => (
                          <li
                            key={`${rel.partnerId}-${rel.contactId}`}
                            className="px-4 py-3.5 sm:px-5"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                              <div className="flex min-w-0 flex-1 gap-3">
                                <Avatar
                                  name={rel.partnerName}
                                  size="sm"
                                  className="mt-0.5 shrink-0 ring-2 ring-background"
                                />
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                    <p className="text-sm font-semibold leading-tight text-foreground">
                                      {rel.isCurrentUser ? "You" : rel.partnerName}
                                      {rel.isCurrentUser ? (
                                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                          ({rel.partnerName})
                                        </span>
                                      ) : null}
                                    </p>
                                    <span
                                      className={cn(
                                        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none",
                                        getIntensityStyle(rel.intensity)
                                      )}
                                    >
                                      {rel.intensity}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                                      <Activity className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                      {rel.interactionCount}{" "}
                                      interaction
                                      {rel.interactionCount !== 1 ? "s" : ""}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                      <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                      {formatDaysAgo(
                                        rel.daysSinceLastInteraction
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompanyMeetingCard({
  meeting,
  isPast,
}: {
  meeting: CompanyMeeting;
  isPast: boolean;
}) {
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [brief, setBrief] = useState<string | null>(meeting.generatedBrief);
  const [copySuccess, setCopySuccess] = useState(false);

  async function handleGenerateBrief() {
    setGeneratingBrief(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/brief`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate brief");
      const data = await res.json();
      setBrief(data.brief);
      setBriefExpanded(true);
    } catch {
      // silently fail
    } finally {
      setGeneratingBrief(false);
    }
  }

  function handleCopyBrief() {
    if (!brief) return;
    void navigator.clipboard.writeText(brief);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  const meetingDate = new Date(meeting.startTime);

  return (
    <div
      className={`rounded-lg border p-4 ${
        isPast
          ? "border-border/50 bg-muted/20 opacity-75"
          : "border-primary/20 bg-primary/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/meetings/${meeting.id}`}
              className="font-semibold text-foreground hover:underline"
            >
              {meeting.title}
            </Link>
            {!isPast && (
              <Badge
                variant="outline"
                className="text-[10px] border-primary/30 text-primary"
              >
                Upcoming
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {format(meetingDate, "EEE, MMM d 'at' h:mm a")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {meeting.attendees.length} attendee
              {meeting.attendees.length !== 1 ? "s" : ""}
            </span>
          </div>

          {meeting.purpose && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {meeting.purpose}
            </p>
          )}

          {meeting.attendees.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {meeting.attendees.slice(0, 3).map((a) => (
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
                  .slice(0, 2)
                  .map((a) => a.contact.name)
                  .join(", ")}
                {meeting.attendees.length > 2 &&
                  ` +${meeting.attendees.length - 2}`}
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {brief ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBriefExpanded(!briefExpanded)}
              className="text-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              {briefExpanded ? "Hide Brief" : "View Brief"}
            </Button>
          ) : (
            <Button
              variant={isPast ? "ghost" : "secondary"}
              size="sm"
              onClick={handleGenerateBrief}
              disabled={generatingBrief}
              className="text-xs"
            >
              {generatingBrief ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  Generate Brief
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {briefExpanded && brief && (
        <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
          <div className="rounded-md border border-border bg-background p-4">
            <MarkdownPreview content={brief} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopyBrief}>
              {copySuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Brief
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateBrief}
              disabled={generatingBrief}
            >
              {generatingBrief ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Regenerate"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PastMeetingsSection({ meetings }: { meetings: CompanyMeeting[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {expanded ? "Hide" : "Show"} {meetings.length} past meeting
        {meetings.length !== 1 ? "s" : ""}
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          {meetings.map((meeting) => (
            <CompanyMeetingCard
              key={meeting.id}
              meeting={meeting}
              isPast={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

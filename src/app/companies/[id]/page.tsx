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
  UserCheck,
  Sparkles,
  X,
  RefreshCw,
  FileBarChart,
  Mic,
  Newspaper,
  TrendingUp,
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
  contactName: string;
};

type ArticleEngagement = {
  id: string;
  name: string;
  articleSent: string;
  views: number;
  sentFrom: string | null;
  lastViewDate: string | null;
  contactName: string;
};

type CampaignOutreach = {
  id: string;
  name: string;
  status: string;
  statusDate: string;
  contactName: string;
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

const CLIENT_ACTIVATION_POC: Record<string, string> = {
  "c-microsoft": "Sarah Chen",
  "c-apple": "David Park",
  "c-amazon": "Rachel Nguyen",
  "c-jpmorgan": "Michael Torres",
  "c-google": "Emily Zhao",
  "c-meta": "James Sullivan",
  "c-nvidia": "Priya Sharma",
  "c-salesforce": "Alex Rivera",
  "c-adobe": "Natalie Brooks",
  "c-netflix": "Daniel Kim",
  "c-nike": "Olivia Grant",
  "c-pepsico": "Marcus Johnson",
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

type EngagementSortKey = "date" | "name" | "status" | "practice" | "type" | "size" | "location";
type SortDirection = "asc" | "desc";

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 font-medium text-inherit hover:text-foreground focus-visible:outline-none focus-visible:underline"
    >
      <span>{label}</span>
      <span className={active ? "text-foreground" : "text-muted-foreground-subtle"}>
        {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
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
          <p className="text-xs text-muted-foreground-subtle truncate leading-tight mt-0.5">
            {contact.title}
          </p>
        </div>
      </div>
      <div className={COL.lastInteraction}>
        {contact.lastInteraction ? (
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground-subtle leading-tight">
              <span className="font-medium text-foreground/80">
                {contact.lastInteraction.type}
              </span>
              {" · "}
              {format(new Date(contact.lastInteraction.date), "MMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
              {contact.lastInteraction.summary}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground-subtle">—</span>
        )}
      </div>
      <div className={COL.daysSince}>
        {contact.daysSinceLastInteraction !== null ? (
          <span className="text-sm font-semibold tabular-nums text-primary">
            {contact.daysSinceLastInteraction}d
          </span>
        ) : (
          <span className="text-xs text-muted-foreground-subtle">—</span>
        )}
      </div>
      <div
        className={`${COL.otherPartners} text-xs text-muted-foreground-subtle truncate`}
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
          <span className="text-xs text-muted-foreground-subtle">—</span>
        )}
      </div>
    </Link>
  );
}

type DeduplicatedHealthEntry = {
  name: string;
  title: string;
  importance: string;
  interactionCount: number;
  lastInteractionDate: string | null;
  daysSinceLastInteraction: number | null;
  intensity: string;
  intensityScore: number;
  openNudges: number;
  contactId: string;
  partnerCount: number;
};

function deduplicateHealthMatrix(
  entries: {
    name: string;
    title: string;
    importance: string;
    interactionCount: number;
    lastInteractionDate: string | null;
    daysSinceLastInteraction: number | null;
    intensity: string;
    intensityScore: number;
    sentiment: string | null;
    openNudges: number;
    contactId: string;
  }[]
): DeduplicatedHealthEntry[] {
  const byName = new Map<string, DeduplicatedHealthEntry>();
  for (const e of entries) {
    const existing = byName.get(e.name);
    if (!existing) {
      byName.set(e.name, { ...e, partnerCount: 1 });
    } else {
      existing.partnerCount++;
      existing.interactionCount += e.interactionCount;
      existing.openNudges += e.openNudges;
      if (e.intensityScore > existing.intensityScore) {
        existing.intensity = e.intensity;
        existing.intensityScore = e.intensityScore;
        existing.lastInteractionDate = e.lastInteractionDate;
        existing.daysSinceLastInteraction = e.daysSinceLastInteraction;
        existing.contactId = e.contactId;
      }
    }
  }
  const importanceOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return Array.from(byName.values()).sort((a, b) => {
    const ia = importanceOrder[a.importance] ?? 9;
    const ib = importanceOrder[b.importance] ?? 9;
    if (ia !== ib) return ia - ib;
    return b.intensityScore - a.intensityScore;
  });
}

function formatBriefAge(generatedAt: string): string {
  const ms = Date.now() - new Date(generatedAt).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "just now";
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function Co360CollapsibleSection({
  sectionId,
  title,
  collapsed,
  onToggle,
  children,
  headerRight,
  nested,
}: {
  sectionId: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  nested?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border border-border bg-background/80",
      nested && "border-border/50"
    )}>
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <span className={cn(
          "font-semibold uppercase tracking-wider text-muted-foreground",
          nested ? "text-[10px]" : "text-xs"
        )}>
          {title}
        </span>
        <div className="flex items-center gap-2">
          {headerRight}
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>
      {!collapsed && (
        <div className="px-4 pb-3">{children}</div>
      )}
    </div>
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
  const [clientIQCampaigns, setClientIQCampaigns] = useState<
    { id: string; name: string; status: string; sentAt: string | null; recipientCount: number }[]
  >([]);
  const [meetings, setMeetings] = useState<CompanyMeeting[]>([]);
  const [firmRelData, setFirmRelData] = useState<FirmRelationshipData | null>(
    null
  );
  const [engagementSortKey, setEngagementSortKey] =
    useState<EngagementSortKey>("date");
  const [engagementSortDirection, setEngagementSortDirection] =
    useState<SortDirection>("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Company 360
  const [co360Loading, setCo360Loading] = useState(false);
  const [co360Error, setCo360Error] = useState<string | null>(null);
  const [co360Result, setCo360Result] = useState<{
    summary: string;
    sections: { id: string; title: string; content: string }[];
    firmCoverage: {
      totalPartners: number;
      totalContacts: number;
      partners: {
        partnerName: string;
        isCurrentUser: boolean;
        contactCount: number;
        totalInteractions: number;
        lastInteractionDate: string | null;
      }[];
    };
    healthMatrix: {
      name: string;
      title: string;
      importance: string;
      interactionCount: number;
      lastInteractionDate: string | null;
      daysSinceLastInteraction: number | null;
      intensity: string;
      intensityScore: number;
      sentiment: string | null;
      openNudges: number;
      contactId: string;
    }[];
    companyBrief: {
      subsections: { id: string; title: string; content: string }[];
      sources: { id: string; title: string; type: string; url: string; date: string; publisher?: string }[];
      generatedAt: string;
      model: string;
    } | null;
  } | null>(null);
  const [co360Expanded, setCo360Expanded] = useState(true);
  const [co360CollapsedSections, setCo360CollapsedSections] = useState<Set<string>>(new Set());
  const [briefRefreshing, setBriefRefreshing] = useState(false);

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
        setClientIQCampaigns(data.campaignActivity?.campaigns ?? []);
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

  async function handleCompany360() {
    if (co360Result) {
      setCo360Expanded(!co360Expanded);
      return;
    }
    setCo360Loading(true);
    setCo360Error(null);
    try {
      const res = await fetch(`/api/companies/${id}/company360`);
      if (!res.ok) throw new Error("Failed to generate Company 360");
      const data = await res.json();
      setCo360Result(data.result);
      setCo360Expanded(true);
    } catch (err) {
      setCo360Error(err instanceof Error ? err.message : "Failed to generate Company 360");
    } finally {
      setCo360Loading(false);
    }
  }

  async function handleRefreshBrief() {
    setBriefRefreshing(true);
    try {
      const res = await fetch(`/api/companies/${id}/company-brief/refresh`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to refresh Company Brief");
      const data = await res.json();
      setCo360Result((prev) => prev ? { ...prev, companyBrief: data.companyBrief } : prev);
    } catch (err) {
      console.error("Brief refresh failed:", err);
    } finally {
      setBriefRefreshing(false);
    }
  }

  function toggleCo360Section(sectionId: string) {
    setCo360CollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

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
  function toggleEngagementSort(key: EngagementSortKey) {
    if (engagementSortKey === key) {
      setEngagementSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setEngagementSortKey(key);
    setEngagementSortDirection(key === "date" ? "desc" : "asc");
  }

  const sortedEvents = [...events].sort((a, b) => {
    let cmp = 0;
    switch (engagementSortKey) {
      case "date":
        cmp = new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
        break;
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      case "practice":
        cmp = a.practice.localeCompare(b.practice);
        break;
      case "type":
        cmp = a.type.localeCompare(b.type);
        break;
      case "size":
        cmp = (a.eventSize ?? "").localeCompare(b.eventSize ?? "");
        break;
      case "location":
        cmp = (a.location ?? "").localeCompare(b.location ?? "");
        break;
    }
    return engagementSortDirection === "asc" ? cmp : -cmp;
  });
  const sortedArticles = [...articles].sort((a, b) => {
    let cmp = 0;
    switch (engagementSortKey) {
      case "date":
        cmp =
          new Date(a.lastViewDate ?? a.articleSent).getTime() -
          new Date(b.lastViewDate ?? b.articleSent).getTime();
        break;
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "status":
        cmp = a.articleSent.localeCompare(b.articleSent);
        break;
      case "type":
        cmp = a.views - b.views;
        break;
      case "size":
        cmp = (a.sentFrom ?? "").localeCompare(b.sentFrom ?? "");
        break;
      case "location":
        cmp = (a.lastViewDate ?? "").localeCompare(b.lastViewDate ?? "");
        break;
      case "practice":
        cmp = 0;
        break;
    }
    return engagementSortDirection === "asc" ? cmp : -cmp;
  });
  const sortedCampaigns = [...campaigns].sort((a, b) => {
    let cmp = 0;
    switch (engagementSortKey) {
      case "date":
        cmp = new Date(a.statusDate).getTime() - new Date(b.statusDate).getTime();
        break;
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      default:
        cmp = 0;
    }
    return engagementSortDirection === "asc" ? cmp : -cmp;
  });

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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-2xl">{company.name}</CardTitle>
                    <CardDescription>{company.description}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleCompany360}
                    disabled={co360Loading}
                    className="shrink-0"
                  >
                    {co360Loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Company 360
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-sm text-muted-foreground-subtle">
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
                  {CLIENT_ACTIVATION_POC[company.id] && (
                    <span className="inline-flex items-center gap-1">
                      <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="text-muted-foreground-subtle">Client Activation PoC:</span>
                      <span className="font-medium text-foreground">
                        {CLIENT_ACTIVATION_POC[company.id]}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Company 360 Dossier */}
        {co360Error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {co360Error}
          </div>
        )}
        {co360Loading && !co360Result && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Company 360 intelligence...
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {co360Result && co360Expanded && (
          <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Company 360
                  </CardTitle>
                  <CardDescription className="text-sm italic mt-1">
                    {co360Result.summary}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCo360Expanded(false)}
                  aria-label="Collapse dossier"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Section 1: Company Overview (LLM prose) */}
              {co360Result.sections.filter((s) => s.id === "overview").map((section) => (
                <Co360CollapsibleSection
                  key={section.id}
                  sectionId={section.id}
                  title={section.title}
                  collapsed={co360CollapsedSections.has(section.id)}
                  onToggle={() => toggleCo360Section(section.id)}
                >
                  <MarkdownPreview content={section.content} />
                </Co360CollapsibleSection>
              ))}

              {/* Section 2: Firm Coverage & Relationship Health (combined) */}
              <Co360CollapsibleSection
                sectionId="coverage-health"
                title="Firm Coverage & Relationship Health"
                collapsed={co360CollapsedSections.has("coverage-health")}
                onToggle={() => toggleCo360Section("coverage-health")}
              >
                {/* Partner coverage chips */}
                {co360Result.firmCoverage.partners.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {co360Result.firmCoverage.partners
                      .sort((a, b) => (a.isCurrentUser ? -1 : b.isCurrentUser ? 1 : b.totalInteractions - a.totalInteractions))
                      .map((p, i) => (
                        <div
                          key={i}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                            p.isCurrentUser
                              ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                              : "border-border bg-muted/40"
                          )}
                        >
                          <span className="font-medium">{p.partnerName}</span>
                          {p.isCurrentUser && <span className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold">You</span>}
                          <span className="text-muted-foreground">{p.contactCount}c · {p.totalInteractions}i</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Deduplicated contact health rows */}
                {co360Result.healthMatrix.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
                          <th className="text-left py-1.5 pr-2 font-medium">Contact</th>
                          <th className="text-center py-1.5 px-1 font-medium">Tier</th>
                          <th className="text-center py-1.5 px-1 font-medium">Partners</th>
                          <th className="text-right py-1.5 px-1 font-medium">Int.</th>
                          <th className="text-right py-1.5 px-1 font-medium">Last</th>
                          <th className="text-right py-1.5 pl-1 font-medium">Health</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {deduplicateHealthMatrix(co360Result.healthMatrix).map((entry) => {
                          const isCold = entry.intensity === "Cold" || (entry.daysSinceLastInteraction !== null && entry.daysSinceLastInteraction > 60);
                          return (
                            <tr
                              key={entry.name}
                              className={cn(
                                "transition-colors hover:bg-muted/30",
                                isCold && "bg-red-50/30 dark:bg-red-950/10"
                              )}
                            >
                              <td className="py-1.5 pr-2">
                                <Link href={`/contacts/${entry.contactId}`} className="hover:underline">
                                  <span className="font-semibold text-foreground">{entry.name}</span>
                                </Link>
                                <span className="text-muted-foreground text-xs ml-1 hidden sm:inline">{entry.title}</span>
                              </td>
                              <td className="py-1.5 px-1 text-center">
                                <TierBadge importance={entry.importance} />
                              </td>
                              <td className="py-1.5 px-1 text-center tabular-nums text-xs text-muted-foreground">
                                {entry.partnerCount}
                              </td>
                              <td className="py-1.5 px-1 text-right tabular-nums">{entry.interactionCount}</td>
                              <td className={cn(
                                "py-1.5 px-1 text-right whitespace-nowrap text-xs",
                                entry.daysSinceLastInteraction !== null && entry.daysSinceLastInteraction > 60 && "text-red-600 dark:text-red-400",
                                entry.daysSinceLastInteraction !== null && entry.daysSinceLastInteraction > 30 && entry.daysSinceLastInteraction <= 60 && "text-amber-600 dark:text-amber-400",
                                (entry.daysSinceLastInteraction === null || entry.daysSinceLastInteraction <= 30) && "text-green-600 dark:text-green-400",
                              )}>
                                {entry.lastInteractionDate
                                  ? format(new Date(entry.lastInteractionDate), "MMM d")
                                  : "Never"}
                              </td>
                              <td className="py-1.5 pl-1 text-right">
                                <span className={cn(
                                  "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                                  entry.intensity === "Very High" && "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800",
                                  entry.intensity === "High" && "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
                                  entry.intensity === "Medium" && "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
                                  (entry.intensity === "Light" || entry.intensity === "Cold") && "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
                                )}>
                                  {entry.intensity}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No contacts tracked at this company.</p>
                )}
              </Co360CollapsibleSection>

              {/* Section 4: Company Brief (web-researched) */}
              <Co360CollapsibleSection
                sectionId="brief"
                title="Company Brief"
                collapsed={co360CollapsedSections.has("brief")}
                onToggle={() => toggleCo360Section("brief")}
                headerRight={
                  co360Result.companyBrief ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        Generated {formatBriefAge(co360Result.companyBrief.generatedAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); handleRefreshBrief(); }}
                        disabled={briefRefreshing}
                        aria-label="Refresh Company Brief"
                      >
                        <RefreshCw className={cn("h-3 w-3", briefRefreshing && "animate-spin")} />
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                {briefRefreshing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Company Brief...
                    </div>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-1.5">
                        <Skeleton className="h-3 w-1/4" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))}
                  </div>
                ) : co360Result.companyBrief ? (
                  <div className="space-y-2">
                    {co360Result.companyBrief.subsections.map((sub) => (
                      <Co360CollapsibleSection
                        key={sub.id}
                        sectionId={`brief-${sub.id}`}
                        title={sub.title}
                        collapsed={co360CollapsedSections.has(`brief-${sub.id}`)}
                        onToggle={() => toggleCo360Section(`brief-${sub.id}`)}
                        nested
                      >
                        <MarkdownPreview content={sub.content} />
                      </Co360CollapsibleSection>
                    ))}
                    {co360Result.companyBrief.sources.length > 0 && (
                      <Co360CollapsibleSection
                        sectionId="brief-sources"
                        title={`Sources (${co360Result.companyBrief.sources.length})`}
                        collapsed={!co360CollapsedSections.has("brief-sources-open")}
                        onToggle={() => toggleCo360Section("brief-sources-open")}
                        nested
                      >
                        <div className="space-y-1">
                          {co360Result.companyBrief.sources.map((src) => (
                            <div key={src.id} className="flex items-start gap-2 text-xs">
                              <span className="mt-0.5 shrink-0">
                                {src.type === "filing" && <FileBarChart className="h-3 w-3 text-blue-500" />}
                                {src.type === "transcript" && <Mic className="h-3 w-3 text-purple-500" />}
                                {src.type === "news" && <Newspaper className="h-3 w-3 text-amber-500" />}
                                {src.type === "analyst" && <TrendingUp className="h-3 w-3 text-green-500" />}
                                {src.type === "other" && <FileText className="h-3 w-3 text-muted-foreground" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline truncate block"
                                >
                                  [{src.id}] {src.title}
                                </a>
                                <span className="text-muted-foreground">
                                  {src.publisher && `${src.publisher} · `}{src.date}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Co360CollapsibleSection>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Company Brief not yet available.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshBrief}
                      disabled={briefRefreshing}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", briefRefreshing && "animate-spin")} />
                      Generate Company Brief
                    </Button>
                  </div>
                )}
              </Co360CollapsibleSection>

              {/* Strategic Recommendations (LLM prose) */}
              {co360Result.sections.filter((s) => s.id === "recommendations").map((section) => (
                <Co360CollapsibleSection
                  key={section.id}
                  sectionId={section.id}
                  title={section.title}
                  collapsed={co360CollapsedSections.has(section.id)}
                  onToggle={() => toggleCo360Section(section.id)}
                >
                  <MarkdownPreview content={section.content} />
                </Co360CollapsibleSection>
              ))}
            </CardContent>
          </Card>
        )}

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
                  <p className="text-xs text-muted-foreground-subtle">Contacts</p>
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
                  <p className="text-xs text-muted-foreground-subtle">Interactions</p>
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
                  <p className="text-xs text-muted-foreground-subtle">Signals</p>
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
                  <p className="text-xs text-muted-foreground-subtle">Meetings</p>
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
                    <p className="text-sm text-muted-foreground-subtle">
                      No contacts at this company.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-6 px-5 h-11 border-b border-border text-sm text-muted-foreground-subtle select-none">
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
                  <p className="text-sm text-muted-foreground-subtle">
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
                            <span className="text-sm text-muted-foreground-subtle">
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
                            <p className="mt-2 text-xs text-muted-foreground-subtle">
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
                  <p className="text-sm text-muted-foreground-subtle">
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
                          <span className="text-xs text-muted-foreground-subtle">
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
                    <CardDescription>
                      Sorted by {engagementSortKey === "date" ? "date" : engagementSortKey}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {events.length === 0 ? (
                  <div className="px-6 pb-6">
                    <p className="text-sm text-muted-foreground-subtle">
                      No event registrations.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-6 px-5 h-11 border-b border-border text-sm text-muted-foreground-subtle select-none">
                      <div className="w-1 shrink-0" />
                      <div className="flex-[2] min-w-0">
                        <SortButton label="Name" active={engagementSortKey === "name"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("name")} />
                      </div>
                      <div className="flex-[1.2] min-w-0">
                        <span className="text-xs font-medium">Contact</span>
                      </div>
                      <div className="flex-[1.2] min-w-0">
                        <SortButton label="Status" active={engagementSortKey === "status"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("status")} />
                      </div>
                      <div className="flex-[1.2] min-w-0 hidden md:block">
                        <SortButton label="Date" active={engagementSortKey === "date"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("date")} />
                      </div>
                      <div className="flex-[1.1] min-w-0 hidden lg:block">
                        <SortButton label="Practice" active={engagementSortKey === "practice"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("practice")} />
                      </div>
                      <div className="flex-[1] min-w-0 hidden xl:block">
                        <SortButton label="Type" active={engagementSortKey === "type"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("type")} />
                      </div>
                    </div>
                    <div className="divide-y divide-border/30">
                      {sortedEvents.slice(0, 10).map((ev) => (
                        <div key={ev.id} className="flex items-center gap-6 px-5 py-3.5 transition-[background-color,box-shadow] duration-150 hover:bg-muted/50">
                          <div className="w-1 shrink-0 self-stretch rounded-r bg-red-500" />
                          <div className="flex-[2] min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate leading-tight">{ev.name}</p>
                            <p className="text-xs text-muted-foreground-subtle truncate leading-tight mt-0.5 md:hidden">{format(new Date(ev.eventDate), "MMM d, yyyy")}</p>
                          </div>
                          <div className="flex-[1.2] min-w-0 text-sm text-foreground truncate">{ev.contactName}</div>
                          <div className="flex-[1.2] min-w-0">
                            <Badge variant={ev.status === "Attended" ? "secondary" : "outline"}>{ev.status}</Badge>
                          </div>
                          <div className="flex-[1.2] min-w-0 text-sm text-muted-foreground-subtle hidden md:block">{format(new Date(ev.eventDate), "MMM d, yyyy")}</div>
                          <div className="flex-[1.1] min-w-0 text-sm text-foreground hidden lg:block truncate">{ev.practice}</div>
                          <div className="flex-[1] min-w-0 text-sm text-foreground hidden xl:block truncate">{ev.type}</div>
                        </div>
                      ))}
                    </div>
                    {events.length > 10 && <p className="mt-2 px-6 text-xs text-muted-foreground-subtle">Showing 10 of {events.length} events</p>}
                  </>
                )}
              </CardContent>
            </Card>

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
              <CardContent className="p-0">
                {articles.length === 0 ? (
                  <div className="px-6 pb-6">
                    <p className="text-sm text-muted-foreground-subtle">
                      No article engagements.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-6 px-5 h-11 border-b border-border text-sm text-muted-foreground-subtle select-none">
                      <div className="w-1 shrink-0" />
                      <div className="flex-[2] min-w-0">
                        <SortButton label="Name" active={engagementSortKey === "name"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("name")} />
                      </div>
                      <div className="flex-[1.2] min-w-0">
                        <span className="text-xs font-medium">Contact</span>
                      </div>
                      <div className="flex-[1.4] min-w-0">
                        <SortButton label="Article Sent" active={engagementSortKey === "status"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("status")} />
                      </div>
                      <div className="flex-[1] min-w-0 hidden md:block">
                        <SortButton label="Views" active={engagementSortKey === "type"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("type")} />
                      </div>
                      <div className="flex-[1.2] min-w-0 hidden lg:block">
                        <SortButton label="Sent from" active={engagementSortKey === "size"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("size")} />
                      </div>
                      <div className="flex-[1.2] min-w-0 hidden md:block">
                        <SortButton label="Last View Date" active={engagementSortKey === "date"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("date")} />
                      </div>
                    </div>
                    <div className="divide-y divide-border/30">
                      {sortedArticles.slice(0, 10).map((art) => (
                        <div key={art.id} className="flex items-center gap-6 px-5 py-3.5 transition-[background-color,box-shadow] duration-150 hover:bg-muted/50">
                          <div className="w-1 shrink-0 self-stretch rounded-r bg-purple-500" />
                          <div className="flex-[2] min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate leading-tight">{art.name}</p>
                            <p className="text-xs text-muted-foreground-subtle truncate leading-tight mt-0.5 md:hidden">{art.articleSent}</p>
                          </div>
                          <div className="flex-[1.2] min-w-0 text-sm text-foreground truncate">{art.contactName}</div>
                          <div className="flex-[1.4] min-w-0 text-sm text-foreground truncate">{art.articleSent}</div>
                          <div className="flex-[1] min-w-0 text-sm text-foreground hidden md:block tabular-nums">{art.views}</div>
                          <div className="flex-[1.2] min-w-0 text-sm text-foreground hidden lg:block truncate">{art.sentFrom ?? "—"}</div>
                          <div className="flex-[1.2] min-w-0 text-sm text-muted-foreground-subtle hidden md:block">{art.lastViewDate ? format(new Date(art.lastViewDate), "MMM d, yyyy") : "—"}</div>
                        </div>
                      ))}
                    </div>
                    {articles.length > 10 && <p className="mt-2 px-6 text-xs text-muted-foreground-subtle">Showing 10 of {articles.length} articles</p>}
                  </>
                )}
              </CardContent>
            </Card>

            {clientIQCampaigns.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Megaphone className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Campaigns ({clientIQCampaigns.length})
                      </CardTitle>
                      <CardDescription>Campaigns that included contacts at this company</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/30">
                    {clientIQCampaigns.map((c) => (
                      <Link
                        key={c.id}
                        href={`/campaigns/${c.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
                      >
                        <div className="w-1 shrink-0 self-stretch rounded-r bg-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground-subtle">
                            {c.recipientCount} recipient{c.recipientCount !== 1 ? "s" : ""}
                            {c.sentAt ? ` · Sent ${format(new Date(c.sentAt), "MMM d, yyyy")}` : " · Draft"}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {c.status === "IN_PROGRESS" ? "In Progress" : c.status === "PENDING_APPROVAL" ? "Pending Approval" : c.status === "SENT" ? "Sent" : c.status === "DRAFT" ? "Draft" : c.status}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
              <CardContent className="p-0">
                {campaigns.length === 0 ? (
                  <div className="px-6 pb-6">
                    <p className="text-sm text-muted-foreground-subtle">
                      No campaign outreach records.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-6 px-5 h-11 border-b border-border text-sm text-muted-foreground-subtle select-none">
                      <div className="w-1 shrink-0" />
                      <div className="flex-[2] min-w-0">
                        <SortButton label="Name" active={engagementSortKey === "name"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("name")} />
                      </div>
                      <div className="flex-[1.2] min-w-0">
                        <span className="text-xs font-medium">Contact</span>
                      </div>
                      <div className="flex-[1.2] min-w-0">
                        <SortButton label="Status" active={engagementSortKey === "status"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("status")} />
                      </div>
                      <div className="flex-[1.2] min-w-0 hidden md:block">
                        <SortButton label="Status Date" active={engagementSortKey === "date"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("date")} />
                      </div>
                    </div>
                    <div className="divide-y divide-border/30">
                      {sortedCampaigns.slice(0, 10).map((camp) => (
                        <div key={camp.id} className="flex items-center gap-6 px-5 py-3.5 transition-[background-color,box-shadow] duration-150 hover:bg-muted/50">
                          <div className="w-1 shrink-0 self-stretch rounded-r bg-blue-500" />
                          <div className="flex-[2] min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate leading-tight">{camp.name}</p>
                          </div>
                          <div className="flex-[1.2] min-w-0 text-sm text-foreground truncate">{camp.contactName}</div>
                          <div className="flex-[1.2] min-w-0">
                            <Badge variant={camp.status === "Clicked" ? "secondary" : "outline"}>{camp.status}</Badge>
                          </div>
                          <div className="flex-[1.2] min-w-0 text-sm text-muted-foreground-subtle hidden md:block">{format(new Date(camp.statusDate), "MMM d, yyyy")}</div>
                        </div>
                      ))}
                    </div>
                    {campaigns.length > 10 && <p className="mt-2 px-6 text-xs text-muted-foreground-subtle">Showing 10 of {campaigns.length} campaigns</p>}
                  </>
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
            <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground-subtle sm:justify-end sm:text-right">
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
          <p className="px-6 py-8 text-center text-sm text-muted-foreground-subtle">
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
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground-subtle shadow-sm"
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
                            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground-subtle">
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
                      <p className="px-1 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground-subtle">
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
                                        <span className="ml-1.5 text-xs font-normal text-muted-foreground-subtle">
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
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground-subtle">
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
      const res = await fetch(`/api/meetings/${meeting.id}/brief?force=true`, {
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
          ? "border-border/50 bg-muted/20"
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

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground-subtle">
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
              <span className="text-xs text-muted-foreground-subtle">
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
        className="flex items-center gap-1 text-sm text-muted-foreground-subtle hover:text-foreground"
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

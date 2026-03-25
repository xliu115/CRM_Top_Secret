"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Copy,
  Loader2,
  ExternalLink,
  Check,
  CalendarDays,
  BookOpen,
  Megaphone,
  X,
  Pencil,
  Clock,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  Building2,
  Moon,
  Send,
  RotateCcw,
  Briefcase,
  Newspaper,
  ClipboardList,
  Ticket,
  CalendarCheck,
  Linkedin,
  Settings,
  Sparkles,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownPreview } from "@/components/ui/markdown-preview";
import { buildSummaryFragments } from "@/lib/utils/nudge-summary";
import { getTierColors } from "@/lib/utils/tier-colors";
import { importanceDisplayLabel } from "@/lib/utils/importance-labels";
import {
  getStaleDaysForTier,
  type PartnerStaleDaysConfig,
} from "@/lib/utils/tier-review-suggestions";
import { format } from "date-fns";

type Contact = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string | null;
  notes: string | null;
  importance: string;
  staleThresholdDays: number | null;
  disabledNudgeTypes: string | null;
  companyId: string;
  company: { name: string };
};

type Interaction = {
  id: string;
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

type ContactMeeting = {
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

type ContactNudge = {
  id: string;
  ruleType: string;
  reason: string;
  priority: string;
  status: string;
  metadata?: string | null;
  contact: {
    id: string;
    name: string;
    email: string;
    title: string;
    company: { name: string };
  };
  signal?: {
    type: string;
    content: string;
    url?: string | null;
  } | null;
};

type InsightData = {
  type: string;
  reason: string;
  priority: string;
  signalId?: string;
  signalContent?: string;
  signalUrl?: string | null;
  relatedPartners?: { partnerId: string; partnerName: string }[];
  personName?: string;
};

type NudgeMetadata = {
  insights?: InsightData[];
  relatedPartners?: { partnerId: string; partnerName: string }[];
  personName?: string;
};

function parseMetadata(metadata?: string | null): NudgeMetadata | null {
  if (!metadata) return null;
  try { return JSON.parse(metadata); } catch { return null; }
}

type FirmRelationship = {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  contactId: string;
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
  contactName: string;
  companyName: string;
  totalPartners: number;
  relationships: FirmRelationship[];
};

function TierBadge({ importance }: { importance: string }) {
  const colors = getTierColors(importance);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}>
      {importanceDisplayLabel(importance)}
    </span>
  );
}

const TIER_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

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

const NUDGE_TYPES = [
  { key: "STALE_CONTACT", label: "Reconnect" },
  { key: "JOB_CHANGE", label: "Executive Transition" },
  { key: "COMPANY_NEWS", label: "Company News" },
  { key: "UPCOMING_EVENT", label: "Upcoming Event" },
  { key: "MEETING_PREP", label: "Meeting Prep" },
  { key: "EVENT_ATTENDED", label: "Event Follow-Up" },
  { key: "EVENT_REGISTERED", label: "Event Outreach" },
  { key: "ARTICLE_READ", label: "Content Follow-Up" },
  { key: "LINKEDIN_ACTIVITY", label: "LinkedIn Activity" },
] as const;

interface NudgeTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  ctaLabel: string;
  ctaIcon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const NUDGE_TYPE_CONFIG: Record<string, NudgeTypeConfig> = {
  STALE_CONTACT: { icon: Clock, label: "Reconnect", ctaLabel: "Draft Check-in", ctaIcon: Mail, color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/30" },
  JOB_CHANGE: { icon: Briefcase, label: "Executive Transition", ctaLabel: "Draft Congratulations", ctaIcon: Mail, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30" },
  COMPANY_NEWS: { icon: Newspaper, label: "Company News", ctaLabel: "Draft News Email", ctaIcon: Mail, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
  UPCOMING_EVENT: { icon: CalendarDays, label: "Upcoming Event", ctaLabel: "Draft Pre-Event Email", ctaIcon: Mail, color: "text-teal-600", bgColor: "bg-teal-50 dark:bg-teal-950/30" },
  MEETING_PREP: { icon: ClipboardList, label: "Meeting Prep", ctaLabel: "Generate Brief", ctaIcon: FileText, color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-950/30" },
  EVENT_ATTENDED: { icon: Ticket, label: "Event Follow-Up", ctaLabel: "Draft Follow-Up", ctaIcon: Mail, color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/30" },
  EVENT_REGISTERED: { icon: CalendarCheck, label: "Event Outreach", ctaLabel: "Draft Pre-Event Note", ctaIcon: Mail, color: "text-cyan-600", bgColor: "bg-cyan-50 dark:bg-cyan-950/30" },
  ARTICLE_READ: { icon: BookOpen, label: "Content Follow-Up", ctaLabel: "Draft Content Email", ctaIcon: Mail, color: "text-rose-600", bgColor: "bg-rose-50 dark:bg-rose-950/30" },
  LINKEDIN_ACTIVITY: { icon: Linkedin, label: "LinkedIn Activity", ctaLabel: "Draft LinkedIn Email", ctaIcon: Mail, color: "text-sky-600", bgColor: "bg-sky-50 dark:bg-sky-950/30" },
};

const DEFAULT_TYPE_CONFIG: NudgeTypeConfig = {
  icon: Send, label: "Nudge", ctaLabel: "Reach Out", ctaIcon: Send, color: "text-muted-foreground", bgColor: "bg-muted/50",
};

function getTypeConfig(ruleType: string): NudgeTypeConfig {
  return NUDGE_TYPE_CONFIG[ruleType] ?? DEFAULT_TYPE_CONFIG;
}

function getPriorityClassName(priority: string): string {
  switch (priority) {
    case "URGENT": return "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400";
    case "HIGH": return "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400";
    case "MEDIUM": return "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400";
    default: return "border-border bg-muted/50 text-muted-foreground";
  }
}

function getIntensityStyle(intensity: string): string {
  switch (intensity) {
    case "Very High":
      return "bg-green-100 text-green-800 border-green-200";
    case "High":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "Medium":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
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
      <span className={active ? "text-foreground" : "text-muted-foreground"}>
        {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

export default function ContactDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const autoNudgeId = searchParams.get("nudge");

  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [events, setEvents] = useState<EventRegistration[]>([]);
  const [articles, setArticles] = useState<ArticleEngagement[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOutreach[]>([]);
  const [meetings, setMeetings] = useState<ContactMeeting[]>([]);
  const [nudges, setNudges] = useState<ContactNudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reconnectDaysInput, setReconnectDaysInput] = useState("");
  const [savingThreshold, setSavingThreshold] = useState(false);

  const [firmRelData, setFirmRelData] = useState<FirmRelationshipData | null>(null);
  const [firmRelLoading, setFirmRelLoading] = useState(false);
  const [firmRelFetched, setFirmRelFetched] = useState(false);
  const [engagementSortKey, setEngagementSortKey] =
    useState<EngagementSortKey>("date");
  const [engagementSortDirection, setEngagementSortDirection] =
    useState<SortDirection>("desc");

  const [nudgeRuleConfig, setNudgeRuleConfig] = useState<PartnerStaleDaysConfig | null>(null);
  const [savingNudgePrefs, setSavingNudgePrefs] = useState(false);
  const [savingTier, setSavingTier] = useState(false);
  const [nudgePrefsExpanded, setNudgePrefsExpanded] = useState(false);

  const [showDraftPanel, setShowDraftPanel] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draftGenerated, setDraftGenerated] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/contacts/${id}/full`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Contact not found");
          throw new Error("Failed to fetch contact");
        }
        const data = await res.json();
        setContact(data.contact);
        setInteractions(data.interactions ?? []);
        setSignals(data.signals ?? []);
        setEvents(data.engagements?.events ?? []);
        setArticles(data.engagements?.articles ?? []);
        setCampaigns(data.engagements?.campaigns ?? []);
        setMeetings(data.meetings ?? []);
        setNudges(data.nudges ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  useEffect(() => {
    async function loadNudgeRules() {
      try {
        const res = await fetch("/api/nudge-rules");
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, unknown>;
        setNudgeRuleConfig({
          staleDaysCritical: Number(data.staleDaysCritical) || 30,
          staleDaysHigh: Number(data.staleDaysHigh) || 45,
          staleDaysMedium: Number(data.staleDaysMedium) || 60,
          staleDaysLow: Number(data.staleDaysLow) || 90,
        });
      } catch {
        setNudgeRuleConfig(null);
      }
    }
    loadNudgeRules();
  }, []);

  useEffect(() => {
    if (!contact) return;
    const tierD = getStaleDaysForTier(contact.importance, nudgeRuleConfig);
    const effective = contact.staleThresholdDays ?? tierD;
    setReconnectDaysInput(String(effective));
  }, [contact, nudgeRuleConfig]);

  async function handleGenerateEmail() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/contacts/${id}/draft-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nudgeReason: "General outreach" }),
      });
      if (!res.ok) throw new Error("Failed to generate email");
      const { subject, body } = await res.json();
      setDraftSubject(subject);
      setDraftBody(body);
      setDraftGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate email");
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyToClipboard() {
    const text = `Subject: ${draftSubject}\n\n${draftBody}`;
    void navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  async function handleTierChange(nextImportance: string) {
    if (!contact || nextImportance === contact.importance) return;
    setSavingTier(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importance: nextImportance }),
      });
      if (!res.ok) throw new Error("Failed to update tier");
      const updated = await res.json();
      setContact((prev) => (prev ? { ...prev, importance: updated.importance } : prev));
    } catch {
      setError("Failed to update relationship tier");
    } finally {
      setSavingTier(false);
    }
  }

  async function handleSaveThreshold(days: number | null) {
    setSavingThreshold(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staleThresholdDays: days }),
      });
      if (!res.ok) throw new Error("Failed to update threshold");
      const updated = await res.json();
      setContact((prev) => prev ? { ...prev, staleThresholdDays: updated.staleThresholdDays } : prev);
    } catch {
      setError("Failed to save staleness threshold");
    } finally {
      setSavingThreshold(false);
    }
  }

  function commitReconnectDays() {
    if (!contact) return;
    const tierD = getStaleDaysForTier(contact.importance, nudgeRuleConfig);
    const parsed = parseInt(reconnectDaysInput, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 365) {
      setReconnectDaysInput(String(contact.staleThresholdDays ?? tierD));
      return;
    }
    if (parsed === tierD) {
      if (contact.staleThresholdDays !== null) void handleSaveThreshold(null);
      return;
    }
    if (contact.staleThresholdDays === parsed) return;
    void handleSaveThreshold(parsed);
  }

  async function handleNudgeStatusUpdate(nudgeId: string, status: string) {
    try {
      const res = await fetch(`/api/nudges/${nudgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.status === 404) {
        // Nudge was already removed (e.g., by dashboard refresh) — treat as success
        setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to update nudge");
      }
      setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update nudge status");
    }
  }

  async function fetchFirmRelationships() {
    if (firmRelFetched) return;
    setFirmRelLoading(true);
    try {
      const res = await fetch(`/api/contacts/${id}/firm-relationships`);
      if (res.ok) {
        const data = await res.json();
        setFirmRelData(data);
      }
    } catch {
      // silently fail
    } finally {
      setFirmRelLoading(false);
      setFirmRelFetched(true);
    }
  }

  function getDisabledTypes(): Set<string> {
    if (!contact?.disabledNudgeTypes) return new Set();
    try {
      return new Set(JSON.parse(contact.disabledNudgeTypes) as string[]);
    } catch {
      return new Set();
    }
  }

  async function handleToggleNudgeType(typeKey: string) {
    if (!contact) return;
    const previousJson = contact.disabledNudgeTypes;
    const disabled = getDisabledTypes();
    if (disabled.has(typeKey)) {
      disabled.delete(typeKey);
    } else {
      disabled.add(typeKey);
    }
    const newDisabled = Array.from(disabled);
    const nextJson =
      newDisabled.length > 0 ? JSON.stringify(newDisabled) : null;
    setContact((prev) =>
      prev ? { ...prev, disabledNudgeTypes: nextJson } : prev
    );
    setSavingNudgePrefs(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disabledNudgeTypes: newDisabled.length > 0 ? newDisabled : null,
        }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setContact((prev) =>
          prev ? { ...prev, disabledNudgeTypes: previousJson } : prev
        );
        setError(
          typeof errBody.error === "string"
            ? errBody.error
            : "Could not save nudge type preferences"
        );
        return;
      }
      const updated = await res.json();
      setContact((prev) =>
        prev ? { ...prev, disabledNudgeTypes: updated.disabledNudgeTypes } : prev
      );
    } catch {
      setContact((prev) =>
        prev ? { ...prev, disabledNudgeTypes: previousJson } : prev
      );
      setError("Could not save nudge type preferences");
    } finally {
      setSavingNudgePrefs(false);
    }
  }

  const sortedInteractions = [...interactions].sort(
    (a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const sortedSignals = [...signals].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
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

  if (loading && !contact) {
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

  if (error || !contact) {
    return (
      <DashboardShell>
        <div className="space-y-4">
          <Button variant="ghost" asChild>
            <Link href="/contacts">
              <ArrowLeft className="h-4 w-4" />
              Back to Contacts
            </Link>
          </Button>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error ?? "Contact not found"}
          </div>
        </div>
      </DashboardShell>
    );
  }

  const tierDefaultDays = getStaleDaysForTier(contact.importance, nudgeRuleConfig);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/contacts" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Contacts
          </Link>
        </Button>

        {/* Profile header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar name={contact.name} size="lg" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-2xl">{contact.name}</CardTitle>
                  <TierBadge importance={contact.importance} />
                </div>
                <CardDescription>
                  {contact.title} at{" "}
                  <Link
                    href={`/companies/${contact.companyId}`}
                    className="text-primary hover:underline"
                  >
                    {contact.company.name}
                  </Link>
                </CardDescription>
                <div className="mt-1">
                  <button
                    className="flex items-center gap-1 rounded-md border border-transparent px-2 py-0.5 text-xs text-muted-foreground hover:border-border hover:text-foreground transition-colors"
                    onClick={() => setNudgePrefsExpanded(!nudgePrefsExpanded)}
                  >
                    {getDisabledTypes().size > 0 ? (
                      <BellOff className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Settings className="h-3.5 w-3.5" />
                    )}
                    <span>Nudge preferences</span>
                    {(contact.staleThresholdDays !== null || getDisabledTypes().size > 0) && (
                      <span className="text-muted-foreground/70">
                        ({[
                          contact.staleThresholdDays !== null ? `${contact.staleThresholdDays}d stale` : null,
                          getDisabledTypes().size > 0 ? `${getDisabledTypes().size} muted` : null,
                        ].filter(Boolean).join(", ")})
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <Button
                onClick={() => {
                  setShowDraftPanel(true);
                  if (!draftGenerated) handleGenerateEmail();
                }}
                disabled={generating}
                className="shrink-0"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    Draft an Email
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {nudgePrefsExpanded && (
          <div className="mt-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Stale threshold</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      className="h-7 w-20 text-xs"
                      value={reconnectDaysInput}
                      onChange={(e) => setReconnectDaysInput(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">days</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={savingThreshold}
                      onClick={() => commitReconnectDays()}
                    >
                      {savingThreshold ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    {contact.staleThresholdDays !== null && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        disabled={savingThreshold}
                        onClick={() => handleSaveThreshold(null)}
                      >
                        Use default
                      </Button>
                    )}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Nudge types</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {NUDGE_TYPES.map((nt) => {
                    const isDisabled = getDisabledTypes().has(nt.key);
                    return (
                      <button
                        key={nt.key}
                        disabled={savingNudgePrefs}
                        onClick={() => handleToggleNudgeType(nt.key)}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                          isDisabled
                            ? "border-border bg-muted text-muted-foreground line-through opacity-60"
                            : "border-primary/20 bg-primary/5 text-foreground"
                        } hover:border-primary/40`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            isDisabled ? "bg-muted-foreground/30" : "bg-primary"
                          }`}
                        />
                        {nt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email draft panel */}
        {showDraftPanel && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Draft Email</CardTitle>
                  <CardDescription>
                    Edit and copy your outreach email
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDraftPanel(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!draftGenerated ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating email draft...
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject</label>
                    <Input
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      placeholder="Email subject"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Body</label>
                    <Textarea
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      placeholder="Email body"
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={handleCopyToClipboard}
                    >
                      {copySuccess ? (
                        <>
                          <Check className="h-4 w-4 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy to Clipboard
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDraftGenerated(false);
                        handleGenerateEmail();
                      }}
                      disabled={generating}
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Regenerate"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Open nudges */}
        {nudges.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Open Nudges ({nudges.length})
            </h2>
            {nudges.map((nudge) => (
              <ContactNudgeCard
                key={nudge.id}
                nudge={nudge}
                onUpdateStatus={handleNudgeStatusUpdate}
                autoDraft={nudge.id === autoNudgeId}
              />
            ))}
          </div>
        )}

        <Tabs defaultValue="timeline" className="w-full">
          <TabsList>
            <TabsTrigger value="timeline">Interactions</TabsTrigger>
            <TabsTrigger value="signals">External Signals</TabsTrigger>
            <TabsTrigger value="engagement">Reach & Engagement</TabsTrigger>
            <TabsTrigger value="firm-relationship" onClick={fetchFirmRelationships}>
              Firm Relationship
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4 space-y-6">
            {/* Upcoming meetings */}
            <UpcomingMeetingsSection meetings={meetings} contactId={id} />

            {/* Past interactions */}
            <Card>
              <CardHeader>
                <CardTitle>Interactions</CardTitle>
                <CardDescription>
                  Chronological history of your interactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sortedInteractions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No interactions yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {sortedInteractions.map((interaction) => (
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

          <TabsContent value="signals" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>External Signals</CardTitle>
                <CardDescription>
                  News, events, and activity for this contact
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sortedSignals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No signals for this contact.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {sortedSignals.map((signal) => (
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

          <TabsContent value="firm-relationship" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Firm Relationship
                    </CardTitle>
                    <CardDescription>
                      {firmRelData
                        ? `${firmRelData.totalPartners} partner${firmRelData.totalPartners !== 1 ? "s" : ""} have ${firmRelData.contactName} in their contacts`
                        : "McKinsey partners with relationships to this contact"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {firmRelLoading ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading firm relationships...
                  </div>
                ) : !firmRelData || firmRelData.relationships.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No other partners have this contact in their CRM.
                  </p>
                ) : (
                  <div className="space-y-0 divide-y divide-border">
                    {firmRelData.relationships.map((rel) => (
                      <div
                        key={rel.partnerId}
                        className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                      >
                        <Avatar name={rel.partnerName} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {rel.isCurrentUser ? "You" : rel.partnerName}
                            </span>
                            {rel.isCurrentUser && (
                              <span className="text-xs text-muted-foreground">
                                ({rel.partnerName})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {rel.contactsAtCompany} contact{rel.contactsAtCompany !== 1 ? "s" : ""} at {firmRelData.companyName}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span
                            className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${getIntensityStyle(rel.intensity)}`}
                          >
                            {rel.intensity}
                          </span>
                          <div className="text-right min-w-[100px]">
                            <p className="text-sm text-muted-foreground">
                              {formatDaysAgo(rel.daysSinceLastInteraction)}
                            </p>
                            {rel.interactionCount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {rel.interactionCount} interaction{rel.interactionCount !== 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
                    <p className="text-sm text-muted-foreground">
                      No event registrations.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-6 px-5 h-11 border-b border-border text-sm text-muted-foreground select-none">
                      <div className="w-1 shrink-0" />
                      <div className="flex-[2] min-w-0">
                        <SortButton label="Name" active={engagementSortKey === "name"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("name")} />
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
                      <div className="flex-[0.9] min-w-0 hidden xl:block">
                        <SortButton label="Size" active={engagementSortKey === "size"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("size")} />
                      </div>
                      <div className="flex-[1.1] min-w-0 hidden xl:block">
                        <SortButton label="Location" active={engagementSortKey === "location"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("location")} />
                      </div>
                    </div>
                    <div className="divide-y divide-border/30">
                      {sortedEvents.slice(0, 10).map((ev) => (
                        <div key={ev.id} className="flex items-center gap-6 px-5 py-3.5 transition-[background-color,box-shadow] duration-150 hover:bg-muted/50">
                          <div className="w-1 shrink-0 self-stretch rounded-r bg-red-500" />
                          <div className="flex-[2] min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate leading-tight">{ev.name}</p>
                            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5 md:hidden">{format(new Date(ev.eventDate), "MM/dd/yyyy")}</p>
                          </div>
                          <div className="flex-[1.2] min-w-0">
                            <Badge variant={ev.status === "Attended" ? "secondary" : "outline"}>{ev.status}</Badge>
                          </div>
                          <div className="flex-[1.2] min-w-0 text-sm text-muted-foreground hidden md:block">{format(new Date(ev.eventDate), "MM/dd/yyyy")}</div>
                          <div className="flex-[1.1] min-w-0 text-sm text-foreground hidden lg:block truncate">{ev.practice}</div>
                          <div className="flex-[1] min-w-0 text-sm text-foreground hidden xl:block truncate">{ev.type}</div>
                          <div className="flex-[0.9] min-w-0 text-sm text-foreground hidden xl:block truncate">{ev.eventSize ?? "—"}</div>
                          <div className="flex-[1.1] min-w-0 text-sm text-foreground hidden xl:block truncate">{ev.location ?? "—"}</div>
                        </div>
                      ))}
                    </div>
                    {events.length > 10 && <p className="mt-2 px-6 text-xs text-muted-foreground">Showing 10 of {events.length} events</p>}
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
                    <p className="text-sm text-muted-foreground">
                      No article engagements.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-6 px-5 h-11 border-b border-border text-sm text-muted-foreground select-none">
                      <div className="w-1 shrink-0" />
                      <div className="flex-[2] min-w-0">
                        <SortButton label="Name" active={engagementSortKey === "name"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("name")} />
                      </div>
                      <div className="flex-[1.6] min-w-0">
                        <SortButton label="Article Sent" active={engagementSortKey === "status"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("status")} />
                      </div>
                      <div className="flex-[1.1] min-w-0 hidden md:block">
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
                            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5 md:hidden">{art.articleSent}</p>
                          </div>
                          <div className="flex-[1.6] min-w-0 text-sm text-foreground truncate">{art.articleSent}</div>
                          <div className="flex-[1.1] min-w-0 text-sm text-foreground hidden md:block tabular-nums">{art.views}</div>
                          <div className="flex-[1.2] min-w-0 text-sm text-foreground hidden lg:block truncate">{art.sentFrom ?? "—"}</div>
                          <div className="flex-[1.2] min-w-0 text-sm text-muted-foreground hidden md:block">{art.lastViewDate ? format(new Date(art.lastViewDate), "MM/dd/yyyy") : "—"}</div>
                        </div>
                      ))}
                    </div>
                    {articles.length > 10 && <p className="mt-2 px-6 text-xs text-muted-foreground">Showing 10 of {articles.length} articles</p>}
                  </>
                )}
              </CardContent>
            </Card>

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
                    <p className="text-sm text-muted-foreground">
                      No campaign outreach records.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-6 px-5 h-11 border-b border-border text-sm text-muted-foreground select-none">
                      <div className="w-1 shrink-0" />
                      <div className="flex-[2] min-w-0">
                        <SortButton label="Name" active={engagementSortKey === "name"} direction={engagementSortDirection} onClick={() => toggleEngagementSort("name")} />
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
                          <div className="flex-[1.2] min-w-0">
                            <Badge variant={camp.status === "Clicked" ? "secondary" : "outline"}>{camp.status}</Badge>
                          </div>
                          <div className="flex-[1.2] min-w-0 text-sm text-muted-foreground hidden md:block">{format(new Date(camp.statusDate), "MM/dd/yyyy")}</div>
                        </div>
                      ))}
                    </div>
                    {campaigns.length > 10 && <p className="mt-2 px-6 text-xs text-muted-foreground">Showing 10 of {campaigns.length} campaigns</p>}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

// ── Upcoming Meetings Section ────────────────────────────────────────

function UpcomingMeetingsSection({
  meetings,
  contactId,
}: {
  meetings: ContactMeeting[];
  contactId: string;
}) {
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

  if (meetings.length === 0) return null;

  return (
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
      <CardContent className="space-y-3">
        {upcomingMeetings.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            isPast={false}
            contactId={contactId}
          />
        ))}
        {pastMeetings.length > 0 && <PastMeetingsList meetings={pastMeetings} contactId={contactId} />}
      </CardContent>
    </Card>
  );
}

function PastMeetingsList({
  meetings,
  contactId,
}: {
  meetings: ContactMeeting[];
  contactId: string;
}) {
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
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              isPast={true}
              contactId={contactId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingCard({
  meeting,
  isPast,
  contactId,
}: {
  meeting: ContactMeeting;
  isPast: boolean;
  contactId: string;
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
  const otherAttendees = meeting.attendees.filter(
    (a) => a.contact.id !== contactId
  );

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
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
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

          {otherAttendees.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {otherAttendees.slice(0, 3).map((a) => (
                  <Avatar
                    key={a.contact.id}
                    name={a.contact.name}
                    size="sm"
                    className="ring-2 ring-background"
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                Also attending:{" "}
                {otherAttendees
                  .slice(0, 2)
                  .map((a) => a.contact.name)
                  .join(", ")}
                {otherAttendees.length > 2 &&
                  ` +${otherAttendees.length - 2}`}
              </span>
            </div>
          )}
        </div>

        {/* Brief actions */}
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

      {/* Expanded brief */}
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

// ── Contact Nudge Card ───────────────────────────────────────────────

function ContactNudgeCard({
  nudge,
  onUpdateStatus,
  autoDraft = false,
}: {
  nudge: ContactNudge;
  onUpdateStatus: (id: string, status: string) => void;
  autoDraft?: boolean;
}) {
  const [showDraft, setShowDraft] = useState(autoDraft);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoDraft && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [autoDraft]);
  const meta = parseMetadata(nudge.metadata);
  const insights = meta?.insights ?? [];
  const cfg = getTypeConfig(nudge.ruleType);
  const CtaIcon = cfg.ctaIcon;
  const hasMeetingPrep = insights.some((i) => i.type === "MEETING_PREP");
  const fragments = buildSummaryFragments(nudge, insights);

  const seen = new Map<string, string | null>();
  for (const ins of insights) {
    if (ins.type === "STALE_CONTACT") continue;
    if (!seen.has(ins.type)) {
      seen.set(ins.type, ins.signalUrl ?? null);
    } else if (!seen.get(ins.type) && ins.signalUrl) {
      seen.set(ins.type, ins.signalUrl);
    }
  }

  return (
    <Card ref={cardRef} className="overflow-hidden">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={getPriorityClassName(nudge.priority)}>
            {nudge.priority}
          </Badge>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-5 py-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">AI Summary</span>
          </div>
          <p className="text-sm text-foreground/70 leading-relaxed">
            {fragments.map((f, i) =>
              f.bold ? (
                <strong key={i} className="font-semibold text-foreground/90">{f.text}</strong>
              ) : (
                <span key={i}>{f.text}</span>
              )
            )}
          </p>
        </div>

        {seen.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {[...seen.entries()].map(([type, url]) => {
              const iCfg = getTypeConfig(type);
              const IIcon = iCfg.icon;
              return (
                <span
                  key={type}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80"
                >
                  <IIcon className={`h-3 w-3 ${iCfg.color}`} />
                  {iCfg.label}
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </span>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {hasMeetingPrep && (
            <Button size="sm" onClick={() => setShowDraft(!showDraft)}>
              <FileText className="h-4 w-4" />
              Generate Brief
            </Button>
          )}
          <Button size="sm" variant={hasMeetingPrep ? "outline" : "default"} onClick={() => setShowDraft(!showDraft)}>
            <CtaIcon className="h-4 w-4" />
            {hasMeetingPrep ? "Draft Email" : cfg.ctaLabel}
          </Button>

          {nudge.status === "OPEN" && (
            <>
              <Button variant="outline" size="sm" onClick={() => onUpdateStatus(nudge.id, "SNOOZED")}>
                <Moon className="h-4 w-4" />
                Snooze
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onUpdateStatus(nudge.id, "DONE")}>
                <Check className="h-4 w-4" />
                Done
              </Button>
            </>
          )}
          {nudge.status === "SNOOZED" && (
            <Button variant="ghost" size="sm" onClick={() => onUpdateStatus(nudge.id, "DONE")}>
              <Check className="h-4 w-4" />
              Done
            </Button>
          )}
        </div>

        {showDraft && (
          <ContactNudgeDraftPanel nudge={nudge} onClose={() => setShowDraft(false)} />
        )}
      </CardContent>
    </Card>
  );
}

function ContactNudgeDraftPanel({
  nudge,
  onClose,
}: {
  nudge: ContactNudge;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchDraft() {
      setLoading(true);
      setDraftError(null);
      try {
        const res = await fetch(`/api/nudges/${nudge.id}/draft-email`, { method: "POST" });
        if (!res.ok) throw new Error("Failed to generate draft");
        const data = await res.json();
        if (!cancelled) setDraft(data);
      } catch (err) {
        if (!cancelled) setDraftError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDraft();
    return () => { cancelled = true; };
  }, [nudge.id]);

  async function handleCopy() {
    if (!draft) return;
    const text = `Subject: ${draft.subject}\n\n${draft.body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    setLoading(true);
    setDraftError(null);
    try {
      const res = await fetch(`/api/nudges/${nudge.id}/draft-email`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate draft");
      setDraft(await res.json());
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-card p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Email Draft
        </h4>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Generating personalized draft...</span>
        </div>
      )}

      {draftError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {draftError}
        </div>
      )}

      {draft && !loading && (
        <>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <input
                type="text"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Body</label>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={8}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <a href={`mailto:${nudge.contact.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}>
                <Send className="h-3.5 w-3.5" />
                Open in Email
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={loading}>
              <RotateCcw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

export default function ContactDetailPage() {
  const params = useParams();
  const id = params?.id as string;

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
                {contact.email && (
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {contact.email}
                  </p>
                )}
                {contact.phone && (
                  <p className="text-sm text-muted-foreground">
                    {contact.phone}
                  </p>
                )}
                {contact.notes && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {contact.notes}
                  </p>
                )}
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

        {/* Tier & nudge preferences — compact until Edit */}
        <Card>
          <CardContent className="space-y-4 py-4">
            {!nudgePrefsExpanded ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-muted-foreground shrink-0">Tier</span>
                  <TierBadge importance={contact.importance} />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setNudgePrefsExpanded(true)}
                >
                  Edit
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <CardTitle className="text-base">Tier & nudge preferences</CardTitle>
                    <CardDescription className="text-xs">
                      Tier timing defaults:{" "}
                      <Link href="/nudges/settings" className="text-primary underline-offset-2 hover:underline">
                        nudge settings
                      </Link>
                      .
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-8 text-muted-foreground"
                    onClick={() => setNudgePrefsExpanded(false)}
                  >
                    Done
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="contact-tier" className="text-xs text-muted-foreground shrink-0">
                    Tier
                  </label>
                  <select
                    id="contact-tier"
                    className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[160px]"
                    value={contact.importance}
                    disabled={savingTier}
                    onChange={(e) => handleTierChange(e.target.value)}
                  >
                    {TIER_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {importanceDisplayLabel(t)}
                      </option>
                    ))}
                  </select>
                  {savingTier && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Nudge when there has been no interaction for</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Input
                      id="reconnect-days"
                      type="number"
                      min={1}
                      max={365}
                      className="h-8 w-[4.5rem] text-sm tabular-nums"
                      value={reconnectDaysInput}
                      disabled={savingThreshold}
                      onChange={(e) => setReconnectDaysInput(e.target.value)}
                      onBlur={() => commitReconnectDays()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    <span className="text-muted-foreground">days</span>
                    {savingThreshold && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
                    )}
                  </span>
                  {contact.staleThresholdDays !== null && (
                    <button
                      type="button"
                      className="text-xs text-primary underline-offset-2 hover:underline disabled:opacity-50"
                      disabled={savingThreshold}
                      onClick={() => handleSaveThreshold(null)}
                    >
                      Use tier default ({tierDefaultDays})
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="relative z-10 space-y-1.5">
              <p className="text-xs font-medium text-foreground">Nudge types for this contact</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {NUDGE_TYPES.map((nt) => {
                  const isOn = !getDisabledTypes().has(nt.key);
                  return (
                    <button
                      key={nt.key}
                      type="button"
                      disabled={savingNudgePrefs}
                      aria-pressed={isOn}
                      aria-label={`${nt.label}: ${isOn ? "on" : "off"}. Click to toggle.`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleToggleNudgeType(nt.key);
                      }}
                      className={`relative flex min-h-[2.25rem] w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors select-none hover:opacity-90 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        isOn
                          ? "border-primary/35 bg-primary/10 text-foreground"
                          : "border-muted bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`mt-0.5 size-1.5 shrink-0 rounded-full ${
                          isOn ? "bg-primary" : "bg-muted-foreground/45"
                        }`}
                        aria-hidden
                      />
                      <span className={`min-w-0 flex-1 leading-tight ${!isOn ? "line-through opacity-80" : ""}`}>
                        {nt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

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
                            <td className="py-2.5 pr-4">{ev.eventSize ?? "—"}</td>
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

function ContactNudgeInsightItem({ insight }: { insight: InsightData }) {
  const cfg = getTypeConfig(insight.type);
  const Icon = cfg.icon;
  const linkLabel = insight.type === "LINKEDIN_ACTIVITY" ? "View on LinkedIn"
    : insight.type === "JOB_CHANGE" ? "View on LinkedIn"
    : insight.type === "COMPANY_NEWS" ? "Read article"
    : "View source";

  return (
    <div className="flex gap-2.5">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${cfg.bgColor}`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
          {insight.signalUrl && (
            <a href={insight.signalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
              <ExternalLink className="h-2.5 w-2.5" />
              {linkLabel}
            </a>
          )}
        </div>
        <p className="text-sm text-foreground/80 leading-snug mt-0.5">{insight.reason}</p>
        {insight.relatedPartners && insight.relatedPartners.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <Users className="h-3 w-3 text-purple-500" />
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
              {insight.relatedPartners.map((p) => p.partnerName).join(", ")} know{insight.relatedPartners.length === 1 ? "s" : ""} {insight.personName ?? "this person"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactNudgeCard({
  nudge,
  onUpdateStatus,
}: {
  nudge: ContactNudge;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const [showDraft, setShowDraft] = useState(false);
  const [showAllInsights, setShowAllInsights] = useState(false);
  const meta = parseMetadata(nudge.metadata);
  const insights = meta?.insights ?? [];
  const cfg = getTypeConfig(nudge.ruleType);
  const CtaIcon = cfg.ctaIcon;
  const Icon = cfg.icon;

  const MAX_VISIBLE = 3;
  const visibleInsights = showAllInsights ? insights : insights.slice(0, MAX_VISIBLE);
  const hiddenCount = insights.length - MAX_VISIBLE;

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 w-full ${cfg.color.replace("text-", "bg-")}`} />
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bgColor}`}>
            <Icon className={`h-4 w-4 ${cfg.color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
              <Badge variant="outline" className={getPriorityClassName(nudge.priority)}>
                {nudge.priority}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-foreground leading-relaxed">{nudge.reason}</p>
          </div>
        </div>

        {insights.length > 0 && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            {visibleInsights.map((insight, i) => (
              <ContactNudgeInsightItem key={`${insight.type}-${i}`} insight={insight} />
            ))}
            {hiddenCount > 0 && !showAllInsights && (
              <button
                onClick={() => setShowAllInsights(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                +{hiddenCount} more
              </button>
            )}
            {showAllInsights && hiddenCount > 0 && (
              <button
                onClick={() => setShowAllInsights(false)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                Show less
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowDraft(!showDraft)}>
            <CtaIcon className="h-4 w-4" />
            {cfg.ctaLabel}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onUpdateStatus(nudge.id, "SNOOZED")}>
            <Moon className="h-4 w-4" />
            Snooze
          </Button>
          <Button variant="outline" size="sm" onClick={() => onUpdateStatus(nudge.id, "DONE")}>
            <Check className="h-4 w-4" />
            Done
          </Button>
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

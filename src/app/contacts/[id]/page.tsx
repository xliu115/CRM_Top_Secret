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
  BellOff,
  CalendarCheck,
  Linkedin,
  Settings,
  Sparkles,
  Forward,
  Pause,
  CheckCircle,
  Zap,
  CheckCircle2,
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
import { FragmentText } from "@/components/ui/fragment-text";
import { getTierColors } from "@/lib/utils/tier-colors";
import { importanceDisplayLabel } from "@/lib/utils/importance-labels";
import {
  getStaleDaysForTier,
  type PartnerStaleDaysConfig,
} from "@/lib/utils/tier-review-suggestions";
import { differenceInCalendarDays, format } from "date-fns";

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

type CampaignRecipientRow = {
  id: string;
  campaign: {
    id: string;
    name: string;
    status: string;
    sentAt: string | null;
  };
  engagements: {
    id: string;
    type: string;
    timestamp: string;
    metadata: string | null;
  }[];
  rsvpStatus: string | null;
};

function formatCampaignEngagementLabel(type: string): string {
  switch (type) {
    case "OPENED":
      return "Opened";
    case "CLICKED":
      return "Clicked";
    case "ARTICLE_READ":
      return "Article read";
    default:
      return type.replace(/_/g, " ");
  }
}

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

type ActiveOutreachSequence = {
  id: string;
  contactId: string;
  status: string;
  currentStep: number;
  contact: {
    id: string;
    name: string;
    company: { name: string };
  };
  steps: {
    id: string;
    stepNumber: number;
    status: string;
    executedAt: string | null;
    scheduledAt: string;
  }[];
};

function daysSinceLastExecutedStep(
  steps: ActiveOutreachSequence["steps"]
): number | null {
  const executedDates = steps
    .map((s) => (s.executedAt ? new Date(s.executedAt) : null))
    .filter((d): d is Date => d !== null);
  if (executedDates.length === 0) return null;
  const last = new Date(
    Math.max(...executedDates.map((d) => d.getTime()))
  );
  return differenceInCalendarDays(new Date(), last);
}

function formatWaitingSinceLastStep(
  steps: ActiveOutreachSequence["steps"]
): string {
  const d = daysSinceLastExecutedStep(steps);
  if (d === null) return " · no outbound step logged yet";
  if (d === 0) return " · today since last step";
  if (d === 1) return " · 1 day since last step";
  return ` · ${d} days since last step`;
}

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
  icon: Send, label: "Nudge", ctaLabel: "Reach Out", ctaIcon: Send, color: "text-muted-foreground-subtle", bgColor: "bg-muted/50",
};

function getTypeConfig(ruleType: string): NudgeTypeConfig {
  return NUDGE_TYPE_CONFIG[ruleType] ?? DEFAULT_TYPE_CONFIG;
}

function getPriorityClassName(priority: string): string {
  switch (priority) {
    case "URGENT": return "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400";
    case "HIGH": return "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400";
    case "MEDIUM": return "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400";
    default: return "border-border bg-muted/50 text-muted-foreground-subtle";
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
      <span className={active ? "text-foreground" : "text-muted-foreground-subtle"}>
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
  const [campaignRecipients, setCampaignRecipients] = useState<
    CampaignRecipientRow[]
  >([]);
  const [meetings, setMeetings] = useState<ContactMeeting[]>([]);
  const [nudges, setNudges] = useState<ContactNudge[]>([]);
  const [activeSequence, setActiveSequence] =
    useState<ActiveOutreachSequence | null>(null);
  const [sequenceActionLoading, setSequenceActionLoading] = useState(false);
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
  const [tierPickerOpen, setTierPickerOpen] = useState(false);
  const tierPickerRef = useRef<HTMLDivElement>(null);
  const [nudgePrefsExpanded, setNudgePrefsExpanded] = useState(false);

  const [showDraftPanel, setShowDraftPanel] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draftGenerated, setDraftGenerated] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [draftSending, setDraftSending] = useState(false);
  const [draftSendResult, setDraftSendResult] = useState<{ sent: boolean; sequenceStarted: boolean } | null>(null);

  // Contact 360
  const [c360Loading, setC360Loading] = useState(false);
  const [c360Result, setC360Result] = useState<{
    summary: string;
    sections: { id: string; title: string; content: string }[];
    talkingPoints: string[];
  } | null>(null);
  const [c360Expanded, setC360Expanded] = useState(true);
  const [c360CollapsedSections, setC360CollapsedSections] = useState<Set<string>>(new Set());
  const [c360FollowUp, setC360FollowUp] = useState("");
  const [c360FollowUpLoading, setC360FollowUpLoading] = useState(false);
  const [c360FollowUpAnswer, setC360FollowUpAnswer] = useState("");
  const [c360ShareEmail, setC360ShareEmail] = useState("");
  const [c360ShareOpen, setC360ShareOpen] = useState(false);
  const [c360ShareSending, setC360ShareSending] = useState(false);
  const [c360ShareSent, setC360ShareSent] = useState(false);

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
        setCampaignRecipients(data.campaignRecipients ?? []);
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
    if (!id) return;
    let cancelled = false;
    async function loadActiveSequence() {
      try {
        const res = await fetch("/api/sequences?status=ACTIVE");
        if (!res.ok) return;
        const list = (await res.json()) as ActiveOutreachSequence[];
        if (cancelled) return;
        const forContact = list.find((s) => s.contactId === id) ?? null;
        setActiveSequence(forContact);
      } catch {
        if (!cancelled) setActiveSequence(null);
      }
    }
    void loadActiveSequence();
    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    if (!tierPickerOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (tierPickerRef.current && !tierPickerRef.current.contains(e.target as Node)) {
        setTierPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [tierPickerOpen]);

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

  async function handleContact360() {
    if (c360Result) {
      setC360Expanded(!c360Expanded);
      return;
    }
    setC360Loading(true);
    try {
      const res = await fetch(`/api/contacts/${id}/contact360`);
      if (!res.ok) throw new Error("Failed to generate Contact 360");
      const data = await res.json();
      setC360Result(data.result);
      setC360Expanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate Contact 360");
    } finally {
      setC360Loading(false);
    }
  }

  async function handleC360FollowUp() {
    if (!c360FollowUp.trim() || !c360Result) return;
    setC360FollowUpLoading(true);
    try {
      const contextMsg = `[Contact 360 context for ${contact?.name}]\n${c360Result.summary}\n${c360Result.sections.map((s) => `${s.title}: ${s.content}`).join("\n")}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: c360FollowUp,
          history: [
            { role: "assistant", content: contextMsg },
            { role: "user", content: c360FollowUp },
          ],
        }),
      });
      if (!res.ok) throw new Error("Failed to get answer");
      const data = await res.json();
      setC360FollowUpAnswer(data.answer);
      setC360FollowUp("");
    } catch (err) {
      setC360FollowUpAnswer(err instanceof Error ? err.message : "Failed to get answer");
    } finally {
      setC360FollowUpLoading(false);
    }
  }

  async function handleC360Share() {
    if (!c360ShareEmail.trim() || !c360Result) return;
    setC360ShareSending(true);
    try {
      const res = await fetch(`/api/contacts/${id}/contact360/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: c360ShareEmail,
          result: c360Result,
        }),
      });
      if (!res.ok) throw new Error("Failed to share");
      setC360ShareSent(true);
      setTimeout(() => {
        setC360ShareOpen(false);
        setC360ShareSent(false);
        setC360ShareEmail("");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share dossier");
    } finally {
      setC360ShareSending(false);
    }
  }

  async function handleC360DraftEmail() {
    if (!c360Result) return;
    setGenerating(true);
    setShowDraftPanel(true);
    try {
      const context = c360Result.talkingPoints.length > 0
        ? `Context from Contact 360: ${c360Result.summary}. Talking points: ${c360Result.talkingPoints.join("; ")}`
        : `Context: ${c360Result.summary}`;
      const res = await fetch(`/api/contacts/${id}/draft-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nudgeReason: context }),
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

  function toggleC360Section(sectionId: string) {
    setC360CollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function handleCopyToClipboard() {
    const text = `Subject: ${draftSubject}\n\n${draftBody}`;
    void navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  async function handleDraftSendViaActivate() {
    if (!draftSubject || !draftBody || !contact) return;
    setDraftSending(true);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: id,
          subject: draftSubject,
          body: draftBody,
          nudgeReason: "General outreach",
          ruleType: "STALE_CONTACT",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send");
      }
      const data = await res.json();
      setDraftSendResult({ sent: true, sequenceStarted: data.sequenceStarted });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setDraftSending(false);
    }
  }

  async function handleTierChange(nextImportance: string) {
    if (!contact || nextImportance === contact.importance) {
      setTierPickerOpen(false);
      return;
    }
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
      setTierPickerOpen(false);
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

  async function handleSequencePause() {
    if (!activeSequence) return;
    setSequenceActionLoading(true);
    try {
      const res = await fetch(`/api/sequences/${activeSequence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data?.error === "string" ? data.error : "Failed to pause sequence"
        );
      }
      setActiveSequence(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to pause outreach sequence"
      );
    } finally {
      setSequenceActionLoading(false);
    }
  }

  async function handleSequenceMarkResponded() {
    if (!activeSequence) return;
    setSequenceActionLoading(true);
    try {
      const res = await fetch(`/api/sequences/${activeSequence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "respond" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Failed to mark sequence as responded"
        );
      }
      setActiveSequence(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark outreach as responded"
      );
    } finally {
      setSequenceActionLoading(false);
    }
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
                  <div className="relative" ref={tierPickerRef}>
                    <button
                      onClick={() => setTierPickerOpen(!tierPickerOpen)}
                      disabled={savingTier}
                      className="cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50"
                      title="Change relationship tier"
                    >
                      <TierBadge importance={contact.importance} />
                    </button>
                    {tierPickerOpen && (
                      <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-border bg-card p-1 shadow-lg min-w-[140px]">
                        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((tier) => {
                          const colors = getTierColors(tier);
                          const isActive = contact.importance === tier;
                          return (
                            <button
                              key={tier}
                              onClick={() => handleTierChange(tier)}
                              disabled={savingTier}
                              className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                isActive
                                  ? "bg-muted text-foreground"
                                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              }`}
                            >
                              <span className={`inline-block h-2 w-2 rounded-full ${colors.dot}`} />
                              {importanceDisplayLabel(tier)}
                              {isActive && <Check className="ml-auto h-3 w-3" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
                    className="flex items-center gap-1 rounded-md border border-transparent px-2 py-0.5 text-xs text-muted-foreground-subtle hover:border-border hover:text-foreground transition-colors"
                    onClick={() => setNudgePrefsExpanded(!nudgePrefsExpanded)}
                  >
                    {getDisabledTypes().size > 0 ? (
                      <BellOff className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Settings className="h-3.5 w-3.5" />
                    )}
                    <span>Nudge preferences</span>
                    {(contact.staleThresholdDays !== null || getDisabledTypes().size > 0) && (
                      <span className="text-muted-foreground-subtle">
                        ({[
                          contact.staleThresholdDays !== null ? `${contact.staleThresholdDays}d stale` : null,
                          getDisabledTypes().size > 0 ? `${getDisabledTypes().size} muted` : null,
                        ].filter(Boolean).join(", ")})
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  onClick={handleContact360}
                  disabled={c360Loading}
                >
                  {c360Loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Contact 360
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowDraftPanel(true);
                    if (!draftGenerated) handleGenerateEmail();
                  }}
                  disabled={generating}
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
            </div>
          </CardHeader>
        </Card>

        {nudgePrefsExpanded && (
          <div className="mt-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Stale threshold</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground-subtle shrink-0" />
                  <span className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      className="h-7 w-20 text-xs"
                      value={reconnectDaysInput}
                      onChange={(e) => setReconnectDaysInput(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground-subtle">days</span>
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
                        className="h-7 px-2 text-xs text-muted-foreground-subtle"
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
                            ? "border-border bg-muted text-muted-foreground-subtle line-through opacity-60"
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

        {/* Contact 360 Dossier */}
        {c360Loading && !c360Result && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Contact 360 intelligence...
              </div>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {c360Result && c360Expanded && (
          <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Contact 360
                  </CardTitle>
                  <CardDescription className="text-sm italic mt-1">
                    {c360Result.summary}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setC360ShareOpen(!c360ShareOpen)}
                  >
                    <Forward className="h-3.5 w-3.5" />
                    Share
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={handleC360DraftEmail}
                    disabled={generating}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Draft Email
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setC360Expanded(false)}
                    aria-label="Collapse dossier"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {c360ShareOpen && (
              <div className="mx-6 mb-3 flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Input
                  type="email"
                  placeholder="Colleague's email..."
                  className="h-8 text-sm"
                  value={c360ShareEmail}
                  onChange={(e) => setC360ShareEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleC360Share()}
                />
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs shrink-0"
                  onClick={handleC360Share}
                  disabled={c360ShareSending || !c360ShareEmail.trim()}
                >
                  {c360ShareSent ? (
                    <><Check className="h-3.5 w-3.5" /> Sent!</>
                  ) : c360ShareSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <><Send className="h-3.5 w-3.5" /> Send</>
                  )}
                </Button>
              </div>
            )}

            <CardContent className="pt-0 space-y-3">
              {c360Result.sections.map((section) => (
                <div
                  key={section.id}
                  className="rounded-lg border border-border bg-background/80"
                >
                  <button
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => toggleC360Section(section.id)}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {section.title}
                    </span>
                    {c360CollapsedSections.has(section.id) ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  {!c360CollapsedSections.has(section.id) && (
                    <div className="px-4 pb-3">
                      {section.id === "talking_points" ? (
                        <div className="space-y-2">
                          {c360Result.talkingPoints.map((tp, i) => (
                            <div
                              key={i}
                              className="flex gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 px-3 py-2"
                            >
                              <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm shrink-0">{i + 1}.</span>
                              <span className="text-sm text-foreground">{tp}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <MarkdownPreview content={section.content} />
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Follow-up question input */}
              <div className="pt-2 space-y-2">
                {c360FollowUpAnswer && (
                  <div className="rounded-lg bg-muted/50 border border-border p-3">
                    <MarkdownPreview content={c360FollowUpAnswer} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Ask a follow-up question..."
                    className="h-9 text-sm"
                    value={c360FollowUp}
                    onChange={(e) => setC360FollowUp(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleC360FollowUp()}
                    disabled={c360FollowUpLoading}
                  />
                  <Button
                    size="sm"
                    className="h-9 px-3 shrink-0"
                    onClick={handleC360FollowUp}
                    disabled={c360FollowUpLoading || !c360FollowUp.trim()}
                  >
                    {c360FollowUpLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
                  className="h-9 w-9"
                  aria-label="Close draft email"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!draftGenerated ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground-subtle">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating email draft...
                </div>
              ) : draftSendResult?.sent ? (
                <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3 text-sm text-green-700 dark:text-green-400 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    {draftSendResult.sequenceStarted
                      ? `Sent! Activate will track follow-ups and remind you if ${contact?.name.split(" ")[0]} doesn\u2019t respond.`
                      : "Sent! Marked as done."}
                  </span>
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
                    <Button onClick={handleDraftSendViaActivate} disabled={draftSending}>
                      {draftSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      {draftSending ? "Sending..." : "Send Now"}
                    </Button>
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
                          Copy
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

        {activeSequence && (
          <div
            className="rounded-lg border border-violet-200/80 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20 px-4 py-3"
            role="status"
            aria-label="Active outreach sequence"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-violet-900 dark:text-violet-200">
                  <Forward className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                  Active outreach
                </div>
                <p className="text-xs text-muted-foreground-subtle">
                  Waiting for response
                  {formatWaitingSinceLastStep(activeSequence.steps)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-violet-200 bg-background hover:bg-violet-50 dark:border-violet-800 dark:hover:bg-violet-950/40"
                  disabled={sequenceActionLoading}
                  onClick={() => void handleSequencePause()}
                >
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-700 dark:hover:bg-violet-600"
                  disabled={sequenceActionLoading}
                  onClick={() => void handleSequenceMarkResponded()}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Mark Responded
                </Button>
              </div>
            </div>
          </div>
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
                  <p className="text-sm text-muted-foreground-subtle">
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
                  <p className="text-sm text-muted-foreground-subtle">
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
                  <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground-subtle">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading firm relationships...
                  </div>
                ) : !firmRelData || firmRelData.relationships.length === 0 ? (
                  <p className="text-sm text-muted-foreground-subtle py-4 text-center">
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
                              <span className="text-xs text-muted-foreground-subtle">
                                ({rel.partnerName})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground-subtle mt-0.5">
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
                            <p className="text-sm text-muted-foreground-subtle">
                              {formatDaysAgo(rel.daysSinceLastInteraction)}
                            </p>
                            {rel.interactionCount > 0 && (
                              <p className="text-xs text-muted-foreground-subtle">
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
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Campaign Activity</CardTitle>
                    <CardDescription>
                      Activate campaigns including this contact
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {campaignRecipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground-subtle">
                    No campaign activity yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {campaignRecipients.map((row) => {
                      const dateRef =
                        row.campaign.sentAt ??
                        row.engagements[0]?.timestamp ??
                        null;
                      const sortedEngagements = [...row.engagements].sort(
                        (a, b) =>
                          new Date(b.timestamp).getTime() -
                          new Date(a.timestamp).getTime()
                      );
                      return (
                        <div
                          key={row.id}
                          className="rounded-lg border border-border p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <Link
                                href={`/campaigns/${row.campaign.id}`}
                                className="font-semibold text-foreground hover:underline"
                              >
                                {row.campaign.name}
                              </Link>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground-subtle">
                                <Badge variant="outline">
                                  {row.campaign.status}
                                </Badge>
                                {dateRef && (
                                  <span>
                                    {format(new Date(dateRef), "MMM d, yyyy")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {row.rsvpStatus && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              RSVP: {row.rsvpStatus}
                            </p>
                          )}
                          {sortedEngagements.length > 0 && (
                            <ul className="mt-3 space-y-1.5 text-sm text-foreground">
                              {sortedEngagements.map((e) => (
                                <li
                                  key={e.id}
                                  className="flex flex-wrap items-baseline gap-x-2"
                                >
                                  <span className="font-medium">
                                    {formatCampaignEngagementLabel(e.type)}
                                  </span>
                                  <span className="text-xs text-muted-foreground-subtle">
                                    {format(
                                      new Date(e.timestamp),
                                      "MMM d, yyyy h:mm a"
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

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
                            <p className="text-xs text-muted-foreground-subtle truncate leading-tight mt-0.5 md:hidden">{format(new Date(ev.eventDate), "MM/dd/yyyy")}</p>
                          </div>
                          <div className="flex-[1.2] min-w-0">
                            <Badge variant={ev.status === "Attended" ? "secondary" : "outline"}>{ev.status}</Badge>
                          </div>
                          <div className="flex-[1.2] min-w-0 text-sm text-muted-foreground-subtle hidden md:block">{format(new Date(ev.eventDate), "MM/dd/yyyy")}</div>
                          <div className="flex-[1.1] min-w-0 text-sm text-foreground hidden lg:block truncate">{ev.practice}</div>
                          <div className="flex-[1] min-w-0 text-sm text-foreground hidden xl:block truncate">{ev.type}</div>
                          <div className="flex-[0.9] min-w-0 text-sm text-foreground hidden xl:block truncate">{ev.eventSize ?? "—"}</div>
                          <div className="flex-[1.1] min-w-0 text-sm text-foreground hidden xl:block truncate">{ev.location ?? "—"}</div>
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
                            <p className="text-xs text-muted-foreground-subtle truncate leading-tight mt-0.5 md:hidden">{art.articleSent}</p>
                          </div>
                          <div className="flex-[1.6] min-w-0 text-sm text-foreground truncate">{art.articleSent}</div>
                          <div className="flex-[1.1] min-w-0 text-sm text-foreground hidden md:block tabular-nums">{art.views}</div>
                          <div className="flex-[1.2] min-w-0 text-sm text-foreground hidden lg:block truncate">{art.sentFrom ?? "—"}</div>
                          <div className="flex-[1.2] min-w-0 text-sm text-muted-foreground-subtle hidden md:block">{art.lastViewDate ? format(new Date(art.lastViewDate), "MM/dd/yyyy") : "—"}</div>
                        </div>
                      ))}
                    </div>
                    {articles.length > 10 && <p className="mt-2 px-6 text-xs text-muted-foreground-subtle">Showing 10 of {articles.length} articles</p>}
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
                          <div className="flex-[1.2] min-w-0 text-sm text-muted-foreground-subtle hidden md:block">{format(new Date(camp.statusDate), "MM/dd/yyyy")}</div>
                        </div>
                      ))}
                    </div>
                    {campaigns.length > 10 && <p className="mt-2 px-6 text-xs text-muted-foreground-subtle">Showing 10 of {campaigns.length} campaigns</p>}
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
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
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
              <span className="text-xs text-muted-foreground-subtle">
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
          <div className="text-sm text-foreground/70 leading-relaxed">
            <FragmentText fragments={fragments} />
          </div>
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
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground-subtle hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
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
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: boolean; sequenceStarted: boolean } | null>(null);

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

  async function handleSendViaActivate() {
    if (!draft) return;
    setSending(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: nudge.contact.id,
          nudgeId: nudge.id,
          subject: draft.subject,
          body: draft.body,
          nudgeReason: nudge.reason,
          ruleType: nudge.ruleType,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send");
      }
      const data = await res.json();
      setSendResult({ sent: true, sequenceStarted: data.sequenceStarted });
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  const contactFirst = nudge.contact.name.split(" ")[0];

  return (
    <div className="rounded-lg border border-primary/20 bg-card p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Email Draft
        </h4>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close email draft" className="h-9 w-9">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground-subtle">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Generating personalized draft...</span>
        </div>
      )}

      {draftError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {draftError}
        </div>
      )}

      {sendResult?.sent && (
        <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3 text-sm text-green-700 dark:text-green-400 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {sendResult.sequenceStarted
              ? `Sent! Activate will track follow-ups and remind you if ${contactFirst} doesn\u2019t respond.`
              : "Sent! Marked as done."}
          </span>
        </div>
      )}

      {draft && !loading && !sendResult && (
        <>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground-subtle">Subject</label>
              <input
                type="text"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground-subtle">Body</label>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={8}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleSendViaActivate} disabled={sending}>
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              {sending ? "Sending..." : "Send Now"}
            </Button>
            <Button variant="outline" size="sm" asChild>
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

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  RefreshCw, Send, Moon, Check, ExternalLink, Settings, Clock, Briefcase, Newspaper,
  CalendarDays, ClipboardList, Ticket, CalendarCheck, BookOpen, Linkedin,
  Copy, RotateCcw, X, Loader2, Mail, FileText, Users, Sparkles,
  Reply, Forward, Filter, Zap, CheckCircle2, ShieldCheck, ChevronRight,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { buildSummaryFragments, parseCampaignApprovalNudgeDisplay, parseArticleCampaignNudgeDisplay } from "@/lib/utils/nudge-summary";
import { FragmentText } from "@/components/ui/fragment-text";
import { StrategicInsightBlock } from "@/components/nudges/strategic-insight-block";
import { SuggestedActionButton } from "@/components/nudges/suggested-action-button";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

type Nudge = {
  id: string;
  ruleType: string;
  reason: string;
  priority: string;
  status: string;
  generatedEmail?: string | null;
  metadata?: string | null;
  sequenceId?: string | null;
  cadenceStepId?: string | null;
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

type StrategicInsightData = {
  narrative: string;
  oneLiner: string;
  suggestedAction: {
    label: string;
    context: string;
    emailAngle: string;
  };
  evidenceCitations: {
    claim: string;
    insightTypes: string[];
    signalIds: string[];
    sourceUrls: string[];
  }[];
  generatedAt: string;
};

type NudgeMetadata = {
  insights?: InsightData[];
  relatedPartners?: { partnerId: string; partnerName: string }[];
  personName?: string;
  strategicInsight?: StrategicInsightData;
};

function parseMetadata(metadata?: string | null): NudgeMetadata | null {
  if (!metadata) return null;
  try { return JSON.parse(metadata); } catch { return null; }
}

type DraftEmail = { subject: string; body: string };

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "SNOOZED", label: "Snoozed" },
  { value: "DONE", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function getPriorityClassName(priority: string): string {
  switch (priority) {
    case "URGENT": return "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400";
    case "HIGH": return "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400";
    case "MEDIUM": return "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400";
    default: return "border-border bg-muted/50 text-muted-foreground-subtle";
  }
}

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
  FOLLOW_UP: { icon: Forward, label: "Active Outreach", ctaLabel: "Continue Follow-up", ctaIcon: Forward, color: "text-violet-600", bgColor: "bg-violet-50 dark:bg-violet-950/30" },
  REPLY_NEEDED: { icon: Reply, label: "Reply Needed", ctaLabel: "Draft Reply", ctaIcon: Reply, color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950/30" },
  CAMPAIGN_APPROVAL: { icon: ShieldCheck, label: "Campaign Approval", ctaLabel: "Review Campaign", ctaIcon: ShieldCheck, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/30" },
  ARTICLE_CAMPAIGN: { icon: BookOpen, label: "Article Campaign", ctaLabel: "View Campaign", ctaIcon: BookOpen, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
};

const DEFAULT_TYPE_CONFIG: NudgeTypeConfig = {
  icon: Send, label: "Nudge", ctaLabel: "Reach Out", ctaIcon: Send, color: "text-muted-foreground-subtle", bgColor: "bg-muted/50",
};

function getTypeConfig(ruleType: string): NudgeTypeConfig {
  return NUDGE_TYPE_CONFIG[ruleType] ?? DEFAULT_TYPE_CONFIG;
}

function NudgeSummary({ nudge, insights }: { nudge: Nudge; insights: InsightData[] }) {
  const fragments = buildSummaryFragments(nudge, insights);
  return <FragmentText fragments={fragments} />;
}

function DraftEmailPanel({
  nudge, onClose, onNudgeSent,
}: { nudge: Nudge; onClose: () => void; onNudgeSent?: () => void }) {
  const [draft, setDraft] = useState<DraftEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: boolean; sequenceStarted: boolean } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchDraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/nudges/${nudge.id}/draft-email`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate draft");
      const data = await res.json();
      setDraft(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [nudge.id]);

  useEffect(() => { fetchDraft(); }, [fetchDraft]);

  async function handleCopy() {
    if (!draft) return;
    const text = `Subject: ${draft.subject}\n\n${draft.body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSendViaClientIQ() {
    if (!draft) return;
    setSending(true);
    setError(null);
    try {
      const meta = parseMetadata(nudge.metadata);
      const insights = meta?.insights ?? [];
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: nudge.contact.id,
          nudgeId: nudge.id,
          subject: draft.subject,
          body: draft.body,
          nudgeReason: nudge.reason,
          ruleType: insights[0]?.type ?? nudge.ruleType,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send");
      }
      const data = await res.json();
      setSendResult({ sent: true, sequenceStarted: data.sequenceStarted });
      onNudgeSent?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  const contactFirst = nudge.contact.name.split(" ")[0];

  return (
    <div ref={panelRef} className="mt-4 rounded-lg border border-primary/20 bg-card p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
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

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {sendResult?.sent && (
        <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3 text-sm text-green-700 dark:text-green-400 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {sendResult.sequenceStarted
              ? `Sent! ClientIQ will track follow-ups and remind you if ${contactFirst} doesn\u2019t respond.`
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
            <Button size="sm" onClick={handleSendViaClientIQ} disabled={sending}>
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
            <Button variant="outline" size="sm" onClick={fetchDraft} disabled={loading}>
              <RotateCcw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function PartnerRelationsPanel({ metadata }: { metadata: NudgeMetadata }) {
  if (!metadata.relatedPartners || metadata.relatedPartners.length === 0) return null;
  return (
    <div className="rounded-md border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
          McK Partners who know {metadata.personName ?? "this person"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {metadata.relatedPartners.map((p) => (
          <span
            key={p.partnerId}
            className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 dark:bg-purple-900/40 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-300"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-200 dark:bg-purple-800 text-[10px] font-bold text-purple-700 dark:text-purple-300">
              {p.partnerName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
            </span>
            {p.partnerName}
          </span>
        ))}
      </div>
    </div>
  );
}

type MeetingBriefData = {
  meetingTitle: string;
  meetingTime: string | null;
  attendeeCount: number;
  brief: string;
};

function MeetingBriefPanel({
  nudge, onClose,
}: { nudge: Nudge; onClose: () => void }) {
  const [data, setData] = useState<MeetingBriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchBrief = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const qs = force ? "?force=true" : "";
      const res = await fetch(`/api/nudges/${nudge.id}/meeting-brief${qs}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate brief");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [nudge.id]);

  useEffect(() => { fetchBrief(); }, [fetchBrief]);

  async function handleCopy() {
    if (!data) return;
    await navigator.clipboard.writeText(data.brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-card p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-indigo-600" />
          Meeting Brief
        </h4>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close meeting brief" className="h-9 w-9">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground-subtle">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Generating meeting brief...</span>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground-subtle">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 font-medium text-indigo-600 dark:text-indigo-400">
              <CalendarDays className="h-3 w-3" />
              {data.meetingTitle}
            </span>
            {data.meetingTime && (
              <span>{new Date(data.meetingTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            )}
            <span>{data.attendeeCount} attendee{data.attendeeCount !== 1 ? "s" : ""}</span>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border border-border bg-muted/30 p-4 overflow-auto max-h-[500px]">
            {data.brief.split("\n").map((line, i) => {
              if (line.startsWith("# ")) return <h2 key={i} className="text-base font-bold mt-0 mb-2">{line.slice(2)}</h2>;
              if (line.startsWith("## ")) return <h3 key={i} className="text-sm font-semibold mt-4 mb-1 text-indigo-700 dark:text-indigo-400">{line.slice(3)}</h3>;
              if (line.startsWith("### ")) return <h4 key={i} className="text-sm font-medium mt-3 mb-1">{line.slice(4)}</h4>;
              if (line.startsWith("- [ ] ")) return <label key={i} className="flex items-start gap-2 text-sm my-1"><input type="checkbox" className="mt-0.5 rounded" /><span>{line.slice(6)}</span></label>;
              if (line.startsWith("- ")) return <p key={i} className="text-sm my-0.5 pl-4 before:content-['•'] before:mr-2 before:text-muted-foreground-subtle">{line.slice(2)}</p>;
              if (/^\d+\.\s/.test(line)) return <p key={i} className="text-sm my-0.5 pl-4">{line}</p>;
              if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-sm font-semibold mt-2 mb-0.5">{line.replace(/\*\*/g, "")}</p>;
              if (line.trim() === "") return <div key={i} className="h-2" />;
              return <p key={i} className="text-sm my-0.5 leading-relaxed">{line}</p>;
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Brief"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchBrief(true)} disabled={loading}>
              <RotateCcw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function NudgeCard({
  nudge,
  onUpdateStatus,
  onRefresh,
}: {
  nudge: Nudge;
  onUpdateStatus: (id: string, status: string) => void;
  onRefresh?: () => void;
}) {
  const [openPanel, setOpenPanel] = useState<"brief" | "email" | null>(null);
  const meta = parseMetadata(nudge.metadata);
  const insights = meta?.insights ?? [];
  const cfg = getTypeConfig(nudge.ruleType);
  const CtaIcon = cfg.ctaIcon;
  const hasMeetingPrep = insights.some((i) => i.type === "MEETING_PREP");
  const isFollowUp = nudge.ruleType === "FOLLOW_UP";
  const isReplyNeeded = nudge.ruleType === "REPLY_NEEDED";
  const isSequenceNudge = isFollowUp || isReplyNeeded;
  const isCampaignApproval = nudge.ruleType === "CAMPAIGN_APPROVAL";
  const isArticleCampaign = nudge.ruleType === "ARTICLE_CAMPAIGN";

  const waitingMatch = nudge.reason.match(/no response in (\d+) day/);
  const waitingDays = waitingMatch ? parseInt(waitingMatch[1]) : null;

  if (isArticleCampaign) {
    const art = parseArticleCampaignNudgeDisplay(nudge);
    const fragments = buildSummaryFragments(nudge, insights);
    return (
      <Card className="overflow-hidden border-l-4 border-l-blue-400 dark:border-l-blue-600">
        <CardHeader className="pb-3 pt-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-200/70 dark:ring-blue-800/50">
              <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg font-bold">
                  <Link href={art.campaignHref} className="hover:text-primary hover:underline transition-colors">
                    {art.articleTitle}
                  </Link>
                </CardTitle>
                <Badge variant="outline" className={getPriorityClassName(nudge.priority)}>
                  {nudge.priority}
                </Badge>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
                  <BookOpen className="h-3 w-3 mr-1" />
                  Article Campaign
                </Badge>
              </div>
              <CardDescription className="mt-0.5 text-muted-foreground">
                {art.matchCount} contact{art.matchCount !== 1 ? "s" : ""} matched for outreach
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Insights</span>
            </div>
            <div className="text-sm text-foreground/70 leading-relaxed">
              <FragmentText fragments={fragments} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" asChild>
              <Link href={art.campaignHref}>
                <BookOpen className="h-4 w-4" />
                View Campaign
                <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
              </Link>
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
        </CardContent>
      </Card>
    );
  }

  if (isCampaignApproval) {
    const camp = parseCampaignApprovalNudgeDisplay(nudge);
    return (
      <Card className="overflow-hidden border-l-4 border-l-amber-400 dark:border-l-amber-600">
        <CardHeader className="pb-3 pt-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-200/70 dark:ring-amber-800/50">
              <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg font-bold">
                  <Link href={camp.campaignHref} className="hover:text-primary hover:underline transition-colors">
                    {camp.campaignName}
                  </Link>
                </CardTitle>
                <Badge variant="outline" className={getPriorityClassName(nudge.priority)}>
                  {nudge.priority}
                </Badge>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Campaign Approval
                </Badge>
              </div>
              <CardDescription className="mt-0.5 text-muted-foreground">
                Campaign-level action — review pending recipients before send
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-200/90 bg-amber-50/70 px-4 py-3.5 dark:border-amber-900/60 dark:bg-amber-950/25 space-y-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                {camp.pendingCount} contact{camp.pendingCount !== 1 ? "s" : ""} pending your review
              </span>
            </p>
            {camp.deadlineLabel && (
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                {camp.deadlineLabel}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/30 px-5 py-4">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Insights</span>
            </div>
            <div className="text-sm text-foreground/70 leading-relaxed">
              <NudgeSummary nudge={nudge} insights={insights} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" asChild>
              <Link href={camp.campaignHref}>
                <CtaIcon className="h-4 w-4" />
                {cfg.ctaLabel}
              </Link>
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
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${isSequenceNudge ? "border-l-4 border-l-violet-400 dark:border-l-violet-600" : ""}`}>
      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start gap-4">
          <Avatar name={nudge.contact.name} size="lg" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg font-bold">
                <Link href={`/contacts/${nudge.contact.id}`} className="hover:text-primary hover:underline transition-colors">
                  {nudge.contact.name}
                </Link>
              </CardTitle>
              <Badge variant="outline" className={getPriorityClassName(nudge.priority)}>
                {nudge.priority}
              </Badge>
              {isFollowUp && (
                <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-400">
                  <Forward className="h-3 w-3 mr-1" />
                  Active Outreach
                </Badge>
              )}
              {isReplyNeeded && (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                  <Reply className="h-3 w-3 mr-1" />
                  Reply Needed
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5">
              {nudge.contact.title} at {nudge.contact.company.name}
            </CardDescription>
            {isFollowUp && waitingDays !== null && (
              <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                Active outreach — waiting for response ({waitingDays} day{waitingDays !== 1 ? "s" : ""})
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/30 px-5 py-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Insights</span>
          </div>
          <div className="text-sm text-foreground/70 leading-relaxed">
            <StrategicInsightBlock
              strategicInsight={meta?.strategicInsight}
              insights={insights}
              nudge={nudge}
            />
          </div>
        </div>

        {!meta?.strategicInsight && insights.length > 0 && (() => {
          const seen = new Map<string, string | null>();
          for (const ins of insights) {
            if (ins.type === "STALE_CONTACT") continue;
            if (ins.type === "FOLLOW_UP" || ins.type === "REPLY_NEEDED") continue;
            if (!seen.has(ins.type)) {
              seen.set(ins.type, ins.signalUrl ?? null);
            } else if (!seen.get(ins.type) && ins.signalUrl) {
              seen.set(ins.type, ins.signalUrl);
            }
          }
          return (
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
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground-subtle hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()} aria-label={`Open ${iCfg.label} source (opens in new tab)`}>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </span>
                );
              })}
            </div>
          );
        })()}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {hasMeetingPrep && (
            <Button size="sm" onClick={() => setOpenPanel(openPanel === "brief" ? null : "brief")}>
              <FileText className="h-4 w-4" />
              Generate Brief
            </Button>
          )}
          <Button size="sm" variant={hasMeetingPrep ? "outline" : "default"} asChild>
            <Link href={(() => {
              if (isSequenceNudge) {
                const action = isReplyNeeded
                  ? `Draft a reply to ${nudge.contact.name}`
                  : `Draft a follow-up email to ${nudge.contact.name}`;
                const sp = new URLSearchParams({ q: action });
                sp.set("nudgeId", nudge.id);
                sp.set("contactId", nudge.contact.id);
                return `/chat?${sp.toString()}`;
              }
              const actionLabel = meta?.strategicInsight?.suggestedAction?.label;
              const q = actionLabel
                ? `${actionLabel} for ${nudge.contact.name}`
                : `Nudge summary for ${nudge.contact.name}`;
              const sp = new URLSearchParams({ q });
              sp.set("nudgeId", nudge.id);
              sp.set("contactId", nudge.contact.id);
              return `/chat?${sp.toString()}`;
            })()}>
              <CtaIcon className="h-4 w-4" />
              {isSequenceNudge
                ? cfg.ctaLabel
                : (meta?.strategicInsight?.suggestedAction?.label
                    ? (meta.strategicInsight.suggestedAction.label.length > 50
                        ? meta.strategicInsight.suggestedAction.label.slice(0, 48) + "\u2026"
                        : meta.strategicInsight.suggestedAction.label)
                    : (hasMeetingPrep ? "Draft Email" : cfg.ctaLabel))}
              <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </Link>
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

        {openPanel === "brief" && (
          <MeetingBriefPanel nudge={nudge} onClose={() => setOpenPanel(null)} />
        )}
      </CardContent>
    </Card>
  );
}


export default function NudgesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [followUpsOnly, setFollowUpsOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backfillTriggeredRef = useRef(false);

  const fetchNudges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const res = await fetch(`/api/nudges?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch nudges");
      const data = await res.json();
      setNudges(data);
      return data as Nudge[];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return [] as Nudge[];
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchNudges().then((loaded) => {
      if (backfillTriggeredRef.current) return;
      const ELIGIBLE = new Set([
        "STALE_CONTACT", "JOB_CHANGE", "COMPANY_NEWS", "LINKEDIN_ACTIVITY",
        "UPCOMING_EVENT", "EVENT_ATTENDED", "EVENT_REGISTERED", "ARTICLE_READ", "MEETING_PREP",
      ]);
      const needsBackfill = loaded.some((n: Nudge) => {
        if (!ELIGIBLE.has(n.ruleType)) return false;
        try {
          const meta = JSON.parse(n.metadata ?? "{}");
          return !meta.strategicInsight;
        } catch { return true; }
      });
      if (needsBackfill) {
        backfillTriggeredRef.current = true;
        setBackfilling(true);
        fetch("/api/nudges/backfill-insights", { method: "POST" })
          .then(() => fetchNudges())
          .catch(() => {})
          .finally(() => setBackfilling(false));
      }
    });
  }, [fetchNudges]);

  async function handleRefreshNudges() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/nudges/refresh", { method: "POST" });
      if (!res.ok) throw new Error("Failed to refresh nudges");
      await fetchNudges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleBackfillInsights() {
    setBackfilling(true);
    try {
      const res = await fetch("/api/nudges/backfill-insights", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate insights");
      await fetchNudges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBackfilling(false);
    }
  }

  async function handleUpdateStatus(nudgeId: string, status: string) {
    try {
      const res = await fetch(`/api/nudges/${nudgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      // 404 = nudge already gone (e.g. deleted by refresh) — refetch to sync, no error
      if (res.status === 404) {
        await fetchNudges();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to update nudge");
      }
      await fetchNudges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const followUpCount = nudges.filter(
    (n) => n.ruleType === "FOLLOW_UP" || n.ruleType === "REPLY_NEEDED"
  ).length;

  let filteredNudges = typeFilter
    ? nudges.filter((n) => {
        if (n.ruleType === typeFilter) return true;
        const meta = parseMetadata(n.metadata);
        return meta?.insights?.some((i) => i.type === typeFilter) ?? false;
      })
    : nudges;

  if (followUpsOnly) {
    filteredNudges = filteredNudges.filter(
      (n) => n.ruleType === "FOLLOW_UP" || n.ruleType === "REPLY_NEEDED"
    );
  }

  const sortedNudges = [...filteredNudges].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );

  const typeCounts = nudges.reduce<Record<string, number>>((acc, n) => {
    const meta = parseMetadata(n.metadata);
    const types = meta?.insights?.map((i) => i.type) ?? [n.ruleType];
    for (const t of new Set(types)) {
      acc[t] = (acc[t] ?? 0) + 1;
    }
    return acc;
  }, {});

  if (loading && nudges.length === 0) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-12 w-full" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Nudges</h1>
            <p className="mt-1 text-muted-foreground">Action items and reminders for your contacts</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/nudges/settings">
              <Settings className="h-4 w-4" />
              Nudge Preferences
            </Link>
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">{error}</div>
        )}

        {/* Filter bar */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <Button key={opt.value} variant={statusFilter === opt.value ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(opt.value)}>
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-3.5 w-3.5" />
              Filters
              {(priorityFilter || typeFilter || followUpsOnly) && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {(priorityFilter ? 1 : 0) + (typeFilter ? 1 : 0) + (followUpsOnly ? 1 : 0)}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
              {/* Priority */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground-subtle w-20 shrink-0">Priority:</span>
                {PRIORITY_OPTIONS.map((opt) => (
                  <Button key={opt.value} variant={priorityFilter === opt.value ? "default" : "outline"} size="sm" onClick={() => setPriorityFilter(opt.value)}>
                    {opt.label}
                  </Button>
                ))}
              </div>

              {/* Type */}
              {Object.keys(typeCounts).length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground-subtle w-20 shrink-0">Type:</span>
                  <Button variant={typeFilter === "" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("")}>
                    All ({nudges.length})
                  </Button>
                  {Object.entries(typeCounts)
                    .filter(([type]) => type !== "FOLLOW_UP" && type !== "REPLY_NEEDED")
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => {
                      const cfg = getTypeConfig(type);
                      const Icon = cfg.icon;
                      return (
                        <Button key={type} variant={typeFilter === type ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(type)}>
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label} ({count})
                        </Button>
                      );
                    })}
                </div>
              )}

              {/* Follow-ups */}
              {followUpCount > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground-subtle w-20 shrink-0">Outreach:</span>
                  <Button
                    variant={followUpsOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFollowUpsOnly(!followUpsOnly)}
                    className={followUpsOnly ? "bg-violet-600 hover:bg-violet-700 text-white" : ""}
                  >
                    <Forward className="h-3.5 w-3.5" />
                    Follow-ups Only ({followUpCount})
                  </Button>
                </div>
              )}

              <div className="border-t border-border pt-3 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={handleRefreshNudges} disabled={refreshing || backfilling} className="text-muted-foreground-subtle">
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing..." : "Refresh nudges now"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleBackfillInsights} disabled={backfilling || refreshing} className="text-muted-foreground-subtle">
                  <Sparkles className={`h-3.5 w-3.5 ${backfilling ? "animate-pulse" : ""}`} />
                  {backfilling ? "Generating insights..." : "Generate AI insights"}
                </Button>
              </div>
            </div>
          )}

          {/* Active filter chips */}
          {(priorityFilter || typeFilter || followUpsOnly) && (
            <div className="flex flex-wrap items-center gap-2">
              {priorityFilter && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Priority: {PRIORITY_OPTIONS.find((o) => o.value === priorityFilter)?.label}
                  <button onClick={() => setPriorityFilter("")} className="ml-0.5 rounded-full p-0.5 hover:bg-primary/10">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {typeFilter && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Type: {getTypeConfig(typeFilter).label}
                  <button onClick={() => setTypeFilter("")} className="ml-0.5 rounded-full p-0.5 hover:bg-primary/10">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {followUpsOnly && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Follow-ups Only
                  <button onClick={() => setFollowUpsOnly(false)} className="ml-0.5 rounded-full p-0.5 hover:bg-primary/10">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                onClick={() => { setPriorityFilter(""); setTypeFilter(""); setFollowUpsOnly(false); }}
                className="text-xs text-muted-foreground-subtle hover:text-foreground underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {backfilling && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-primary">
            <Sparkles className="h-4 w-4 animate-pulse" />
            Generating AI insights for your nudges&hellip; Cards will update automatically.
          </div>
        )}

        {/* Nudge list */}
        <div className="space-y-4">
          {sortedNudges.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground-subtle">
                No nudges found. Try adjusting your filters or refresh to generate new nudges.
              </CardContent>
            </Card>
          ) : (
            sortedNudges.map((nudge) => (
              <NudgeCard key={nudge.id} nudge={nudge} onUpdateStatus={handleUpdateStatus} onRefresh={fetchNudges} />
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

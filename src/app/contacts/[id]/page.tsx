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
  Settings,
  BellOff,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("");
  const [savingThreshold, setSavingThreshold] = useState(false);

  const [firmRelData, setFirmRelData] = useState<FirmRelationshipData | null>(null);
  const [firmRelLoading, setFirmRelLoading] = useState(false);
  const [firmRelFetched, setFirmRelFetched] = useState(false);

  const [showNudgePrefs, setShowNudgePrefs] = useState(false);
  const [savingNudgePrefs, setSavingNudgePrefs] = useState(false);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

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
      setEditingThreshold(false);
    } catch {
      setError("Failed to save staleness threshold");
    } finally {
      setSavingThreshold(false);
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
    setSavingNudgePrefs(true);
    const disabled = getDisabledTypes();
    if (disabled.has(typeKey)) {
      disabled.delete(typeKey);
    } else {
      disabled.add(typeKey);
    }
    const newDisabled = Array.from(disabled);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledNudgeTypes: newDisabled.length > 0 ? newDisabled : null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setContact((prev) => prev ? { ...prev, disabledNudgeTypes: updated.disabledNudgeTypes } : prev);
      }
    } catch {
      // silently fail
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
                  {contact.title} at {contact.company.name}
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
                {/* Nudge preferences — stale threshold + type toggles */}
                <div className="mt-2">
                  <button
                    className="flex items-center gap-1 rounded-md border border-transparent px-2 py-0.5 text-xs text-muted-foreground hover:border-border hover:text-foreground transition-colors"
                    onClick={() => setShowNudgePrefs(!showNudgePrefs)}
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
                  {showNudgePrefs && (
                    <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                      {/* Stale threshold */}
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1.5">Stale threshold</p>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {editingThreshold ? (
                            <span className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={1}
                                max={365}
                                className="h-7 w-20 text-xs"
                                value={thresholdInput}
                                onChange={(e) => setThresholdInput(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const val = parseInt(thresholdInput, 10);
                                    if (!isNaN(val) && val >= 1 && val <= 365) handleSaveThreshold(val);
                                  }
                                  if (e.key === "Escape") setEditingThreshold(false);
                                }}
                              />
                              <span className="text-xs text-muted-foreground">days</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={savingThreshold}
                                onClick={() => {
                                  const val = parseInt(thresholdInput, 10);
                                  if (!isNaN(val) && val >= 1 && val <= 365) handleSaveThreshold(val);
                                }}
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
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-1"
                                onClick={() => setEditingThreshold(false)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </span>
                          ) : (
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => {
                                setThresholdInput(contact.staleThresholdDays?.toString() ?? "");
                                setEditingThreshold(true);
                              }}
                            >
                              {contact.staleThresholdDays !== null
                                ? `${contact.staleThresholdDays} days (custom)`
                                : "Using tier default — click to customize"}
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Type toggles */}
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
                  )}
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

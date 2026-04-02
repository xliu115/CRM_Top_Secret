"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Minus,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

const HEADER_CLASS =
  "text-3xl font-bold tracking-tight text-foreground";

type EngagementRow = { type: string };

type CampaignDetailJson = {
  id: string;
  name: string;
  status: string;
  source: string;
  sentAt: string | null;
  importedFrom: string | null;
  contents: Array<{
    contentItem: {
      id: string;
      type: string;
      title: string;
      description: string | null;
    };
  }>;
  recipients: Array<{
    id: string;
    status: string;
    rsvpStatus: string | null;
    contact: {
      id: string;
      name: string;
      email: string;
      company: { name: string };
    } | null;
    unmatchedEmail: string | null;
    engagements: EngagementRow[];
  }>;
};

type FollowUpDraft = {
  recipientId: string;
  contactName: string;
  subject: string;
  body: string;
};

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
    case "SENT":
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
    case "SENDING":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "FAILED":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SENT":
      return "Sent";
    case "SENDING":
      return "Sending";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

function recipientStatusBadgeClass(status: string) {
  switch (status) {
    case "SENT":
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
    case "PENDING":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    case "FAILED":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function recipientStatusLabel(status: string) {
  switch (status) {
    case "SENT":
      return "Sent";
    case "PENDING":
      return "Pending";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

function hasEngagement(r: CampaignDetailJson["recipients"][0], type: string) {
  return r.engagements.some((e) => e.type === type);
}

function rsvpDisplay(
  isEvent: boolean,
  rsvp: string | null
): { label: string; className: string } {
  if (!isEvent) {
    return { label: "—", className: "text-muted-foreground-subtle" };
  }
  switch (rsvp) {
    case "ACCEPTED":
      return {
        label: "Accepted",
        className: "text-green-700 dark:text-green-400 font-medium",
      };
    case "DECLINED":
      return {
        label: "Declined",
        className: "text-red-700 dark:text-red-400 font-medium",
      };
    case "PENDING":
      return {
        label: "Pending",
        className: "text-amber-700 dark:text-amber-400 font-medium",
      };
    default:
      return { label: "—", className: "text-muted-foreground-subtle" };
  }
}

function computeStats(campaign: CampaignDetailJson | null) {
  if (!campaign) {
    return {
      total: 0,
      openRate: 0,
      clickRate: 0,
      rsvpAccepted: 0,
      rsvpDeclined: 0,
      rsvpPending: 0,
    };
  }
  const n = campaign.recipients.length;
  let opens = 0;
  let clicks = 0;
  let rsvpAccepted = 0;
  let rsvpDeclined = 0;
  let rsvpPending = 0;
  for (const r of campaign.recipients) {
    if (hasEngagement(r, "OPENED")) opens++;
    if (hasEngagement(r, "CLICKED")) clicks++;
    if (r.rsvpStatus === "ACCEPTED") rsvpAccepted++;
    else if (r.rsvpStatus === "DECLINED") rsvpDeclined++;
    else if (r.rsvpStatus === "PENDING") rsvpPending++;
  }
  return {
    total: n,
    openRate: n > 0 ? opens / n : 0,
    clickRate: n > 0 ? clicks / n : 0,
    rsvpAccepted,
    rsvpDeclined,
    rsvpPending,
  };
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <DashboardShell>
      <CampaignDetailBody id={id} />
    </DashboardShell>
  );
}

function CampaignDetailBody({ id }: { id: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDetailJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<FollowUpDraft[] | null>(null);
  const [openDraftId, setOpenDraftId] = useState<string | null>(null);

  const fetchCampaign = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        setCampaign(null);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoadError(
          typeof err.error === "string" ? err.error : "Failed to load campaign."
        );
        setCampaign(null);
        return;
      }
      setCampaign(await res.json());
    } catch {
      setLoadError("Failed to load campaign.");
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const isEventCampaign = useMemo(
    () =>
      campaign?.contents.some((c) => c.contentItem.type === "EVENT") ?? false,
    [campaign]
  );

  const stats = useMemo(() => computeStats(campaign), [campaign]);

  const sentRecipientIds = useMemo(() => {
    if (!campaign) return [];
    return campaign.recipients
      .filter((r) => r.status === "SENT")
      .map((r) => r.id);
  }, [campaign]);

  const allSentSelected =
    sentRecipientIds.length > 0 &&
    sentRecipientIds.every((rid) => selectedIds.has(rid));

  const someSentSelected =
    sentRecipientIds.some((rid) => selectedIds.has(rid)) && !allSentSelected;

  const selectedForFollowUp = useMemo(
    () =>
      Array.from(selectedIds).filter((rid) =>
        sentRecipientIds.includes(rid)
      ),
    [selectedIds, sentRecipientIds]
  );

  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) el.indeterminate = someSentSelected;
  }, [someSentSelected]);

  function toggleRecipient(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllSent() {
    if (!campaign) return;
    if (allSentSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(sentRecipientIds));
  }

  async function handleSendCampaign() {
    setSendLoading(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSendError(
          typeof err.error === "string" ? err.error : "Send failed."
        );
        return;
      }
      await fetchCampaign();
      router.refresh();
    } finally {
      setSendLoading(false);
    }
  }

  async function handleGenerateFollowUps() {
    const ids = selectedForFollowUp;
    if (ids.length === 0) return;
    setFollowUpLoading(true);
    setFollowUpError(null);
    setDrafts(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientIds: ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFollowUpError(
          typeof err.error === "string" ? err.error : "Follow-up failed."
        );
        return;
      }
      const data = (await res.json()) as { drafts: FollowUpDraft[] };
      setDrafts(data.drafts);
      if (data.drafts.length > 0) {
        setOpenDraftId(data.drafts[0].recipientId);
      }
    } finally {
      setFollowUpLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 pb-10">
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => fetchCampaign()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 pb-10">
        <div className="rounded-xl border border-border bg-white py-16 px-6 text-center shadow-sm dark:bg-card">
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Campaign not found
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            This campaign does not exist or you do not have access.
          </p>
          <Button
            asChild
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/campaigns">Back to campaigns</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isDraft = campaign.status === "DRAFT";

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <div>
        <Link
          href="/campaigns"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Campaigns
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={cn(HEADER_CLASS, "break-words")}>{campaign.name}</h1>
              <Badge
                variant="secondary"
                className={cn("shrink-0 border-0", statusBadgeClass(campaign.status))}
              >
                {statusLabel(campaign.status)}
              </Badge>
              {campaign.source === "IMPORTED" && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-200 bg-amber-50 text-amber-900 text-[10px] dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  Imported
                  {campaign.importedFrom ? ` · ${campaign.importedFrom}` : ""}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {campaign.sentAt
                ? `Sent ${format(new Date(campaign.sentAt), "MMM d, yyyy · h:mm a")}`
                : "Not sent yet"}
            </p>
          </div>
          {isDraft && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                asChild
                variant="outline"
                className="border-primary/40 text-foreground hover:bg-primary/10"
              >
                <Link href={`/campaigns/new?edit=${encodeURIComponent(campaign.id)}`}>
                  Edit
                </Link>
              </Button>
              <Button
                type="button"
                onClick={handleSendCampaign}
                disabled={sendLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {sendLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        {sendError && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {sendError}
          </p>
        )}
      </div>

      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
          !isEventCampaign && "lg:max-w-4xl"
        )}
      >
        <MetricCard
          label="Total Recipients"
          value={String(stats.total)}
          large
        />
        <MetricCard label="Open Rate" value={pct(stats.openRate)} large />
        <MetricCard label="Click Rate" value={pct(stats.clickRate)} large />
        {isEventCampaign && (
          <>
            <MetricCard label="RSVP Accepted" value={String(stats.rsvpAccepted)} />
            <MetricCard label="RSVP Declined" value={String(stats.rsvpDeclined)} />
            <MetricCard label="RSVP Pending" value={String(stats.rsvpPending)} />
          </>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Content
        </h2>
        {campaign.contents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No content attached.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {campaign.contents.map((row) => {
              const item = row.contentItem;
              const isEvent = item.type === "EVENT";
              return (
                <div
                  key={row.contentItem.id}
                  className="rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-card"
                >
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    {isEvent ? (
                      <Calendar className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    )}
                    <h3 className="text-base font-semibold text-foreground flex-1 min-w-0">
                      {item.title}
                    </h3>
                    <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
                      {isEvent ? "Event" : "Article"}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-4">
                      {item.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Recipients
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={handleGenerateFollowUps}
              disabled={
                followUpLoading ||
                selectedForFollowUp.length === 0
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {followUpLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating…
                </>
              ) : (
                "Generate Follow-ups"
              )}
            </Button>
          </div>
        </div>
        {followUpError && (
          <p className="text-sm text-destructive" role="alert">
            {followUpError}
          </p>
        )}
        <div className="overflow-x-auto -mx-1 px-1 rounded-xl border border-border bg-white shadow-sm dark:bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle">
                <th className="py-3 pl-4 pr-2 w-10">
                  {sentRecipientIds.length > 0 ? (
                    <input
                      type="checkbox"
                      checked={allSentSelected}
                      ref={headerCheckboxRef}
                      onChange={toggleSelectAllSent}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                      aria-label="Select all sent recipients"
                    />
                  ) : null}
                </th>
                <th className="py-3 pr-3">Contact</th>
                <th className="py-3 pr-3">Company</th>
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 pr-3">Opened</th>
                <th className="py-3 pr-3">Clicked</th>
                {isEventCampaign && (
                  <th className="py-3 pr-3">RSVP</th>
                )}
                <th className="py-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaign.recipients.map((r) => {
                const name =
                  r.contact?.name ?? r.unmatchedEmail ?? "—";
                const company = r.contact?.company?.name ?? "—";
                const opened = hasEngagement(r, "OPENED");
                const clicked = hasEngagement(r, "CLICKED");
                const rsvp = rsvpDisplay(isEventCampaign, r.rsvpStatus);
                const canFollowUp = r.status === "SENT";
                const checked = selectedIds.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 pl-4 pr-2 align-middle">
                      {canFollowUp ? (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRecipient(r.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                          aria-label={`Select ${name}`}
                        />
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                    </td>
                    <td className="py-3 pr-3 font-medium text-foreground align-middle">
                      {name}
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground align-middle">
                      {company}
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "border-0 text-[10px]",
                          recipientStatusBadgeClass(r.status)
                        )}
                      >
                        {recipientStatusLabel(r.status)}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      {opened ? (
                        <Check
                          className="h-4 w-4 text-green-600 dark:text-green-400"
                          aria-label="Opened"
                        />
                      ) : (
                        <Minus
                          className="h-4 w-4 text-muted-foreground/40"
                          aria-label="Not opened"
                        />
                      )}
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      {clicked ? (
                        <Check
                          className="h-4 w-4 text-green-600 dark:text-green-400"
                          aria-label="Clicked"
                        />
                      ) : (
                        <Minus
                          className="h-4 w-4 text-muted-foreground/40"
                          aria-label="Not clicked"
                        />
                      )}
                    </td>
                    {isEventCampaign && (
                      <td className={cn("py-3 pr-3 align-middle", rsvp.className)}>
                        {rsvp.label}
                      </td>
                    )}
                    <td className="py-3 pr-4 text-right align-middle">
                      {canFollowUp ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => {
                            setSelectedIds(new Set([r.id]));
                          }}
                        >
                          Follow-up
                        </Button>
                      ) : (
                        <span className="text-muted-foreground-subtle">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {(followUpLoading || (drafts && drafts.length > 0)) && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Follow-up drafts
          </h2>
          {followUpLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground dark:bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Generating follow-up messages…
            </div>
          )}
          {!followUpLoading && drafts && drafts.length > 0 && (
            <div className="space-y-2">
              {drafts.map((d) => {
                const open = openDraftId === d.recipientId;
                const recipient = campaign.recipients.find(
                  (x) => x.id === d.recipientId
                );
                const email = recipient?.contact?.email ?? null;
                const contactId = recipient?.contact?.id;
                const mailto =
                  email &&
                  `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
                return (
                  <div
                    key={d.recipientId}
                    className="rounded-xl border border-border bg-white overflow-hidden shadow-sm dark:bg-card"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 bg-muted/20 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40 transition-colors"
                      onClick={() =>
                        setOpenDraftId(open ? null : d.recipientId)
                      }
                      aria-expanded={open}
                    >
                      <span className="min-w-0">
                        <span className="text-foreground">{d.contactName}</span>
                        <span className="text-muted-foreground-subtle font-normal block sm:inline">
                          <span className="hidden sm:inline"> — </span>
                          {d.subject || "(no subject)"}
                        </span>
                      </span>
                      {open ? (
                        <ChevronUp className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                    {open && (
                      <div className="border-t border-border px-4 py-3 space-y-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle mb-1">
                            Subject
                          </p>
                          <p className="text-sm text-foreground">{d.subject}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle mb-1">
                            Body
                          </p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {d.body}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {mailto ? (
                            <Button
                              asChild
                              size="sm"
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              <a href={mailto}>Send</a>
                            </Button>
                          ) : contactId ? (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="border-primary/40"
                            >
                              <Link href={`/contacts/${contactId}`}>
                                Open contact
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No email on file
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  large,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm dark:bg-card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle mb-1">
        {label}
      </p>
      <p
        className={cn(
          "font-bold tabular-nums text-foreground",
          large ? "text-3xl" : "text-2xl"
        )}
      >
        {value}
      </p>
    </div>
  );
}

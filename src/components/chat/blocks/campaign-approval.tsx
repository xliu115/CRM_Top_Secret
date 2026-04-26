"use client";

import { useMemo, useState } from "react";
import {
  Megaphone,
  Check,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import type { CampaignApprovalBlock } from "@/lib/types/chat-blocks";

type Decision = "APPROVED" | "REJECTED";

type Recipient = CampaignApprovalBlock["data"]["recipients"][number];

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function deadlineLabel(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return format(d, "EEE MMM d");
  } catch {
    return null;
  }
}

export function CampaignApproval({
  data,
  onActionCompleted,
}: {
  data: CampaignApprovalBlock["data"];
  onActionCompleted?: (query: string) => void;
}) {
  const initialDecisions = useMemo(() => {
    const map: Record<string, Decision> = {};
    for (const r of data.recipients) {
      map[r.recipientId] = r.defaultDecision;
    }
    return map;
  }, [data.recipients]);

  const [decisions, setDecisions] = useState<Record<string, Decision>>(
    initialDecisions,
  );
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    approved: number;
    rejected: number;
  } | null>(null);

  const visibleLimit = Math.max(1, data.visibleLimit ?? 3);
  const hiddenCount = Math.max(0, data.recipients.length - visibleLimit);
  const visibleRecipients =
    expanded || hiddenCount === 0
      ? data.recipients
      : data.recipients.slice(0, visibleLimit);

  const counts = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    for (const r of data.recipients) {
      const d = decisions[r.recipientId] ?? r.defaultDecision;
      if (d === "APPROVED") approved++;
      else rejected++;
    }
    return { approved, rejected };
  }, [decisions, data.recipients]);

  function flip(recipientId: string) {
    if (submitting || confirmed) return;
    setDecisions((prev) => ({
      ...prev,
      [recipientId]: prev[recipientId] === "APPROVED" ? "REJECTED" : "APPROVED",
    }));
  }

  async function handleConfirm() {
    if (submitting || confirmed) return;
    setSubmitting(true);
    setError(null);

    const approvedIds: string[] = [];
    const rejectedIds: string[] = [];
    for (const r of data.recipients) {
      const d = decisions[r.recipientId] ?? r.defaultDecision;
      if (d === "APPROVED") approvedIds.push(r.recipientId);
      else rejectedIds.push(r.recipientId);
    }

    const calls: Promise<Response>[] = [];
    if (approvedIds.length > 0) {
      calls.push(
        fetch(`/api/campaigns/${data.campaignId}/bulk-approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientIds: approvedIds,
            action: "APPROVED",
          }),
        }),
      );
    }
    if (rejectedIds.length > 0) {
      calls.push(
        fetch(`/api/campaigns/${data.campaignId}/bulk-approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientIds: rejectedIds,
            action: "REJECTED",
          }),
        }),
      );
    }

    try {
      const responses = await Promise.all(calls);
      if (responses.every((r) => r.ok)) {
        setConfirmed({
          approved: approvedIds.length,
          rejected: rejectedIds.length,
        });
        onActionCompleted?.("review campaign approval");
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(10);
        }
      } else {
        setError(
          "Couldn't submit some decisions. Refresh and try again from the campaigns page.",
        );
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const deadlineText = deadlineLabel(data.deadline);
  const totalShown = data.recipients.length;
  const hasMixed = counts.approved > 0 && counts.rejected > 0;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Megaphone className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{data.name}</p>
          {data.description && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {data.description}
            </p>
          )}
        </div>
      </div>

      <ul className="divide-y divide-border/60">
        {visibleRecipients.map((r) => (
          <RecipientRow
            key={r.recipientId}
            recipient={r}
            decision={decisions[r.recipientId] ?? r.defaultDecision}
            disabled={submitting || confirmed != null}
            onFlip={() => flip(r.recipientId)}
          />
        ))}

        {!expanded && hiddenCount > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex w-full items-center justify-center gap-1.5 px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span>+{hiddenCount} more contact{hiddenCount !== 1 ? "s" : ""}</span>
            </button>
          </li>
        )}
      </ul>

      {(deadlineText || totalShown > 0) && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 text-[11px] text-muted-foreground border-t border-border/60">
          <span>
            {deadlineText ? `Due ${deadlineText}` : `${totalShown} contact${totalShown !== 1 ? "s" : ""}`}
          </span>
          {confirmed ? (
            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {confirmed.approved} approved · {confirmed.rejected} rejected
            </span>
          ) : (
            <span className={hasMixed ? "font-medium text-foreground/80" : ""}>
              {counts.approved} ready
              {counts.rejected > 0 ? ` · ${counts.rejected} rejected` : ""}
            </span>
          )}
        </div>
      )}

      {confirmed ? (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border/60 bg-muted/20 text-xs text-foreground/80">
          <CheckCircle2
            className="h-4 w-4 text-foreground/70"
            aria-hidden="true"
          />
          <span>
            Submitted — {confirmed.approved} approved, {confirmed.rejected}{" "}
            rejected. Decisions saved.
          </span>
        </div>
      ) : (
        <div
          data-cta-row
          className="flex flex-col gap-2 px-4 py-3 border-t border-border/60 bg-muted/20"
        >
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:active:scale-[0.98]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Submitting…</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>
                  Confirm
                  {hasMixed
                    ? ` (${counts.approved} approve · ${counts.rejected} reject)`
                    : counts.rejected === totalShown
                      ? " (reject all)"
                      : ""}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function RecipientRow({
  recipient,
  decision,
  disabled,
  onFlip,
}: {
  recipient: Recipient;
  decision: Decision;
  disabled: boolean;
  onFlip: () => void;
}) {
  const isApproved = decision === "APPROVED";
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground/70">
        {initialsFor(recipient.contactName)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {recipient.contactName}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {recipient.company ? `${recipient.company}` : ""}
          {recipient.company && recipient.personalizedSnippet ? " · " : ""}
          {recipient.personalizedSnippet ?? ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onFlip}
        disabled={disabled}
        aria-pressed={isApproved}
        aria-label={
          isApproved
            ? `Approved for ${recipient.contactName}. Tap to reject.`
            : `Rejected for ${recipient.contactName}. Tap to approve.`
        }
        className={
          isApproved
            ? "inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition-colors active:scale-[0.97] disabled:opacity-60"
            : "inline-flex shrink-0 items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive transition-colors active:scale-[0.97] disabled:opacity-60"
        }
      >
        {isApproved ? (
          <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
        ) : (
          <X className="h-3 w-3" aria-hidden="true" />
        )}
        <span>{isApproved ? "Approved" : "Rejected"}</span>
      </button>
    </li>
  );
}

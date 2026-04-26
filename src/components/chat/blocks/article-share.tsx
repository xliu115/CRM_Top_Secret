"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Newspaper,
  Check,
  SkipForward,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Send,
  Pencil,
} from "lucide-react";
import type { ArticleShareBlock } from "@/lib/types/chat-blocks";
import { EmailComposerModal } from "./email-composer-modal";

type Inclusion = "INCLUDED" | "SKIPPED";
type Recipient = ArticleShareBlock["data"]["recipients"][number];

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ArticleShare({ data, onActionCompleted }: { data: ArticleShareBlock["data"]; onActionCompleted?: (query: string) => void }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const initialDecisions = useMemo(() => {
    const map: Record<string, Inclusion> = {};
    for (const r of data.recipients) {
      map[r.recipientId] = r.defaultIncluded ? "INCLUDED" : "SKIPPED";
    }
    return map;
  }, [data.recipients]);

  const [decisions, setDecisions] = useState<Record<string, Inclusion>>(initialDecisions);
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ sent: number; skipped: number } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localBodies, setLocalBodies] = useState<Record<string, string>>({});
  const prevEditingId = useRef<string | null>(null);

  // Auto-scroll back to the card when the modal closes
  useEffect(() => {
    if (prevEditingId.current != null && editingId == null) {
      requestAnimationFrame(() => {
        cardRef.current?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      });
    }
    prevEditingId.current = editingId;
  }, [editingId]);

  const visibleLimit = Math.max(1, data.visibleLimit ?? 4);
  const hiddenCount = Math.max(0, data.recipients.length - visibleLimit);
  const visibleRecipients =
    expanded || hiddenCount === 0
      ? data.recipients
      : data.recipients.slice(0, visibleLimit);

  const counts = useMemo(() => {
    let included = 0;
    let skipped = 0;
    for (const r of data.recipients) {
      if ((decisions[r.recipientId] ?? "INCLUDED") === "INCLUDED") included++;
      else skipped++;
    }
    return { included, skipped };
  }, [decisions, data.recipients]);

  function toggleInclusion(recipientId: string) {
    if (submitting || confirmed) return;
    setDecisions((prev) => ({
      ...prev,
      [recipientId]: prev[recipientId] === "SKIPPED" ? "INCLUDED" : "SKIPPED",
    }));
  }

  const editingRecipient = data.recipients.find((r) => r.recipientId === editingId);

  async function handleSaveEmail(next: { subject: string; body: string }) {
    if (!editingId) return;
    setLocalBodies((prev) => ({ ...prev, [editingId]: next.body }));
    setEditingId(null);

    try {
      await fetch(`/api/campaigns/recipients/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalizedBody: next.body }),
      });
    } catch {
      // best-effort — local state already reflects the edit
    }
  }

  async function handleConfirm() {
    if (submitting || confirmed) return;
    setSubmitting(true);
    setError(null);

    const skippedIds: string[] = [];
    for (const r of data.recipients) {
      if ((decisions[r.recipientId] ?? "INCLUDED") === "SKIPPED") {
        skippedIds.push(r.recipientId);
      }
    }

    try {
      if (skippedIds.length > 0) {
        await Promise.allSettled(
          skippedIds.map((id) =>
            fetch(`/api/campaigns/recipients/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "SKIPPED" }),
            }),
          ),
        );
      }

      const res = await fetch(`/api/campaigns/${data.campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const result = await res.json();
        setConfirmed({
          sent: result.sentCount ?? counts.included,
          skipped: skippedIds.length,
        });
        onActionCompleted?.("newly published articles to share");
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(10);
        }
      } else {
        setError("Couldn't send the article — please try again.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const metaLine = [data.practice, data.publishedAtLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div
        ref={cardRef}
        tabIndex={-1}
        className="rounded-xl border border-border bg-card shadow-sm overflow-hidden outline-none"
      >
        {/* Compact article strip: thumbnail + title/meta */}
        <div className="flex gap-3 px-4 pt-3 pb-2">
          {data.imageUrl ? (
            <div className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.imageUrl}
                alt={data.title}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted">
              <Newspaper className="h-6 w-6 text-muted-foreground/50" />
            </div>
          )}
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
              {data.title}
            </p>
            {metaLine && (
              <p className="mt-1 text-xs text-muted-foreground">{metaLine}</p>
            )}
          </div>
        </div>

        {/* Recipient rows */}
        <ul className="divide-y divide-border/60">
          {visibleRecipients.map((r) => (
            <RecipientRow
              key={r.recipientId}
              recipient={r}
              localBody={localBodies[r.recipientId]}
              edited={
                localBodies[r.recipientId] != null &&
                localBodies[r.recipientId] !== r.personalizedBody
              }
              inclusion={decisions[r.recipientId] ?? "INCLUDED"}
              disabled={submitting || confirmed != null}
              onToggle={() => toggleInclusion(r.recipientId)}
              onEdit={() => setEditingId(r.recipientId)}
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
                <span>
                  +{hiddenCount} more contact{hiddenCount !== 1 ? "s" : ""}
                </span>
              </button>
            </li>
          )}
        </ul>

        {/* Meta / counts */}
        <div className="flex items-center justify-between gap-2 px-4 py-2 text-[11px] text-muted-foreground border-t border-border/60">
          <span>
            {data.totalRecipients} contact{data.totalRecipients !== 1 ? "s" : ""}
          </span>
          {confirmed ? (
            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {confirmed.sent} sent · {confirmed.skipped} skipped
            </span>
          ) : (
            <span>
              {counts.included} to share
              {counts.skipped > 0 ? ` · ${counts.skipped} skipped` : ""}
            </span>
          )}
        </div>

        {/* CTA / confirmed strip */}
        {confirmed ? (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border/60 bg-muted/20 text-xs text-foreground/80">
            <CheckCircle2
              className="h-4 w-4 text-foreground/70"
              aria-hidden="true"
            />
            <span>
              Sent to {confirmed.sent} contact{confirmed.sent !== 1 ? "s" : ""}.
              {confirmed.skipped > 0
                ? ` ${confirmed.skipped} skipped.`
                : ""}
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
              disabled={submitting || counts.included === 0}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:active:scale-[0.98]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>
                    Send to {counts.included} contact{counts.included !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Full-screen email composer */}
      <EmailComposerModal
        open={editingId != null}
        to={editingRecipient?.contactName ?? ""}
        initialSubject={data.subject}
        initialBody={
          editingId
            ? localBodies[editingId] ?? editingRecipient?.personalizedBody ?? ""
            : ""
        }
        onClose={() => setEditingId(null)}
        onSave={handleSaveEmail}
      />
    </>
  );
}

function RecipientRow({
  recipient,
  localBody,
  edited,
  inclusion,
  disabled,
  onToggle,
  onEdit,
}: {
  recipient: Recipient;
  localBody?: string;
  edited: boolean;
  inclusion: Inclusion;
  disabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const isIncluded = inclusion === "INCLUDED";
  const snippet = localBody
    ? localBody.replace(/\s*\n\s*/g, " ")
    : recipient.personalizedSnippet;

  return (
    <li className="flex items-center gap-2.5 px-4 py-2.5">
      {/* Tap to edit — takes most of the row */}
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        aria-label={`Edit email to ${recipient.contactName}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg -ml-1 pl-1 py-1 text-left transition-colors active:bg-muted/60 disabled:opacity-60"
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold ${
            isIncluded ? "text-foreground/70" : "text-foreground/30"
          }`}
        >
          {initialsFor(recipient.contactName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={`truncate text-sm font-medium ${
                isIncluded ? "text-foreground" : "text-foreground/40 line-through"
              }`}
            >
              {recipient.contactName}
            </p>
            {edited && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-500/10 dark:text-amber-300">
                <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                Edited
              </span>
            )}
          </div>
          {recipient.company && (
            <p className="truncate text-xs text-muted-foreground">
              {recipient.company}
            </p>
          )}
          {snippet && (
            <p className="mt-0.5 text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
              {snippet}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 text-primary/70">
          <span className="text-[11px] font-medium">Edit</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </button>

      {/* Toggle skip */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={disabled}
        aria-pressed={isIncluded}
        aria-label={
          isIncluded
            ? `Included ${recipient.contactName}. Tap to skip.`
            : `Skipped ${recipient.contactName}. Tap to include.`
        }
        className={
          isIncluded
            ? "inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition-colors active:scale-[0.97] disabled:opacity-60"
            : "inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors active:scale-[0.97] disabled:opacity-60"
        }
      >
        {isIncluded ? (
          <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
        ) : (
          <SkipForward className="h-3 w-3" aria-hidden="true" />
        )}
        <span>{isIncluded ? "Included" : "Skip"}</span>
      </button>
    </li>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, X, ChevronDown, Send, Inbox } from "lucide-react";
import type { ApprovalDeckBlock } from "@/lib/types/chat-blocks";

type DeckItem = ApprovalDeckBlock["data"]["items"][number];

type Decision = "approve" | "skip";

type Props = {
  data: ApprovalDeckBlock["data"];
  embedded?: boolean;
  onSendMessage?: (message: string) => void;
  onIndexChange?: (index: number, total: number) => void;
};

const SWIPE_THRESHOLD = 80;
const MAX_DRAG = 240;

export function ApprovalDeck({
  data,
  embedded = false,
  onSendMessage,
  onIndexChange,
}: Props) {
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [expanded, setExpanded] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [animatingOut, setAnimatingOut] = useState<Decision | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const approvedQueuedRef = useRef<Set<string>>(new Set());

  const items = data.items;
  const current = items[index];
  const remaining = items.length - index;

  useEffect(() => {
    onIndexChange?.(index, items.length);
  }, [index, items.length, onIndexChange]);

  const advance = useCallback((decision: Decision) => {
    if (!current || animatingOut) return;

    setAnimatingOut(decision);

    if (decision === "approve" && !approvedQueuedRef.current.has(current.itemId)) {
      approvedQueuedRef.current.add(current.itemId);
      onSendMessage?.(current.approveQuery);
    }

    setTimeout(() => {
      setDecisions((prev) => ({ ...prev, [current.itemId]: decision }));
      setIndex((i) => i + 1);
      setDragX(0);
      setAnimatingOut(null);
      setExpanded(false);
    }, 220);
  }, [current, animatingOut, onSendMessage]);

  function onPointerDown(e: React.PointerEvent) {
    if (expanded) return;
    dragStartRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragStartRef.current == null) return;
    const dx = e.clientX - dragStartRef.current;
    setDragX(Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx)));
  }

  function onPointerUp() {
    if (dragStartRef.current == null) return;
    dragStartRef.current = null;
    if (dragX > SWIPE_THRESHOLD) advance("approve");
    else if (dragX < -SWIPE_THRESHOLD) advance("skip");
    else setDragX(0);
  }

  const approvedCount = Object.values(decisions).filter((d) => d === "approve").length;
  const skippedCount = Object.values(decisions).filter((d) => d === "skip").length;

  if (!current) {
    return (
      <div className={embedded ? "" : "rounded-lg border border-border bg-card p-4"}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Check className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">All set</p>
            <p className="text-xs text-muted-foreground">
              Sent {approvedCount}, skipped {skippedCount}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const rotation = (dragX / MAX_DRAG) * 8;
  const approveOpacity = Math.max(0, Math.min(1, dragX / SWIPE_THRESHOLD));
  const skipOpacity = Math.max(0, Math.min(1, -dragX / SWIPE_THRESHOLD));

  const translate = animatingOut === "approve"
    ? "translate(520px, -40px) rotate(24deg)"
    : animatingOut === "skip"
      ? "translate(-520px, -40px) rotate(-24deg)"
      : `translate(${dragX}px, 0) rotate(${rotation}deg)`;

  const preview = !expanded;

  return (
    <div className={embedded ? "" : "rounded-lg border border-border bg-card p-3"}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            {data.title ?? "Approve drafts"}
          </span>
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground-subtle">
          {index + 1} of {items.length}
        </span>
      </div>

      <div className="relative" style={{ minHeight: expanded ? 360 : 220 }}>
        {items.slice(index + 1, index + 3).reverse().map((next, i) => (
          <div
            key={next.itemId}
            className="pointer-events-none absolute inset-0 rounded-xl border border-border bg-card/80 shadow-sm"
            style={{
              transform: `translateY(${(i + 1) * 6}px) scale(${1 - (i + 1) * 0.03})`,
              opacity: 0.6 - i * 0.2,
              zIndex: 1 - i,
            }}
          />
        ))}

        <DeckCardInner
          item={current}
          preview={preview}
          dragX={dragX}
          translate={translate}
          approveOpacity={approveOpacity}
          skipOpacity={skipOpacity}
          animating={animatingOut != null}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onExpand={() => setExpanded((v) => !v)}
          expanded={expanded}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => advance("skip")}
          disabled={animatingOut != null}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background/60 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Skip
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          disabled={animatingOut != null}
          className="flex h-11 items-center justify-center gap-1 rounded-lg border border-border bg-background/60 px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted disabled:opacity-50"
          aria-label="Expand"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => advance("approve")}
          disabled={animatingOut != null}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Approve
        </button>
      </div>

      <p className="mt-2 text-center text-[11px] text-muted-foreground-subtle">
        {remaining === 1 ? "Last one" : `${remaining - 1} more after this`}
        {" · "}
        Swipe right to approve, left to skip
      </p>
    </div>
  );
}

function DeckCardInner({
  item,
  preview,
  dragX,
  translate,
  approveOpacity,
  skipOpacity,
  animating,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onExpand,
  expanded,
}: {
  item: DeckItem;
  preview: boolean;
  dragX: number;
  translate: string;
  approveOpacity: number;
  skipOpacity: number;
  animating: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onExpand: () => void;
  expanded: boolean;
}) {
  return (
    <div
      className="absolute inset-0 touch-pan-y select-none rounded-xl border border-border bg-card shadow-md"
      style={{
        transform: translate,
        transition: animating || dragX === 0 ? "transform 220ms ease-out" : "none",
        zIndex: 10,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Draft to {item.contactName}
            </p>
            {item.company && (
              <p className="text-[11px] text-muted-foreground-subtle">{item.company}</p>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>

        <div className="mt-3 border-t border-border/40 pt-3">
          <p className="text-sm font-semibold text-foreground">{item.email.subject}</p>
          <p
            className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 ${
              preview ? "line-clamp-6" : ""
            }`}
          >
            {item.email.body}
          </p>
        </div>
      </div>

      <div
        className="pointer-events-none absolute left-4 top-4 rounded-md border border-border bg-muted/60 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-foreground"
        style={{ opacity: approveOpacity, transform: "rotate(-8deg)" }}
      >
        Approve
      </div>
      <div
        className="pointer-events-none absolute right-4 top-4 rounded-md border border-destructive bg-destructive/10 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-destructive"
        style={{ opacity: skipOpacity, transform: "rotate(8deg)" }}
      >
        Skip
      </div>
    </div>
  );
}

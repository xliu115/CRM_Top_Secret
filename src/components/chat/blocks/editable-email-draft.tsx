"use client";

import { useState } from "react";
import {
  Pencil,
  Sparkles,
  Mic,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { EditableEmailDraftBlock } from "@/lib/types/chat-blocks";
import { EmailComposerModal } from "./email-composer-modal";

type Props = {
  data: EditableEmailDraftBlock["data"];
  embedded?: boolean;
  onSendMessage?: (message: string) => void;
  onBodyChange?: (body: string) => void;
  onSubjectChange?: (subject: string) => void;
  onVoiceEdit?: () => void;
  voiceEditing?: boolean;
  editingControlled?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onAfterSave?: () => void;
  onOpenComposer?: () => void;
};

export function EditableEmailDraft({
  data,
  embedded = false,
  onSendMessage,
  onBodyChange,
  onSubjectChange,
  onVoiceEdit,
  voiceEditing = false,
  editingControlled,
  onEditingChange,
  onAfterSave,
  onOpenComposer,
}: Props) {
  const [editingInternal, setEditingInternal] = useState(false);
  const editing = editingControlled !== undefined ? editingControlled : editingInternal;
  const setEditing = (v: boolean) => {
    if (editingControlled !== undefined) {
      onEditingChange?.(v);
    } else {
      setEditingInternal(v);
    }
  };

  const [body, setBody] = useState(data.body);
  const [subject, setSubject] = useState(data.subject);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [prevDraftId, setPrevDraftId] = useState(data.draftId);
  const [showFull, setShowFull] = useState(false);

  if (prevDraftId !== data.draftId) {
    setPrevDraftId(data.draftId);
    setBody(data.body);
    setSubject(data.subject);
    setEditing(false);
  }

  function handleSave(next: { subject: string; body: string }) {
    setSubject(next.subject);
    setBody(next.body);
    onSubjectChange?.(next.subject);
    onBodyChange?.(next.body);
    setEditing(false);
    onAfterSave?.();
  }

  function regenerate(flavor: "warmer" | "shorter") {
    const query = data.regenerate?.[flavor];
    if (!query || !onSendMessage) return;
    setRegenerating(flavor);
    onSendMessage(query);
    setTimeout(() => setRegenerating(null), 1200);
  }

  const outerClass = embedded
    ? "overflow-hidden"
    : "rounded-lg border border-border bg-card overflow-hidden";

  const hasRegenerate =
    Boolean(data.regenerate?.warmer) ||
    Boolean(data.regenerate?.shorter) ||
    Boolean(onVoiceEdit);

  function openComposer() {
    setEditing(true);
    onOpenComposer?.();
  }

  function handleDraftKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openComposer();
    }
  }

  return (
    <>
      <div className={outerClass}>
        <div
          role="button"
          tabIndex={0}
          onClick={openComposer}
          onKeyDown={handleDraftKey}
          aria-label="Edit email"
          className="cursor-pointer select-none transition-colors hover:bg-muted/40 active:bg-muted/60"
        >
          <div
            className={
              embedded
                ? "pb-1 flex items-center justify-between gap-2"
                : "px-4 pt-3 pb-2 flex items-center justify-between gap-2"
            }
          >
            <span className="text-sm font-semibold text-foreground">Email Draft</span>
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] font-medium text-foreground/80">
              <Pencil className="h-3 w-3" />
              Edit
            </span>
          </div>

          <div className={`space-y-2.5 ${embedded ? "" : "px-4 pb-3"}`}>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-muted-foreground shrink-0 w-12">To:</span>
              <span className="text-sm text-foreground">{data.to}</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-muted-foreground shrink-0 w-12">Subject:</span>
              <span className="text-sm font-medium text-foreground">{subject}</span>
            </div>

            <div className="border-t border-border/40 pt-2.5">
              <div
                className={`text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap ${
                  showFull ? "" : "line-clamp-[10]"
                }`}
              >
                {body}
              </div>
              {body.split("\n").length > 10 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFull((v) => !v);
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 motion-safe:active:scale-[0.97]"
                  aria-label={showFull ? "Show less" : "Show more"}
                >
                  {showFull ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showFull ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          </div>
        </div>

        {hasRegenerate && (
          <div
            className={`flex flex-wrap items-center gap-1.5 ${
              embedded ? "pt-1" : "px-4 pb-3 pt-1"
            }`}
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground-subtle">
              <Sparkles className="h-3 w-3" />
              Regenerate
            </span>
            {data.regenerate?.warmer && (
              <button
                type="button"
                onClick={() => regenerate("warmer")}
                disabled={regenerating !== null}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-muted disabled:opacity-50"
              >
                {regenerating === "warmer" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Warmer
              </button>
            )}
            {data.regenerate?.shorter && (
              <button
                type="button"
                onClick={() => regenerate("shorter")}
                disabled={regenerating !== null}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-muted disabled:opacity-50"
              >
                {regenerating === "shorter" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Shorter
              </button>
            )}
            {onVoiceEdit && (
              <button
                type="button"
                onClick={onVoiceEdit}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  voiceEditing
                    ? "border-destructive/40 bg-destructive/10 text-destructive animate-pulse"
                    : "border-border bg-background/60 text-foreground/80 hover:bg-muted"
                }`}
              >
                <Mic className="h-3 w-3" />
                {voiceEditing ? "Listening…" : "Say it"}
              </button>
            )}
          </div>
        )}
      </div>

      <EmailComposerModal
        open={editing}
        to={data.to}
        initialSubject={subject}
        initialBody={body}
        onClose={() => setEditing(false)}
        onSave={handleSave}
      />
    </>
  );
}

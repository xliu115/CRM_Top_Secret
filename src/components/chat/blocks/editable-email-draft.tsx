"use client";

import { useEffect, useRef, useState } from "react";
import {
  Pencil,
  Check,
  X,
  Sparkles,
  Mic,
  Loader2,
} from "lucide-react";
import type { EditableEmailDraftBlock } from "@/lib/types/chat-blocks";

type Props = {
  data: EditableEmailDraftBlock["data"];
  embedded?: boolean;
  onSendMessage?: (message: string) => void;
  onBodyChange?: (body: string) => void;
  onSubjectChange?: (subject: string) => void;
  onVoiceEdit?: () => void;
  voiceEditing?: boolean;
};

export function EditableEmailDraft({
  data,
  embedded = false,
  onSendMessage,
  onBodyChange,
  onSubjectChange,
  onVoiceEdit,
  voiceEditing = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(data.body);
  const [subject, setSubject] = useState(data.subject);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [prevDraftId, setPrevDraftId] = useState(data.draftId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (prevDraftId !== data.draftId) {
    setPrevDraftId(data.draftId);
    setBody(data.body);
    setSubject(data.subject);
    setEditing(false);
  }

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 360) + "px";
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    onBodyChange?.(body);
    onSubjectChange?.(subject);
  }

  function cancel() {
    setBody(data.body);
    setSubject(data.subject);
    setEditing(false);
    onBodyChange?.(data.body);
    onSubjectChange?.(data.subject);
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

  return (
    <div className={outerClass}>
      <div className={embedded ? "pb-1 flex items-center justify-between gap-2" : "px-4 pt-3 pb-2 flex items-center justify-between gap-2"}>
        <span className="text-sm font-semibold text-foreground">Email Draft</span>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-muted"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Check className="h-3 w-3" />
              Done
            </button>
          </div>
        )}
      </div>

      <div className={`space-y-2.5 ${embedded ? "" : "px-4 pb-3"}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground shrink-0 w-12">To:</span>
          <span className="text-sm text-foreground">{data.to}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground shrink-0 w-12">Subject:</span>
          {editing ? (
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <span className="text-sm font-medium text-foreground">{subject}</span>
          )}
        </div>

        <div className="border-t border-border/40 pt-2.5">
          {editing ? (
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 360) + "px";
              }}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ minHeight: 160 }}
            />
          ) : (
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {body}
            </div>
          )}
        </div>

        {(data.regenerate?.warmer || data.regenerate?.shorter || onVoiceEdit) && !editing && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
    </div>
  );
}

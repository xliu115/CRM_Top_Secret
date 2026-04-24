"use client";

import { useEffect, useRef, useState } from "react";
import { X, Check } from "lucide-react";

type Props = {
  open: boolean;
  to: string;
  initialSubject: string;
  initialBody: string;
  onClose: () => void;
  onSave: (next: { subject: string; body: string }) => void;
};

/**
 * Full-screen email composer. Opens over the mobile chat when the user taps
 * Edit on an editable email draft. Designed to feel like a native mail
 * composer — top bar with Cancel/Save, static To, large Subject + Body.
 */
export function EmailComposerModal({
  open,
  to,
  initialSubject,
  initialBody,
  onClose,
  onSave,
}: Props) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  // Re-seed state whenever the composer opens with a fresh draft so the user
  // always sees the current draft content, including post-regenerate updates.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = open ? `${initialSubject}\u0000${initialBody}` : null;
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    setSubject(initialSubject);
    setBody(initialBody);
  }

  useEffect(() => {
    if (!open) return;
    // Lock background scroll while the composer is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the body on open — subject usually fine as-is, body is where edits happen.
    const t = window.setTimeout(() => {
      bodyRef.current?.focus();
      const el = bodyRef.current;
      if (el) {
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 80);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSave() {
    onSave({ subject: subject.trim() || initialSubject, body });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit email"
      className="absolute inset-0 z-[60] flex flex-col bg-background"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header className="flex items-center justify-between border-b border-border bg-card px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[14px] font-medium text-foreground/80 transition-colors hover:bg-muted active:scale-[0.97] min-h-[40px]"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
        <p className="text-[15px] font-semibold text-foreground">Edit Email</p>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.97] min-h-[40px]"
        >
          <Check className="h-4 w-4" />
          Save
        </button>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">To</span>
          <span className="flex-1 text-[15px] text-foreground">{to}</span>
        </div>

        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">Subject</span>
          <input
            ref={subjectRef}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 bg-transparent text-[15px] font-medium text-foreground placeholder:text-muted-foreground-subtle focus:outline-none"
            placeholder="Subject"
            style={{ fontSize: "16px" }}
          />
        </div>

        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
          className="flex-1 resize-none bg-background px-4 py-4 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground-subtle focus:outline-none"
          style={{ fontSize: "16px" }}
        />
      </div>
    </div>
  );
}

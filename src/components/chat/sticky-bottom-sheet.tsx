"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
};

export function StickyBottomSheet({ open, onClose, children, ariaLabel }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 motion-safe:transition-opacity"
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-border bg-card shadow-lg motion-safe:animate-in motion-safe:slide-in-from-bottom-2"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="mx-auto mt-2 mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <div className="px-3 pb-3">{children}</div>
      </div>
    </div>
  );
}

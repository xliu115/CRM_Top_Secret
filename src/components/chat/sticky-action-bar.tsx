"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { StickyBottomSheet } from "./sticky-bottom-sheet";

type StickyTarget = {
  label: string;
  primary?: { label: string; onClick: () => void };
  more?: { label: string; onClick: () => void }[];
};

export function StickyActionBar({
  enabled,
  target,
}: {
  enabled: boolean;
  target: StickyTarget | null;
}) {
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!enabled || !target) {
      return;
    }

    const ctaRows = document.querySelectorAll<HTMLElement>("[data-cta-row]");
    const latest = ctaRows[ctaRows.length - 1];

    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!latest) {
      return () => {
        setVisible(false);
      };
    }

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setVisible(!e.isIntersecting);
      },
      { threshold: 0.1, rootMargin: "0px 0px -64px 0px" }
    );
    obs.observe(latest);
    observerRef.current = obs;
    return () => {
      obs.disconnect();
      observerRef.current = null;
      setVisible(false);
    };
  }, [enabled, target]);

  if (!enabled || !target || !visible) return null;

  return (
    <>
      <div
        role="region"
        aria-live="polite"
        aria-label="Quick actions"
        className="absolute inset-x-0 bottom-0 z-30 motion-safe:transition-opacity motion-safe:animate-in motion-safe:fade-in"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 96px)" }}
      >
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-md">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {target.label}
          </span>
          {target.primary && (
            <button
              type="button"
              onClick={target.primary.onClick}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white motion-safe:active:scale-[0.97] active:bg-blue-800"
              aria-label={target.primary.label}
            >
              {target.primary.label}
            </button>
          )}
          {target.more && target.more.length > 0 && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="More actions"
              className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground motion-safe:active:scale-[0.97] active:bg-muted/60"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <StickyBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        ariaLabel="More actions"
      >
        <div className="flex flex-col gap-1">
          {target.more?.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSheetOpen(false);
                m.onClick();
              }}
              className="rounded-md px-3 py-3 text-left text-sm font-medium text-foreground motion-safe:active:scale-[0.99] active:bg-muted"
            >
              {m.label}
            </button>
          ))}
        </div>
      </StickyBottomSheet>
    </>
  );
}

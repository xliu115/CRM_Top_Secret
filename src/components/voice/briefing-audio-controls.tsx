"use client";

import { Play, Pause, Loader2 } from "lucide-react";

type BriefingAudioControlsProps = {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  elapsed: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

function formatMmSs(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
  const s = Math.floor(totalSec % 60);
  const m = Math.floor(totalSec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function BriefingAudioControls({
  isPlaying,
  isPaused,
  isLoading,
  elapsed,
  duration,
  onPlay,
  onPause,
  onResume,
  onStop,
}: BriefingAudioControlsProps) {
  const active = isPlaying || isPaused || isLoading;
  const Icon = isLoading ? Loader2 : isPlaying ? Pause : Play;

  const progressPct =
    active && duration > 0
      ? Math.min(100, (elapsed / duration) * 100)
      : 0;

  const handleToggle = () => {
    if (isLoading) return;
    if (isPlaying) return onPause();
    if (isPaused) return onResume();
    onPlay();
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isLoading}
          aria-label={isPlaying ? "Pause briefing" : "Play briefing"}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm active:scale-[0.97] disabled:opacity-60"
        >
          <Icon className={`h-5 w-5 ${!isPlaying ? "pl-0.5" : ""} ${isLoading ? "animate-spin" : ""}`} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            {isLoading ? (
              <div className="h-full w-full animate-pulse rounded-full bg-primary/40" />
            ) : (
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${progressPct}%` }}
              />
            )}
          </div>
          <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground-subtle">
            <span>{formatMmSs(elapsed)}</span>
            <span>{active && !isLoading ? formatMmSs(duration) : "AI voice"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

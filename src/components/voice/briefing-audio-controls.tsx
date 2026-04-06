"use client";

import { Play, Pause, Square, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type BriefingAudioControlsProps = {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  elapsed: number;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function BriefingAudioControls({
  isPlaying,
  isPaused,
  isLoading,
  elapsed,
  onPlay,
  onPause,
  onResume,
  onStop,
}: BriefingAudioControlsProps) {
  if (isLoading) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled className="h-8 gap-1.5 px-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Loading...</span>
        </Button>
      </div>
    );
  }

  if (isPlaying) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPause}
          className="h-8 gap-1.5 px-3 text-primary"
        >
          <Pause className="h-3.5 w-3.5" />
          <span className="text-xs font-mono tabular-nums">{formatTime(elapsed)}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStop}
          className="h-8 w-8 p-0 text-muted-foreground"
        >
          <Square className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onResume}
          className="h-8 gap-1.5 px-3 text-primary"
        >
          <Play className="h-3.5 w-3.5" />
          <span className="text-xs">Resume</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStop}
          className="h-8 w-8 p-0 text-muted-foreground"
        >
          <Square className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onPlay}
        className="h-8 gap-1.5 px-3 text-muted-foreground hover:text-primary"
      >
        <Volume2 className="h-3.5 w-3.5" />
        <span className="text-xs">Listen</span>
      </Button>
      <span className="text-[10px] text-muted-foreground/60">AI voice</span>
    </div>
  );
}

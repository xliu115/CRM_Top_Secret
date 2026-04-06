"use client";

import { useEffect, useRef } from "react";

type LiveTranscriptPreviewProps = {
  transcript: string;
  isListening: boolean;
  duration: number;
  audioLevel?: number;
};

function AudioLevelBars({ level }: { level: number }) {
  const barCount = 5;
  return (
    <div className="flex items-center gap-[2px]" aria-hidden>
      {Array.from({ length: barCount }, (_, i) => {
        const threshold = (i + 1) / barCount;
        const active = level >= threshold * 0.5;
        const height = 6 + i * 3;
        return (
          <div
            key={i}
            className="w-[3px] rounded-full transition-all duration-75"
            style={{
              height: active ? `${height}px` : "4px",
              backgroundColor: active
                ? "hsl(var(--primary))"
                : "hsl(var(--muted-foreground) / 0.3)",
            }}
          />
        );
      })}
    </div>
  );
}

export function LiveTranscriptPreview({
  transcript,
  isListening,
  duration,
  audioLevel = 0,
}: LiveTranscriptPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  if (!isListening) return null;

  if (!transcript) {
    return (
      <div className="mx-3 mb-2 flex items-center gap-2.5 rounded-xl bg-card/90 px-4 py-3 shadow-sm backdrop-blur">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
        </span>
        <AudioLevelBars level={audioLevel} />
        <span className="text-sm text-muted-foreground">
          Listening... {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
        </span>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2 rounded-xl bg-card/90 px-4 py-3 shadow-sm backdrop-blur">
      <div className="mb-1 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
        <AudioLevelBars level={audioLevel} />
      </div>
      <div
        ref={scrollRef}
        className="max-h-[4.5rem] overflow-y-auto text-[15px] leading-relaxed text-foreground"
      >
        {transcript}
        <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary" />
      </div>
    </div>
  );
}

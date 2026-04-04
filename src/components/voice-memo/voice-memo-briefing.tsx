"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

export type VoiceMemoSegmentClient = {
  id: string;
  headline: string;
  startMs: number;
  endMs: number;
  deeplink?: string;
};

export type VoiceMemoBriefingProps = {
  audioUrl: string;
  durationMs: number;
  segments: VoiceMemoSegmentClient[];
  /** `embedded`: no outer card chrome — use inside Today’s summary */
  variant?: "card" | "embedded";
};

function formatMmSs(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
  const s = Math.floor(totalSec % 60);
  const m = Math.floor(totalSec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function activeSegmentIndex(
  segments: Pick<VoiceMemoSegmentClient, "startMs">[],
  currentMs: number
): number {
  if (segments.length === 0) return -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (currentMs >= segments[i].startMs) return i;
  }
  return 0;
}

function tryPlayHtmlAudio(el: HTMLAudioElement) {
  el.muted = false;
  el.defaultMuted = false;
  el.volume = 1;
  const p = el.play();
  if (!p) return;
  void p.catch(() => {
    const onReady = () => {
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("loadeddata", onReady);
      void el.play().catch(() => {});
    };
    el.addEventListener("canplay", onReady);
    el.addEventListener("loadeddata", onReady);
    if (el.readyState === HTMLMediaElement.HAVE_NOTHING) {
      el.load();
    }
  });
}

export function VoiceMemoBriefing({
  audioUrl,
  durationMs: durationMsProp,
  segments,
  variant = "card",
}: VoiceMemoBriefingProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [duration, setDuration] = useState(durationMsProp / 1000);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const playAfterSeek = useCallback((el: HTMLAudioElement, sec: number) => {
    el.currentTime = sec;
    tryPlayHtmlAudio(el);
  }, []);

  const seekToMs = useCallback(
    (ms: number, opts?: { play?: boolean }) => {
      const el = audioRef.current;
      if (!el) return;
      const sec = ms / 1000;
      setCurrentMs(ms);
      if (opts?.play) {
        playAfterSeek(el, sec);
        return;
      }
      el.currentTime = sec;
    },
    [playAfterSeek]
  );

  const onTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrentMs(Math.floor(el.currentTime * 1000));
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
    }
  }, []);

  useEffect(() => {
    setDuration(durationMsProp / 1000);
  }, [durationMsProp]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
  }, [audioUrl]);

  const activeIdx = useMemo(
    () => activeSegmentIndex(segments, currentMs),
    [segments, currentMs]
  );

  /** Use element.paused, not React state — avoids mismatch where UI shows Play but audio is stuck. */
  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    setMediaError(null);
    tryPlayHtmlAudio(el);
  }, []);

  const displayCurrentSec = currentMs / 1000;

  const isEmbedded = variant === "embedded";

  return (
    <div
      className={
        isEmbedded
          ? "mt-4 border-t border-border pt-4"
          : "rounded-2xl border border-border bg-card p-4 shadow-sm"
      }
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle">
        {isEmbedded ? "Listen" : "Daily voice memo"}
      </p>
      <p className="mt-1 text-[15px] text-muted-foreground leading-snug">
        {isEmbedded
          ? "Listen here, or read the summary below."
          : "Your briefing, read like an EA. Tap a topic to jump in the audio."}
      </p>
      {mediaError && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {mediaError}
        </p>
      )}

      {/* sr-only: no display:none / opacity-0 — some mobile WebKit builds mute inaudible nodes. */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        playsInline
        muted={false}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onError={() => {
          setMediaError("Could not load this audio. Try again after refreshing.");
        }}
        className="sr-only"
        aria-hidden={true}
      />

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          variant="default"
          className="h-12 w-12 shrink-0 rounded-full"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 pl-0.5" />
          )}
        </Button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 1}
            step={0.1}
            value={Math.min(displayCurrentSec, duration || 1)}
            onChange={(e) => {
              const t = Number(e.target.value);
              seekToMs(t * 1000);
            }}
            className="h-2 w-full cursor-pointer accent-primary"
            aria-label="Playback position"
          />
          <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground-subtle">
            <span>{formatMmSs(displayCurrentSec)}</span>
            <span>{formatMmSs(duration)}</span>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {segments.map((seg, idx) => (
          <li key={seg.id}>
            <div
              className={cn(
                "flex items-stretch gap-1 rounded-xl border text-[15px] transition-colors",
                activeIdx === idx
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-transparent bg-muted/40 text-foreground"
              )}
            >
              <button
                type="button"
                onClick={() => seekToMs(seg.startMs, { play: true })}
                className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/30"
              >
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    activeIdx === idx ? "bg-primary" : "bg-muted-foreground/40"
                  )}
                />
                <span className="min-w-0 flex-1 leading-snug">{seg.headline}</span>
              </button>
              {seg.deeplink && (
                <Link
                  href={seg.deeplink}
                  className="flex shrink-0 items-center px-2 text-muted-foreground hover:text-primary"
                  aria-label="Open in app"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

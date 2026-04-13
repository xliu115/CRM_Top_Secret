"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play, ExternalLink, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { computeSegmentOffsetsMs } from "@/lib/utils/voice-timeline";

export type VoiceOutlineSegment = {
  id: string;
  headline: string;
  script: string;
  deeplink?: string;
};

/** ~160 wpm reading speed for timeline estimates (browser TTS varies). */
export function estimateSegmentDurationMs(script: string): number {
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  const wpm = 160;
  return Math.max(2000, Math.round((words / wpm) * 60 * 1000));
}

function formatMmSs(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
  const s = Math.floor(totalSec % 60);
  const m = Math.floor(totalSec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Chrome keeps the queue paused until resume(); iOS needs voices warmed via getVoices(). */
function prepareSpeechSynthesis() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.resume();
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }
}

/** Setting `utterance.voice` before voices load breaks speech on many iOS builds — use default. */
function shouldBindSynthesisVoice(): boolean {
  if (typeof navigator === "undefined") return true;
  return !/iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith("en") && v.localService) ??
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ??
    voices[0] ??
    null
  );
}

type Props = {
  segments: VoiceOutlineSegment[];
  /** True while showing sample copy until live CRM + voice pipeline data is available */
  isPlaceholder?: boolean;
  /** `embedded`: no outer card — use inside Today’s summary */
  variant?: "card" | "embedded";
};

export function VoiceMemoClientBriefing({
  segments,
  isPlaceholder = false,
  variant = "card",
}: Props) {
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const segmentStartedAtRef = useRef<number>(0);
  const playingIdxRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const durationsMs = useMemo(
    () => segments.map((s) => estimateSegmentDurationMs(s.script)),
    [segments]
  );

  const { startMs, endMs, totalMs } = useMemo(
    () => computeSegmentOffsetsMs(durationsMs),
    [durationsMs]
  );

  const durationSec = totalMs / 1000;

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const warm = () => prepareSpeechSynthesis();
    warm();
    window.speechSynthesis.addEventListener("voiceschanged", warm);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", warm);
    };
  }, []);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    clearTick();
    setPlaying(false);
  }, [clearTick]);

  const speakFrom = useCallback(
    (segmentIndex: number) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      clearTick();

      const run = (idx: number) => {
        clearTick();
        if (idx >= segments.length) {
          setCurrentMs(totalMs);
          setPlaying(false);
          return;
        }

        const seg = segments[idx];
        if (!seg) return;

        playingIdxRef.current = idx;
        segmentStartedAtRef.current = Date.now();
        setCurrentMs(startMs[idx] ?? 0);

        prepareSpeechSynthesis();

        const u = new SpeechSynthesisUtterance(seg.script);
        u.rate = 1;
        u.lang = "en-US";
        u.volume = 1;
        if (shouldBindSynthesisVoice()) {
          const voice = pickEnglishVoice();
          if (voice) u.voice = voice;
        }
        u.onstart = () => setTtsError(null);
        u.onend = () => run(idx + 1);
        u.onerror = (ev) => {
          const code = ev.error as string;
          if (
            code === "canceled" ||
            code === "cancelled" ||
            code === "interrupted"
          ) {
            return;
          }
          setTtsError("Could not play speech. Check volume and the silent switch, then try again.");
          stopSpeech();
        };

        window.speechSynthesis.speak(u);
        setPlaying(true);

        clearTick();
        tickRef.current = setInterval(() => {
          const i = playingIdxRef.current;
          const start = startMs[i] ?? 0;
          const end = endMs[i] ?? start;
          const dur = Math.max(1, end - start);
          const elapsed = Date.now() - segmentStartedAtRef.current;
          const frac = Math.min(1, elapsed / dur);
          setCurrentMs(Math.floor(start + frac * (end - start)));
        }, 200);
      };

      run(segmentIndex);
    },
    [segments, startMs, endMs, totalMs, clearTick, stopSpeech]
  );

  const togglePlay = useCallback(() => {
    if (playing) {
      stopSpeech();
      return;
    }
    setTtsError(null);
    const idx = activeSegmentIndexFromMs(startMs, endMs, currentMs);
    speakFrom(idx);
  }, [playing, stopSpeech, speakFrom, currentMs, startMs, endMs]);

  const seekToMs = useCallback(
    (ms: number) => {
      stopSpeech();
      setCurrentMs(ms);
      let idx = 0;
      for (let i = segments.length - 1; i >= 0; i--) {
        if (ms >= (startMs[i] ?? 0)) {
          idx = i;
          break;
        }
      }
      speakFrom(idx);
    },
    [segments.length, startMs, speakFrom, stopSpeech]
  );

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  const activeIdx = useMemo(
    () => activeSegmentIndexFromMs(startMs, endMs, currentMs),
    [startMs, endMs, currentMs]
  );

  const supported =
    typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

  if (segments.length === 0) return null;

  const outlineOnly = !supported;
  const isEmbedded = variant === "embedded";

  return (
    <div
      className={
        isEmbedded
          ? "mt-4 border-t border-border pt-4"
          : "rounded-2xl border border-dashed border-border bg-card p-4 shadow-sm"
      }
    >
      <div className="flex items-start gap-2">
        <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle">
              {isEmbedded ? "Listen" : "Daily voice memo"}
            </p>
            {isPlaceholder && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Sample
              </span>
            )}
          </div>
          <p className="mt-1 text-[15px] text-muted-foreground leading-snug">
            {isEmbedded ? (
              <>
                Listen here, or read the summary below.
                {isPlaceholder && (
                  <>
                    {" "}
                    Sample script — connects to your live CRM when the briefing loads.
                  </>
                )}
              </>
            ) : isPlaceholder ? (
              <>
                Preview layout — your live EA briefing and studio audio appear here when
                connected.
              </>
            ) : outlineOnly ? (
              <>
                This browser can’t play the spoken briefing. Use Safari or Chrome on a
                phone, or add{" "}
                <code className="rounded bg-muted px-1 text-xs">OPENAI_API_KEY</code> for
                streamed audio.
              </>
            ) : (
              <>
                Playing with your device voice (default). Add{" "}
                <code className="rounded bg-muted px-1 text-xs">OPENAI_API_KEY</code> for
                studio-quality audio.
              </>
            )}
          </p>
          {ttsError && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {ttsError}
            </p>
          )}
        </div>
      </div>

      {!outlineOnly && (
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
            max={Math.max(0.1, durationSec)}
            step={0.1}
            value={Math.min(currentMs / 1000, durationSec)}
            onChange={(e) => {
              const t = Number(e.target.value) * 1000;
              if (playing) {
                seekToMs(t);
              } else {
                setCurrentMs(t);
              }
            }}
            className="h-2 w-full cursor-pointer accent-primary"
            aria-label="Playback position"
          />
          <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground-subtle">
            <span>{formatMmSs(currentMs / 1000)}</span>
            <span>{formatMmSs(durationSec)}</span>
          </div>
        </div>
      </div>
      )}

      <ul className="mt-4 space-y-2">
        {segments.map((seg, idx) => (
          <li key={seg.id}>
            <div
              className={cn(
                "flex items-stretch gap-1 rounded-xl border text-[15px] transition-colors",
                !outlineOnly && activeIdx === idx
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-transparent bg-muted/40 text-foreground"
              )}
            >
              {outlineOnly ? (
                <div className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  <span className="min-w-0 flex-1 leading-snug">{seg.headline}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => seekToMs(startMs[idx] ?? 0)}
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
              )}
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

function activeSegmentIndexFromMs(
  startMs: number[],
  endMs: number[],
  currentMs: number
): number {
  if (startMs.length === 0) return 0;
  for (let i = startMs.length - 1; i >= 0; i--) {
    if (currentMs >= (startMs[i] ?? 0)) return i;
  }
  return 0;
}

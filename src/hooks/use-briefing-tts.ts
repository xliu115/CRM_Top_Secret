"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VoiceOutlineSegment } from "@/components/voice-memo/voice-memo-client-briefing";
import { estimateSegmentDurationMs } from "@/components/voice-memo/voice-memo-client-briefing";
import { computeSegmentOffsetsMs } from "@/lib/utils/voice-timeline";

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

/**
 * One continuous TTS briefing: one virtual timeline; play/pause; seek by segment or scrubber.
 */
export function useBriefingTts(segments: VoiceOutlineSegment[]) {
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const segmentStartedAtRef = useRef<number>(0);
  const playingIdxRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chainGenerationRef = useRef(0);

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
    chainGenerationRef.current += 1;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    clearTick();
    setPlaying(false);
  }, [clearTick]);

  const speakFrom = useCallback(
    (segmentIndex: number) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      if (segments.length === 0) return;

      chainGenerationRef.current += 1;
      const generation = chainGenerationRef.current;
      window.speechSynthesis.cancel();
      clearTick();

      const run = (idx: number) => {
        clearTick();
        if (generation !== chainGenerationRef.current) return;
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
        setError(null);

        prepareSpeechSynthesis();

        const u = new SpeechSynthesisUtterance(seg.script);
        u.rate = 1;
        u.lang = "en-US";
        u.volume = 1;
        if (shouldBindSynthesisVoice()) {
          const voice = pickEnglishVoice();
          if (voice) u.voice = voice;
        }
        u.onstart = () => {
          try {
            window.speechSynthesis.resume();
          } catch {
            /* ignore */
          }
        };
        u.onend = () => {
          if (generation !== chainGenerationRef.current) return;
          run(idx + 1);
        };
        u.onerror = (ev) => {
          const code = ev.error;
          if (code === "canceled" || code === "cancelled" || code === "interrupted") return;
          if (generation !== chainGenerationRef.current) return;
          setError(
            "Could not play speech. Check the silent switch and volume, then tap play again."
          );
          stopSpeech();
        };

        window.speechSynthesis.speak(u);
        setPlaying(true);

        tickRef.current = setInterval(() => {
          if (generation !== chainGenerationRef.current) return;
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
    setError(null);
    const idx = activeSegmentIndexFromMs(startMs, endMs, currentMs);
    speakFrom(idx);
  }, [playing, stopSpeech, speakFrom, currentMs, startMs, endMs]);

  /** Jump timeline to this segment and play the rest of the briefing from there. */
  const seekToSegmentIndex = useCallback(
    (segmentIndex: number) => {
      if (segmentIndex < 0 || segmentIndex >= segments.length) return;
      setError(null);
      speakFrom(segmentIndex);
    },
    [segments.length, speakFrom]
  );

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
    return () => stopSpeech();
  }, [stopSpeech]);

  const activeSegmentIndex = useMemo(
    () => activeSegmentIndexFromMs(startMs, endMs, currentMs),
    [startMs, endMs, currentMs]
  );

  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined"
    );
  }, []);

  return {
    playing,
    currentMs,
    totalMs,
    durationSec,
    startMs,
    endMs,
    activeSegmentIndex,
    togglePlay,
    seekToSegmentIndex,
    seekToMs,
    stop: stopSpeech,
    supported,
    error,
  };
}

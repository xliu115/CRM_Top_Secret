"use client";

import { useRef, useState, useCallback, useEffect } from "react";

/**
 * Mobile briefing playback is intentionally faster than the model's natural
 * pace — the morning brief is dense and partners want to skim it audibly.
 * 1.25× hits a sweet spot where it feels energetic but stays intelligible.
 * `preservesPitch` keeps the voice on-pitch so it doesn't go chipmunky.
 */
const BRIEFING_PLAYBACK_RATE = 1.25;

type AudioWithPitch = HTMLAudioElement & {
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

function applyBriefingPlaybackRate(audio: HTMLAudioElement) {
  const a = audio as AudioWithPitch;
  a.preservesPitch = true;
  a.mozPreservesPitch = true;
  a.webkitPreservesPitch = true;
  a.playbackRate = BRIEFING_PLAYBACK_RATE;
}

type UseBriefingAudioReturn = {
  play: (text: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  error: string | null;
  elapsed: number;
  duration: number;
};

function supportsMediaSource(): boolean {
  if (typeof window === "undefined") return false;
  if (!("MediaSource" in window)) return false;
  return MediaSource.isTypeSupported("audio/mpeg");
}

export function useBriefingAudio(): UseBriefingAudioReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const synthUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const usingFallbackRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const estimatedDurationRef = useRef(0);

  const cleanup = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (usingFallbackRef.current) {
      window.speechSynthesis?.cancel();
      synthUtteranceRef.current = null;
    }
    usingFallbackRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setElapsed(0);
    setDuration(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startTimer = useCallback(() => {
    const start = Date.now();
    if (estimatedDurationRef.current > 0) {
      setDuration(estimatedDurationRef.current);
    }
    timerRef.current = setInterval(() => {
      const audio = audioRef.current;
      if (audio && Number.isFinite(audio.currentTime) && audio.currentTime > 0) {
        setElapsed(Math.floor(audio.currentTime));
        if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration < 86400) {
          setDuration(Math.floor(audio.duration));
        }
      } else {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }
    }, 250);
  }, []);

  const playWithSpeechSynthesis = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) {
        setError("Voice playback not available on this device");
        setIsLoading(false);
        return;
      }

      usingFallbackRef.current = true;
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      if (voices.length > 0) {
        utterance.voice = voices[0];
      }
      utterance.rate = BRIEFING_PLAYBACK_RATE;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsLoading(false);
        setIsPlaying(true);
        startTimer();
      };
      utterance.onend = () => cleanup();
      utterance.onerror = () => {
        setError("Voice playback failed");
        cleanup();
      };

      synthUtteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    },
    [cleanup, startTimer],
  );

  const playStreaming = useCallback(
    async (text: string, signal: AbortSignal) => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.fallback) {
          playWithSpeechSynthesis(text);
          return;
        }
        throw new Error(body.error || "TTS failed");
      }

      if (!res.body) throw new Error("No response stream");

      const mediaSource = new MediaSource();
      const url = URL.createObjectURL(mediaSource);
      blobUrlRef.current = url;

      const audio = new Audio();
      audioRef.current = audio;
      audio.src = url;
      applyBriefingPlaybackRate(audio);

      let playbackStarted = false;

      await new Promise<void>((resolve, reject) => {
        mediaSource.addEventListener("sourceopen", async () => {
          const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
          const reader = res.body!.getReader();

          const pump = async () => {
            while (true) {
              if (signal.aborted) {
                reader.cancel();
                return;
              }

              const { done, value } = await reader.read();

              if (done) {
                const finalize = () => {
                  if (mediaSource.readyState === "open") {
                    mediaSource.endOfStream();
                  }
                  if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration < 86400) {
                    setDuration(Math.floor(audio.duration));
                  }
                };
                if (mediaSource.readyState === "open") {
                  if (sourceBuffer.updating) {
                    sourceBuffer.addEventListener("updateend", finalize, { once: true });
                  } else {
                    finalize();
                  }
                }
                resolve();
                return;
              }

              await new Promise<void>((r) => {
                if (sourceBuffer.updating) {
                  sourceBuffer.addEventListener("updateend", () => r(), { once: true });
                } else {
                  r();
                }
              });

              sourceBuffer.appendBuffer(value);

              if (!playbackStarted) {
                playbackStarted = true;
                setIsLoading(false);
                setIsPlaying(true);
                startTimer();
                applyBriefingPlaybackRate(audio);
                audio.play().catch(() => {});
              }
            }
          };

          audio.onended = () => cleanup();
          audio.onerror = () => {
            reject(new Error("Audio playback failed"));
          };

          pump().catch(reject);
        }, { once: true });
      });
    },
    [cleanup, playWithSpeechSynthesis, startTimer],
  );

  const playBlob = useCallback(
    async (text: string, signal: AbortSignal) => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.fallback) {
          playWithSpeechSynthesis(text);
          return;
        }
        throw new Error(body.error || "TTS failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      applyBriefingPlaybackRate(audio);

      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setDuration(Math.floor(audio.duration));
        }
      };

      audio.oncanplay = () => {
        setIsLoading(false);
        setIsPlaying(true);
        startTimer();
        applyBriefingPlaybackRate(audio);
        audio.play();
      };

      audio.onended = () => cleanup();
      audio.onerror = () => {
        setError("Audio playback failed");
        cleanup();
      };

      audio.load();
    },
    [cleanup, playWithSpeechSynthesis, startTimer],
  );

  const play = useCallback(
    async (text: string) => {
      cleanup();
      setError(null);
      setIsLoading(true);

      // ~150 words/min for TTS, ~4.7 chars/word → ~705 chars/min → ~11.75 chars/sec
      const estimatedSec = Math.round(text.length / 11.75);
      estimatedDurationRef.current = estimatedSec;
      setDuration(estimatedSec);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        if (supportsMediaSource()) {
          await playStreaming(text, abort.signal);
        } else {
          await playBlob(text, abort.signal);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        playWithSpeechSynthesis(text);
      }
    },
    [cleanup, playStreaming, playBlob, playWithSpeechSynthesis],
  );

  const pause = useCallback(() => {
    if (usingFallbackRef.current) {
      speechSynthesis?.pause();
    } else {
      audioRef.current?.pause();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (usingFallbackRef.current) {
      speechSynthesis?.resume();
    } else {
      audioRef.current?.play();
    }
    startTimer();
    setIsPlaying(true);
    setIsPaused(false);
  }, [startTimer]);

  const stop = useCallback(() => cleanup(), [cleanup]);

  return {
    play,
    pause,
    resume,
    stop,
    isPlaying,
    isPaused,
    isLoading,
    error,
    elapsed,
    duration,
  };
}

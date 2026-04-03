"use client";

import { useRef, useState, useCallback, useEffect } from "react";

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const synthUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const usingFallbackRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

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
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startTimer = useCallback(() => {
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
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
      utterance.rate = 1.0;
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
                if (mediaSource.readyState === "open") {
                  sourceBuffer.addEventListener("updateend", () => {
                    if (mediaSource.readyState === "open") {
                      mediaSource.endOfStream();
                    }
                  }, { once: true });

                  if (!sourceBuffer.updating) {
                    mediaSource.endOfStream();
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

      audio.oncanplay = () => {
        setIsLoading(false);
        setIsPlaying(true);
        startTimer();
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
  };
}

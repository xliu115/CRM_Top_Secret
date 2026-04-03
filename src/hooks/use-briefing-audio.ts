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

  const cleanup = useCallback(() => {
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

  const play = useCallback(
    async (text: string) => {
      cleanup();
      setError(null);
      setIsLoading(true);

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
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
      } catch {
        playWithSpeechSynthesis(text);
      }
    },
    [cleanup, playWithSpeechSynthesis, startTimer],
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

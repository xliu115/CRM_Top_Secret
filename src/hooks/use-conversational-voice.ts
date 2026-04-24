"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type CallState = "idle" | "listening" | "thinking" | "speaking";

type UseConversationalVoiceOptions = {
  onUserTurn: (transcript: string) => void;
  enabled: boolean;
};

const SILENCE_LEVEL = 0.03;
const SPEAKING_LEVEL = 0.08;
const SILENCE_TIMEOUT_MS = 1400;
const MAX_TURN_MS = 20_000;

export function useConversationalVoice({ onUserTurn, enabled }: UseConversationalVoiceOptions) {
  const [state, setState] = useState<CallState>("idle");
  const [transcript, setTranscript] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const stoppedRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechDetectedRef = useRef(false);
  const transcribingRef = useRef(false);

  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsBlobUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  const onUserTurnRef = useRef(onUserTurn);
  onUserTurnRef.current = onUserTurn;

  const startListenCycleRef = useRef<() => void>(() => {});

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  const cleanupRecorder = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (hardStopTimerRef.current) { clearTimeout(hardStopTimerRef.current); hardStopTimerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    const recorder = recorderRef.current;
    if (recorder) {
      // Detach handlers BEFORE stopping so the old onstop can't fire
      // transcribeAndEmit with stale chunks from a superseded cycle.
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") { try { recorder.stop(); } catch { /* */ } }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch { /* */ } audioCtxRef.current = null; }
    setAudioLevel(0);
    speechDetectedRef.current = false;
  }, []);

  const cleanupTts = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    const audio = ttsAudioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      ttsAudioRef.current = null;
    }
    if (ttsBlobUrlRef.current) {
      URL.revokeObjectURL(ttsBlobUrlRef.current);
      ttsBlobUrlRef.current = null;
    }
  }, []);

  const transcribeAndEmit = useCallback(async () => {
    if (transcribingRef.current) return;
    if (stoppedRef.current) {
      chunksRef.current = [];
      return;
    }
    transcribingRef.current = true;
    try {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
      chunksRef.current = [];
      if (blob.size < 1500 || !speechDetectedRef.current) {
        setState("listening");
        return;
      }
      setState("thinking");
      const ext = mimeTypeRef.current.includes("webm") ? "webm" : "m4a";
      const file = new File([blob], `recording.${ext}`, { type: mimeTypeRef.current });
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      if (!res.ok) {
        setState("listening");
        return;
      }
      const { text } = await res.json();
      const trimmed = (text || "").trim();
      if (trimmed) {
        setTranscript(trimmed);
        onUserTurnRef.current(trimmed);
      } else {
        setState("listening");
      }
    } catch {
      setState("listening");
    } finally {
      transcribingRef.current = false;
    }
  }, []);

  const startListenCycle = useCallback(async () => {
    if (stoppedRef.current) return;
    setError(null);
    setTranscript("");
    cleanupRecorder();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      mimeTypeRef.current = mimeType;

      const AudioCtxCtor =
        typeof window !== "undefined"
          ? (window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext)
          : undefined;
      if (!AudioCtxCtor) {
        throw new Error("AudioContext is not supported in this browser.");
      }
      const ctx = new AudioCtxCtor();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];
      speechDetectedRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        transcribeAndEmit();
      };
      recorder.start(500);

      setState("listening");

      const stopForSilence = () => {
        if (stoppedRef.current || !recorderRef.current) return;
        if (recorderRef.current.state !== "inactive") {
          try { recorderRef.current.stop(); } catch { /* */ }
        }
      };

      const tick = () => {
        if (stoppedRef.current) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255;
        setAudioLevel(avg);

        if (avg > SPEAKING_LEVEL) {
          speechDetectedRef.current = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (
          speechDetectedRef.current &&
          avg < SILENCE_LEVEL &&
          !silenceTimerRef.current
        ) {
          silenceTimerRef.current = setTimeout(stopForSilence, SILENCE_TIMEOUT_MS);
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      // Hard-stop always fires after MAX_TURN_MS even if the user never spoke,
      // so a silent mic can't hold the pipeline open indefinitely. If no speech
      // was detected, transcribeAndEmit will drop the tiny blob and loop back
      // into listening via startListenCycle on the next turn.
      hardStopTimerRef.current = setTimeout(() => {
        if (!speechDetectedRef.current) {
          // Nothing was said — skip transcription entirely, just restart.
          if (!stoppedRef.current) startListenCycleRef.current();
          return;
        }
        stopForSilence();
      }, MAX_TURN_MS);
    } catch (err) {
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
        setError("Microphone access denied.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to start listening");
      }
      setState("idle");
      stoppedRef.current = true;
    }
  }, [cleanupRecorder, transcribeAndEmit]);

  startListenCycleRef.current = startListenCycle;

  const speak = useCallback(async (text: string) => {
    if (stoppedRef.current || !text.trim()) return;
    cleanupTts();
    setAssistantText(text);
    setState("speaking");

    const abort = new AbortController();
    ttsAbortRef.current = abort;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abort.signal,
      });
      if (!res.ok) {
        await fallbackSpeak(text);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      ttsBlobUrlRef.current = url;
      const audio = new Audio(url);
      ttsAudioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
    } catch {
      if (!abort.signal.aborted) await fallbackSpeak(text);
    } finally {
      cleanupTts();
      if (!stoppedRef.current) startListenCycle();
    }
  }, [cleanupTts, startListenCycle]);

  async function fallbackSpeak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  const start = useCallback(() => {
    stoppedRef.current = false;
    startListenCycle();
  }, [startListenCycle]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    cleanupRecorder();
    cleanupTts();
    setState("idle");
    setTranscript("");
    setAudioLevel(0);
  }, [cleanupRecorder, cleanupTts]);

  const interrupt = useCallback(() => {
    cleanupTts();
    if (!stoppedRef.current) startListenCycle();
  }, [cleanupTts, startListenCycle]);

  useEffect(() => {
    if (!enabled && !stoppedRef.current) stop();
    return () => {
      stoppedRef.current = true;
      cleanupRecorder();
      cleanupTts();
    };
  }, [enabled, stop, cleanupRecorder, cleanupTts]);

  return {
    state,
    transcript,
    assistantText,
    audioLevel,
    error,
    isSupported,
    start,
    stop,
    speak,
    interrupt,
  };
}

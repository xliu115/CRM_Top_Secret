"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type UseStreamingTranscriptionOptions = {
  lang?: string;
  onResult?: (transcript: string) => void;
};

const INTERVAL_MS = 2500;

export function useStreamingTranscription(
  options: UseStreamingTranscriptionOptions = {},
) {
  const { onResult } = options;
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const stoppedRef = useRef(false);
  const mimeTypeRef = useRef("");

  const chunksRef = useRef<Blob[]>([]);
  const lastTranscriptRef = useRef("");
  const busyRef = useRef(false);

  const levelRafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch { /* */ }
      }
    };
  }, []);

  const startAudioLevelMonitor = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (stoppedRef.current) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255;
        setAudioLevel(avg);
        levelRafRef.current = requestAnimationFrame(tick);
      };
      levelRafRef.current = requestAnimationFrame(tick);
    } catch {
      // AudioContext not available
    }
  }, []);

  const transcribeCurrent = useCallback(async () => {
    if (busyRef.current || stoppedRef.current) return;
    if (chunksRef.current.length === 0) return;

    busyRef.current = true;
    try {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
      if (blob.size < 1000) return;

      const ext = mimeTypeRef.current.includes("webm") ? "webm" : "m4a";
      const file = new File([blob], `recording.${ext}`, { type: mimeTypeRef.current });
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 403) {
          setError("Session expired — please refresh your API token");
        }
        return;
      }

      const { text } = await res.json();
      const trimmed = text?.trim() || "";
      if (trimmed && !stoppedRef.current) {
        lastTranscriptRef.current = trimmed;
        setLiveTranscript(trimmed);
      }
    } catch {
      // Transcription failed, will retry next interval
    } finally {
      busyRef.current = false;
    }
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    setLiveTranscript("");
    setDuration(0);
    setAudioLevel(0);
    chunksRef.current = [];
    lastTranscriptRef.current = "";
    stoppedRef.current = false;
    busyRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      mimeTypeRef.current = mimeType;

      startAudioLevelMonitor(stream);

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(500);

      pollTimerRef.current = setInterval(() => {
        transcribeCurrent();
      }, INTERVAL_MS);

      setIsListening(true);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
      ) {
        setError(
          "Microphone access denied. Please allow microphone permission and try again.",
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to start recording",
        );
      }
      setIsListening(false);
    }
  }, [startAudioLevelMonitor, transcribeCurrent]);

  const stopListening = useCallback(async () => {
    stoppedRef.current = true;

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (levelRafRef.current) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = 0;
    }
    setAudioLevel(0);

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    recorderRef.current = null;

    const stream = streamRef.current;
    stream?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* */ }
      audioCtxRef.current = null;
    }

    setIsTranscribing(true);

    while (busyRef.current) {
      await new Promise((r) => setTimeout(r, 100));
    }

    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    let finalTranscript = "";

    if (blob.size >= 1000) {
      try {
        const ext = mimeTypeRef.current.includes("webm") ? "webm" : "m4a";
        const file = new File([blob], `recording.${ext}`, { type: mimeTypeRef.current });
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const { text } = await res.json();
          finalTranscript = text?.trim() || "";
        }
      } catch {
        // Use last known transcript
      }
    }

    if (!finalTranscript) {
      finalTranscript = lastTranscriptRef.current;
    }

    if (finalTranscript.trim()) {
      onResultRef.current?.(finalTranscript.trim());
    }

    setIsTranscribing(false);
    setIsListening(false);
  }, []);

  return {
    isListening,
    isTranscribing,
    transcript: liveTranscript,
    liveTranscript,
    isSupported,
    error,
    duration,
    audioLevel,
    startListening,
    stopListening,
  };
}

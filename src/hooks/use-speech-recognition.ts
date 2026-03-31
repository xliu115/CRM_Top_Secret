"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type UseSpeechRecognitionOptions = {
  lang?: string;
  onResult?: (transcript: string) => void;
};

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
) {
  const { onResult } = options;
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript("");
    setDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 1000) {
          setIsListening(false);
          setIsTranscribing(false);
          return;
        }

        setIsTranscribing(true);
        try {
          const ext = mimeType.includes("webm") ? "webm" : "m4a";
          const file = new File([blob], `recording.${ext}`, { type: mimeType });
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || "Transcription failed");
          }

          const { text } = await res.json();
          if (text?.trim()) {
            setTranscript(text.trim());
            onResultRef.current?.(text.trim());
          }
        } catch (err) {
          console.error("[speech] Transcription failed:", err);
          setError(
            err instanceof Error ? err.message : "Transcription failed",
          );
        } finally {
          setIsTranscribing(false);
          setIsListening(false);
        }
      };

      recorder.start(1000);
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
  }, []);

  const stopListening = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    isListening,
    isTranscribing,
    transcript,
    isSupported,
    error,
    duration,
    startListening,
    stopListening,
  };
}

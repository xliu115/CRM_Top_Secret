"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type UseStreamingTranscriptionOptions = {
  lang?: string;
  onResult?: (transcript: string) => void;
};

type ChunkResult = {
  seq: number;
  text: string;
  resolved: boolean;
};

const CHUNK_MS = 1500;

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export function useStreamingTranscription(
  options: UseStreamingTranscriptionOptions = {},
) {
  const { lang = "en-US", onResult } = options;
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const seqRef = useRef(0);
  const resultsRef = useRef<ChunkResult[]>([]);
  const pendingCountRef = useRef(0);
  const transcriptSoFarRef = useRef("");
  const fullAudioChunksRef = useRef<Blob[]>([]);
  const stoppedRef = useRef(false);
  const resolveAllPendingRef = useRef<(() => void) | null>(null);

  const speechRecRef = useRef<SpeechRecognition | null>(null);
  const interimRef = useRef("");
  const confirmedRef = useRef("");
  const usingSpeechRecRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelRafRef = useRef<number>(0);

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
      if (speechRecRef.current) {
        speechRecRef.current.abort();
        speechRecRef.current = null;
      }
      if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
    };
  }, []);

  const startAudioLevelMonitor = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
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

  const rebuildTranscript = useCallback(() => {
    const results = resultsRef.current;
    let text = "";
    for (let i = 0; i < results.length; i++) {
      if (!results[i].resolved) break;
      text += (text && results[i].text ? " " : "") + results[i].text;
    }
    transcriptSoFarRef.current = text;
    if (!usingSpeechRecRef.current) {
      setLiveTranscript(text);
    }
    return text;
  }, []);

  const sendChunk = useCallback(
    async (blob: Blob, seq: number) => {
      if (usingSpeechRecRef.current) {
        resultsRef.current[seq] = { seq, text: "", resolved: true };
        pendingCountRef.current--;
        if (pendingCountRef.current <= 0) {
          pendingCountRef.current = 0;
          if (resolveAllPendingRef.current) {
            resolveAllPendingRef.current();
            resolveAllPendingRef.current = null;
          }
        }
        return;
      }

      if (blob.size < 1000) {
        resultsRef.current[seq] = { seq, text: "", resolved: true };
        rebuildTranscript();
        pendingCountRef.current--;
        if (pendingCountRef.current <= 0) {
          pendingCountRef.current = 0;
          if (resolveAllPendingRef.current) {
            resolveAllPendingRef.current();
            resolveAllPendingRef.current = null;
          }
        }
        return;
      }

      const mimeType = blob.type;
      const ext = mimeType.includes("webm") ? "webm" : "m4a";
      const file = new File([blob], `chunk-${seq}.${ext}`, { type: mimeType });
      const formData = new FormData();
      formData.append("file", file);

      const promptText = transcriptSoFarRef.current;
      if (promptText) {
        formData.append("prompt", promptText);
      }

      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          if (res.status === 403) {
            setError("Session expired — please refresh your API token");
          }
          resultsRef.current[seq] = { seq, text: "", resolved: true };
        } else {
          const { text } = await res.json();
          resultsRef.current[seq] = {
            seq,
            text: text?.trim() || "",
            resolved: true,
          };
        }
      } catch {
        resultsRef.current[seq] = { seq, text: "", resolved: true };
      } finally {
        pendingCountRef.current--;
        if (pendingCountRef.current < 0) pendingCountRef.current = 0;
        rebuildTranscript();
        if (pendingCountRef.current === 0 && resolveAllPendingRef.current) {
          resolveAllPendingRef.current();
          resolveAllPendingRef.current = null;
        }
      }
    },
    [rebuildTranscript],
  );

  const startSpeechRecognition = useCallback(
    () => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return false;

      try {
        const recognition = new Ctor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let confirmed = "";
          let interim = "";

          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              confirmed += result[0].transcript;
            } else {
              interim += result[0].transcript;
            }
          }

          confirmedRef.current = confirmed;
          interimRef.current = interim;

          const display = (confirmed + interim).trim();
          setLiveTranscript(display);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error === "no-speech" || event.error === "aborted") return;
          usingSpeechRecRef.current = false;
        };

        recognition.onend = () => {
          if (!stoppedRef.current && usingSpeechRecRef.current) {
            try { recognition.start(); } catch { /* already stopped */ }
          }
        };

        recognition.start();
        speechRecRef.current = recognition;
        usingSpeechRecRef.current = true;
        return true;
      } catch {
        return false;
      }
    },
    [lang],
  );

  const startListening = useCallback(async () => {
    setError(null);
    setLiveTranscript("");
    setDuration(0);
    setAudioLevel(0);
    seqRef.current = 0;
    resultsRef.current = [];
    pendingCountRef.current = 0;
    transcriptSoFarRef.current = "";
    fullAudioChunksRef.current = [];
    stoppedRef.current = false;
    confirmedRef.current = "";
    interimRef.current = "";
    usingSpeechRecRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      startAudioLevelMonitor(stream);
      startSpeechRecognition();

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          fullAudioChunksRef.current.push(e.data);

          if (!stoppedRef.current) {
            const seq = seqRef.current++;
            resultsRef.current[seq] = { seq, text: "", resolved: false };
            pendingCountRef.current++;
            sendChunk(e.data, seq);
          }
        }
      };

      recorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (levelRafRef.current) {
          cancelAnimationFrame(levelRafRef.current);
          levelRafRef.current = 0;
        }
        setAudioLevel(0);

        const hadSpeechRec = usingSpeechRecRef.current;

        if (speechRecRef.current) {
          speechRecRef.current.abort();
          speechRecRef.current = null;
        }

        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        stoppedRef.current = true;

        if (hadSpeechRec) {
          const srText = (confirmedRef.current + interimRef.current).trim();
          if (srText) {
            onResultRef.current?.(srText);
            usingSpeechRecRef.current = false;
            setIsListening(false);
            return;
          }
        }

        setIsTranscribing(true);

        if (pendingCountRef.current > 0) {
          await new Promise<void>((resolve) => {
            resolveAllPendingRef.current = resolve;
          });
        }

        let finalTranscript = transcriptSoFarRef.current;

        if (!finalTranscript.trim()) {
          const fullBlob = new Blob(fullAudioChunksRef.current, { type: mimeType });
          if (fullBlob.size >= 1000) {
            try {
              const file = new File(
                [fullBlob],
                `recording.${mimeType.includes("webm") ? "webm" : "m4a"}`,
                { type: mimeType },
              );
              const formData = new FormData();
              formData.append("file", file);
              const res = await fetch("/api/transcribe", {
                method: "POST",
                body: formData,
              });
              if (res.ok) {
                const { text } = await res.json();
                if (text?.trim()) {
                  finalTranscript = text.trim();
                }
              }
            } catch {
              // Fallback also failed
            }
          }
        }

        if (finalTranscript.trim()) {
          onResultRef.current?.(finalTranscript.trim());
        }

        usingSpeechRecRef.current = false;
        setIsTranscribing(false);
        setIsListening(false);
      };

      recorder.start(CHUNK_MS);
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
  }, [sendChunk, startSpeechRecognition, startAudioLevelMonitor]);

  const stopListening = useCallback(() => {
    stoppedRef.current = true;
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

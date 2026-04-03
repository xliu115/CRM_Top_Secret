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

  const rebuildTranscript = useCallback(() => {
    const results = resultsRef.current;
    let text = "";
    for (let i = 0; i < results.length; i++) {
      if (!results[i].resolved) break;
      text += (text && results[i].text ? " " : "") + results[i].text;
    }
    transcriptSoFarRef.current = text;
    setLiveTranscript(text);
    return text;
  }, []);

  const sendChunk = useCallback(
    async (blob: Blob, seq: number) => {
      if (blob.size < 1000) {
        resultsRef.current[seq] = { seq, text: "", resolved: true };
        rebuildTranscript();
        return;
      }

      pendingCountRef.current++;
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
        rebuildTranscript();
        if (pendingCountRef.current === 0 && resolveAllPendingRef.current) {
          resolveAllPendingRef.current();
          resolveAllPendingRef.current = null;
        }
      }
    },
    [rebuildTranscript],
  );

  const startListening = useCallback(async () => {
    setError(null);
    setLiveTranscript("");
    setDuration(0);
    seqRef.current = 0;
    resultsRef.current = [];
    pendingCountRef.current = 0;
    transcriptSoFarRef.current = "";
    fullAudioChunksRef.current = [];
    stoppedRef.current = false;

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

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          fullAudioChunksRef.current.push(e.data);

          if (!stoppedRef.current) {
            const seq = seqRef.current++;
            resultsRef.current[seq] = { seq, text: "", resolved: false };
            sendChunk(e.data, seq);
          }
        }
      };

      recorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        stoppedRef.current = true;

        setIsTranscribing(true);

        if (pendingCountRef.current > 0) {
          await new Promise<void>((resolve) => {
            resolveAllPendingRef.current = resolve;
          });
        }

        const finalTranscript = transcriptSoFarRef.current;

        if (finalTranscript.trim()) {
          onResultRef.current?.(finalTranscript.trim());
        } else {
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
                  onResultRef.current?.(text.trim());
                }
              }
            } catch {
              // Fallback also failed
            }
          }
        }

        setIsTranscribing(false);
        setIsListening(false);
      };

      recorder.start(3000);
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
  }, [sendChunk]);

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
    startListening,
    stopListening,
  };
}

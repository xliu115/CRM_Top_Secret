"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = {
  error: string;
  message?: string;
};

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as Record<string, SpeechRecognitionCtor>)
      .SpeechRecognition ??
    (window as unknown as Record<string, SpeechRecognitionCtor>)
      .webkitSpeechRecognition ??
    null
  );
}

type UseSpeechRecognitionOptions = {
  lang?: string;
  onResult?: (transcript: string) => void;
};

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
) {
  const { lang = "en-US", onResult } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    setIsSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const stoppedByUserRef = useRef(false);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    recognitionRef.current?.abort();
    stoppedByUserRef.current = false;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    setError(null);
    setTranscript("");
    setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setTranscript(final || interim);

      if (final) {
        stoppedByUserRef.current = true;
        recognition.stop();
        onResultRef.current?.(final.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") return;
      if (event.error === "no-speech") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access denied. Please allow microphone permission and try again.");
        setIsListening(false);
        return;
      }
      setError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (!stoppedByUserRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
          return;
        } catch {
          // browser refused restart
        }
      }
      setIsListening(false);
    };

    recognition.start();
  }, [lang]);

  const stopListening = useCallback(() => {
    stoppedByUserRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
  };
}

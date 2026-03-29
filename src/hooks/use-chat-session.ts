"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

export type ChatSource = {
  type: string;
  content: string;
  date?: string;
  id?: string;
  url?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
};

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingVoiceRef = useRef<string | null>(null);

  const handleVoiceResult = useCallback((transcript: string) => {
    pendingVoiceRef.current = transcript;
    setInput(transcript);
  }, []);

  const {
    isListening,
    transcript: liveTranscript,
    isSupported: voiceSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition({ onResult: handleVoiceResult });

  function buildHistory(): { role: "user" | "assistant"; content: string }[] {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  const handleSend = useCallback(
    async (message?: string) => {
      const text = (message ?? input).trim();
      if (!text || loading) return;

      setInput("");
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to get response");
        }
        const { answer, sources } = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: answer,
            sources: sources ?? [],
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "Sorry, I couldn't process your request. Please try again.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages]
  );

  useEffect(() => {
    if (pendingVoiceRef.current && !isListening) {
      const text = pendingVoiceRef.current;
      pendingVoiceRef.current = null;
      handleSend(text);
    }
  }, [isListening, handleSend]);

  useEffect(() => {
    if (isListening && liveTranscript) {
      setInput(liveTranscript);
    }
  }, [isListening, liveTranscript]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  function handleClearChat() {
    setMessages([]);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function prependMessage(msg: ChatMessage) {
    setMessages((prev) => [msg, ...prev]);
  }

  return {
    messages,
    input,
    setInput,
    loading,
    scrollRef,
    inputRef,
    handleSend,
    handleClearChat,
    handleKeyDown,
    prependMessage,
    isListening,
    liveTranscript,
    voiceSupported,
    startListening,
    stopListening,
  };
}

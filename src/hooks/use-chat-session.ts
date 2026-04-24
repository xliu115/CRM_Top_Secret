"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useStreamingTranscription } from "@/hooks/use-streaming-transcription";
import type { ChatBlock } from "@/lib/types/chat-blocks";

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
  blocks?: ChatBlock[];
  viaCall?: boolean;
};

export type PendingAction = {
  type: "dismiss_nudge" | "snooze_nudge" | "send_email";
  nudgeId: string;
  contactId: string;
  contactName: string;
  emailData?: { subject: string; body: string };
};

export type ChatContext = {
  nudgeId?: string;
  contactId?: string;
  meetingId?: string;
  pendingAction?: PendingAction;
  callMode?: boolean;
  currentSubject?: string;
  currentBody?: string;
  editDraftId?: string;
};

export type ChatMode = "chat" | "call";

export type SendOptions = ChatContext & {
  viaCall?: boolean;
};

export type SendMessageFn = (message: string, ctx?: SendOptions) => unknown;

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingVoiceRef = useRef<string | null>(null);

  const handleVoiceResult = useCallback((transcript: string) => {
    pendingVoiceRef.current = transcript;
    setInput(transcript);
  }, []);

  const {
    isListening,
    isTranscribing,
    transcript: liveTranscript,
    isSupported: voiceSupported,
    duration: voiceDuration,
    audioLevel: voiceAudioLevel,
    startListening,
    stopListening,
  } = useStreamingTranscription({ onResult: handleVoiceResult });

  const handleSend = useCallback(
    async (message?: string, context?: SendOptions): Promise<ChatMessage | null> => {
      const text = (message ?? input).trim();
      if (!text || loading) return null;

      setInput("");
      const viaCall = context?.viaCall === true;
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        viaCall,
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const payload: Record<string, unknown> = { message: text, history };
        if (context) {
          const { viaCall: _viaCall, ...chatContext } = context;
          void _viaCall;
          if (Object.keys(chatContext).length > 0) payload.context = chatContext;
        }
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to get response");
        }
        const { answer, sources, blocks } = await res.json();
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answer,
          sources: sources ?? [],
          blocks: Array.isArray(blocks) && blocks.length > 0 ? blocks : undefined,
          viaCall,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        return assistantMsg;
      } catch {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I couldn't process your request. Please try again.",
          viaCall,
        };
        setMessages((prev) => [...prev, errorMsg]);
        return errorMsg;
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages]
  );

  useEffect(() => {
    if (pendingVoiceRef.current && !isListening && !isTranscribing) {
      const text = pendingVoiceRef.current;
      pendingVoiceRef.current = null;
      handleSend(text);
    }
  }, [isListening, isTranscribing, handleSend]);

  useEffect(() => {
    // Prefer scrolling so the latest CTA row sits above the input/keyboard.
    // Falls back to the trailing scroll sentinel when no action bar is in view.
    requestAnimationFrame(() => {
      const ctaRows = document.querySelectorAll<HTMLElement>("[data-cta-row]");
      const latestCta = ctaRows[ctaRows.length - 1];
      if (latestCta) {
        latestCta.scrollIntoView({ block: "end", behavior: "smooth" });
      } else {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    });
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
    mode,
    setMode,
    scrollRef,
    inputRef,
    handleSend,
    handleClearChat,
    handleKeyDown,
    prependMessage,
    isListening,
    isTranscribing,
    liveTranscript,
    voiceSupported,
    voiceDuration,
    voiceAudioLevel,
    startListening,
    stopListening,
  };
}

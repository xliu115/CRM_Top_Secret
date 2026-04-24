"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Phone, Mic, MicOff, Loader2 } from "lucide-react";
import { useConversationalVoice } from "@/hooks/use-conversational-voice";
import { parseVoiceIntent } from "@/lib/utils/parse-voice-intent";
import { BlockRenderer } from "@/components/chat/blocks/block-renderer";
import type { ChatMessage, PendingAction } from "@/hooks/use-chat-session";
import type { ChatBlock } from "@/lib/types/chat-blocks";

type Props = {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (message: string, context?: { viaCall?: boolean; callMode?: boolean; pendingAction?: PendingAction }) => Promise<ChatMessage | null>;
  onConfirmAction?: (action: PendingAction) => void;
};

function stripMarkdown(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function spokenLead(text: string, maxSentences = 2): string {
  const stripped = stripMarkdown(text);
  if (!stripped) return "";
  const sentences = stripped.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [stripped];
  return sentences.slice(0, maxSentences).join(" ").trim();
}

export function CallMarvinOverlay({
  open,
  onClose,
  messages,
  onSend,
  onConfirmAction,
}: Props) {
  const lastSpokenIdRef = useRef<string | null>(null);
  const awaitingReplyRef = useRef(false);

  const handleUserTurn = useCallback(
    async (transcript: string) => {
      if (awaitingReplyRef.current) return;
      const intent = parseVoiceIntent(transcript);
      if (intent.kind === "hangup") {
        onClose();
        return;
      }

      awaitingReplyRef.current = true;
      try {
        const assistantMsg = await onSend(transcript, { viaCall: true, callMode: true });
        if (assistantMsg) {
          const lead = spokenLead(assistantMsg.content, 2);
          if (lead) {
            lastSpokenIdRef.current = assistantMsg.id;
            voice.speak(lead);
          } else if (assistantMsg.blocks && assistantMsg.blocks.length > 0) {
            voice.speak("Here's what I found. Take a look.");
          }
        }
      } finally {
        awaitingReplyRef.current = false;
      }
    },
    // voice.speak is stable via ref below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSend, onClose],
  );

  const voice = useConversationalVoice({
    onUserTurn: handleUserTurn,
    enabled: open,
  });

  useEffect(() => {
    if (open) voice.start();
    else voice.stop();
  }, [open, voice]);

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);

  const displayBlocks: ChatBlock[] | undefined = lastAssistant?.blocks;
  const displayText = lastAssistant ? stripMarkdown(lastAssistant.content) : "";

  if (!open) return null;

  const level = Math.min(1, voice.audioLevel * 2.5);
  const ringScale = 1 + level * 0.6;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-2">
          <div className="relative h-2 w-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {voice.state === "listening" && "Listening"}
            {voice.state === "thinking" && "Thinking"}
            {voice.state === "speaking" && "Marvin"}
            {voice.state === "idle" && "Connecting"}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted"
        >
          Back to chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 py-8">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full bg-primary/10 transition-transform duration-150"
              style={{ transform: `scale(${ringScale})` }}
            />
            <div
              className="absolute inset-3 rounded-full bg-primary/20 transition-transform duration-200"
              style={{ transform: `scale(${1 + level * 0.3})` }}
            />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              {voice.state === "thinking" ? (
                <Loader2 className="h-9 w-9 animate-spin" />
              ) : voice.state === "listening" ? (
                <Mic className="h-10 w-10" />
              ) : voice.state === "speaking" ? (
                <span className="text-2xl font-semibold tracking-tight">M</span>
              ) : (
                <MicOff className="h-10 w-10" />
              )}
            </div>
          </div>

          <div className="min-h-[64px] text-center">
            {voice.transcript ? (
              <p className="text-sm text-muted-foreground">&ldquo;{voice.transcript}&rdquo;</p>
            ) : voice.state === "speaking" && displayText ? (
              <p className="text-base leading-relaxed text-foreground">{displayText.slice(0, 240)}</p>
            ) : voice.state === "listening" ? (
              <p className="text-sm text-muted-foreground">Say anything — or ask about a contact.</p>
            ) : voice.state === "thinking" ? (
              <p className="text-sm text-muted-foreground">One moment…</p>
            ) : voice.error ? (
              <p className="text-sm text-destructive">{voice.error}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Connecting to Marvin…</p>
            )}
          </div>

          {displayBlocks && displayBlocks.length > 0 && (
            <div className="w-full">
              <BlockRenderer
                blocks={displayBlocks}
                onSendMessage={(m) => onSend(m, { viaCall: true, callMode: true })}
                onConfirmAction={onConfirmAction}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-border/50 bg-background/80 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={voice.interrupt}
          disabled={voice.state !== "speaking"}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-background/60 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted disabled:opacity-40"
        >
          <Mic className="h-4 w-4" />
          Interrupt
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Hang up"
        >
          <Phone className="h-6 w-6 rotate-[135deg]" />
        </button>
        <div className="flex-1" />
      </div>
    </div>
  );
}

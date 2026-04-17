"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Send, Loader2, Sparkles, Mic, MicOff, Trash2, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AssistantReply } from "@/components/chat/assistant-reply";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { useChatSession, type ChatMessage, type PendingAction } from "@/hooks/use-chat-session";
import { useBriefingAudio } from "@/hooks/use-briefing-audio";
import { BriefingAudioControls } from "@/components/voice/briefing-audio-controls";
import { buildBriefingSpokenOpening } from "@/lib/utils/briefing-spoken-opening";
import { prepareBriefingForTTS } from "@/lib/utils/tts-prepare";
import { LiveTranscriptPreview } from "@/components/voice/live-transcript-preview";

type BriefingData = {
  briefing: string;
  topActions: { contactName: string; company: string; actionLabel: string; detail: string; deeplink: string; contactId?: string }[];
  structured: {
    nudges: { contactName: string; company: string; contactId: string; ruleType?: string }[];
    meetings: { title: string; startTime: string; meetingId: string }[];
    news?: { content: string; contactName?: string; company?: string }[];
  };
};

function extractContactNames(data: BriefingData): string[] {
  const names = new Set<string>();
  data.topActions?.forEach((a) => {
    if (a.company === "Campaign" || a.company === "Article Campaign") return;
    if (a.deeplink?.startsWith("/meetings") || a.deeplink?.startsWith("/campaigns")) return;
    if (/\bmeeting\b/i.test(a.actionLabel)) return;
    names.add(a.contactName);
  });
  data.structured?.nudges?.forEach((n) => {
    if (n.company === "Campaign" || n.company === "Article Campaign") return;
    if (n.ruleType === "MEETING_PREP" || n.ruleType === "CAMPAIGN_APPROVAL" || n.ruleType === "ARTICLE_CAMPAIGN") return;
    names.add(n.contactName);
  });
  return Array.from(names).slice(0, 3);
}

type QuickActionItem = { label: string; query: string };

function getInitialSuggestions(data: BriefingData | null): QuickActionItem[] {
  const suggestions: QuickActionItem[] = [];
  const hour = new Date().getHours();

  if (data?.structured?.meetings?.length) {
    const next = data.structured.meetings[0];
    suggestions.push({
      label: `Prep for ${next.title.length > 22 ? next.title.slice(0, 22) + "..." : next.title}`,
      query: `Prepare me for the ${next.title} meeting`,
    });
  }

  if (data) {
    const contacts = extractContactNames(data);
    contacts.slice(0, 2).forEach((name) => {
      suggestions.push({
        label: `Quick 360: ${name}`,
        query: `Quick 360 for ${name}`,
      });
    });
  }

  if (hour < 12) {
    suggestions.push({ label: "My meetings today", query: "Show my meetings today" });
  }

  suggestions.push({ label: "What should I do today?", query: "What should I do today?" });
  suggestions.push({ label: "Who needs attention?", query: "Which contacts need attention?" });

  return suggestions.slice(0, 5);
}

const QUICK_ACTIONS_RE = /<!--QUICK_ACTIONS:([\s\S]*?)-->/;

function extractInlineActions(content: string): QuickActionItem[] {
  const match = content.match(QUICK_ACTIONS_RE);
  if (!match) return [];
  try {
    return JSON.parse(match[1]) as QuickActionItem[];
  } catch {
    return [];
  }
}

function deduplicateActions(
  actions: QuickActionItem[],
  usedQueries: Set<string>,
): QuickActionItem[] {
  const seen = new Set<string>();
  const result: QuickActionItem[] = [];
  for (const a of actions) {
    const key = a.query.toLowerCase();
    if (usedQueries.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(a);
  }
  return result;
}

export default function MobilePage() {
  const { data: session } = useSession();
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const briefingLoadedRef = useRef(false);

  const {
    messages,
    input,
    setInput,
    loading,
    scrollRef,
    inputRef,
    handleSend,
    handleClearChat,
    handleKeyDown,
    isListening,
    isTranscribing,
    liveTranscript,
    voiceSupported,
    voiceDuration,
    voiceAudioLevel,
    startListening,
    stopListening,
    prependMessage,
  } = useChatSession();

  function handleConfirmAction(action: PendingAction) {
    const label = action.type === "dismiss_nudge" ? "Confirm dismiss"
      : action.type === "snooze_nudge" ? "Confirm snooze"
      : "Confirm send";
    handleSend(label, { pendingAction: action });
  }

  const briefingAudio = useBriefingAudio();

  const partnerName = session?.user?.name?.split(" ")[0] ?? "there";

  const briefingSpokenOpening = useMemo(
    () =>
      briefingData ? buildBriefingSpokenOpening(briefingData, partnerName) : null,
    [briefingData, partnerName],
  );

  const handlePlayBriefing = useCallback(() => {
    if (!briefingData) return;
    const ttsText = prepareBriefingForTTS(
      briefingData.briefing,
      briefingData.topActions,
      briefingSpokenOpening
        ? { spokenOpening: briefingSpokenOpening }
        : undefined,
    );
    briefingAudio.play(ttsText);
  }, [briefingData, briefingAudio, briefingSpokenOpening]);

  useEffect(() => {
    if (briefingLoadedRef.current) return;
    briefingLoadedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/dashboard/briefing");
        if (!res.ok) throw new Error("Failed to load briefing");
        const data: BriefingData = await res.json();
        setBriefingData(data);

        if (data.briefing) {
          const briefingMsg: ChatMessage = {
            id: "briefing-" + crypto.randomUUID(),
            role: "assistant",
            content: data.briefing,
          };
          prependMessage(briefingMsg);
        }
      } catch {
        // Briefing failed, chat still works
      } finally {
        setBriefingLoading(false);
      }
    })();
  }, [prependMessage]);

  const usedQueries = useMemo(() => {
    const set = new Set<string>();
    messages.forEach((m) => {
      if (m.role === "user") set.add(m.content.toLowerCase());
    });
    return set;
  }, [messages]);

  const activeQuickActions = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const inlineActions = lastAssistant ? extractInlineActions(lastAssistant.content) : [];
    const initialActions = getInitialSuggestions(briefingData);

    const combined = inlineActions.length > 0
      ? [...inlineActions, ...initialActions]
      : initialActions;

    return deduplicateActions(combined, usedQueries).slice(0, 5);
  }, [messages, briefingData, usedQueries]);

  const hasMessages = messages.length > 0;

  return (
    <MobileShell>
      <div className="flex h-full flex-col">
        {/* Scrollable feed */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-5 px-4 py-4">
            {briefingLoading && !hasMessages && (
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 pt-2.5">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[15px] text-muted-foreground-subtle">
                    Preparing your briefing...
                  </span>
                </div>
              </div>
            )}

            {!briefingLoading && !hasMessages && (
              <div className="flex flex-col items-center justify-center gap-4 pt-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                  🐦
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground">
                    Hi {partnerName}
                  </h2>
                  <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
                    Ask me anything about your clients, meetings, or contacts.
                  </p>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                {msg.role === "assistant" ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base">
                    🐦
                  </div>
                ) : (
                  <Avatar name={session?.user?.name || "User"} size="sm" />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground-subtle">
                    {msg.role === "assistant"
                      ? "Activate"
                      : session?.user?.name || "You"}
                  </p>
                  <div
                    className={
                      msg.role === "user"
                        ? "rounded-xl bg-primary/5 px-3.5 py-3 text-[15px] leading-relaxed text-foreground"
                        : ""
                    }
                  >
                    {msg.role === "assistant" ? (
                      msg.id.startsWith("briefing-") ? (
                        <div>
                          {briefingSpokenOpening && (
                            <div className="mb-3 rounded-xl border border-primary/15 bg-primary/5 px-3.5 py-3">
                              <p className="text-[11px] font-medium uppercase tracking-wider text-primary/80">
                                At a glance · great for listening
                              </p>
                              <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                                {briefingSpokenOpening}
                              </p>
                            </div>
                          )}
                          <MarkdownContent
                            content={msg.content}
                            className="text-[15px] leading-relaxed text-foreground"
                          />
                          <BriefingAudioControls
                            isPlaying={briefingAudio.isPlaying}
                            isPaused={briefingAudio.isPaused}
                            isLoading={briefingAudio.isLoading}
                            elapsed={briefingAudio.elapsed}
                            duration={briefingAudio.duration}
                            onPlay={handlePlayBriefing}
                            onPause={briefingAudio.pause}
                            onResume={briefingAudio.resume}
                            onStop={briefingAudio.stop}
                          />
                        </div>
                      ) : (
                        <AssistantReply
                          content={msg.content}
                          sources={msg.sources ?? []}
                          blocks={msg.blocks}
                          onSendMessage={handleSend}
                          onConfirmAction={handleConfirmAction}
                          mobile
                        />
                      )
                    ) : (
                      <span className="text-[15px] leading-relaxed">{msg.content}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  🐦
                </div>
                <div className="flex items-center gap-2 pt-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-[15px] text-muted-foreground-subtle">
                    Searching your data & the web...
                  </span>
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        </div>

        <LiveTranscriptPreview
          transcript={liveTranscript}
          isListening={isListening}
          duration={voiceDuration}
          audioLevel={voiceAudioLevel}
        />

        {/* Bottom area: quick actions + input */}
        <div
          className="shrink-0 border-t border-border bg-card"
          style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
        >
          {/* Quick action pills — unified, thread-aware */}
          {activeQuickActions.length > 0 && !loading && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
              {activeQuickActions.map((action) => (
                <button
                  key={action.query}
                  type="button"
                  onClick={() => handleSend(action.query)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-2.5 text-[13px] font-medium text-primary transition-colors active:bg-primary/15 active:scale-[0.97]"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="px-3 pb-1.5 pt-0.5">
            {hasMessages && (
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground-subtle transition-colors active:bg-muted"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your clients..."
                disabled={loading}
                rows={1}
                className="flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                style={{ maxHeight: "120px", fontSize: "16px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
              {voiceSupported && (
                <div className="flex items-center gap-1.5">
                  {isListening && voiceDuration > 0 && (
                    <span className="text-xs font-mono text-destructive tabular-nums">
                      {Math.floor(voiceDuration / 60)}:{String(voiceDuration % 60).padStart(2, "0")}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant={isListening ? "destructive" : isTranscribing ? "secondary" : "ghost"}
                    size="icon"
                    disabled={loading || isTranscribing}
                    onClick={isListening ? stopListening : startListening}
                    className={`h-11 w-11 shrink-0 relative ${
                      isListening ? "animate-pulse" : isTranscribing ? "" : "text-muted-foreground-subtle hover:text-foreground"
                    }`}
                    title={isTranscribing ? "Transcribing..." : isListening ? "Stop recording" : "Voice input"}
                  >
                    {isTranscribing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : loading ? (
                      <MicOff className="h-5 w-5" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                    {isListening && (
                      <span className="absolute inset-0 rounded-lg border-2 border-destructive animate-ping opacity-30" />
                    )}
                  </Button>
                </div>
              )}
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                size="icon"
                className="h-11 w-11 shrink-0"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Send, Loader2, Sparkles, Mic, MicOff, Trash2, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AssistantReply } from "@/components/chat/assistant-reply";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { useChatSession } from "@/hooks/use-chat-session";
import type { VoiceOutlineSegment } from "@/components/voice-memo/voice-memo-client-briefing";
import { MobileBriefingListen } from "@/components/mobile/mobile-briefing-listen";
import {
  getDemoStructuredBriefing,
  getDemoVoiceOutline,
} from "@/lib/constants/mobile-demo-briefing";
import type { ApiStructuredBriefing } from "@/lib/services/structured-briefing";

type BriefingData = {
  briefing: string;
  topActions: { contactName: string; company: string; actionLabel: string; detail: string; deeplink: string; contactId?: string }[];
  voiceMemo: {
    audioUrl: string;
    durationMs: number;
    segments: Array<{
      id: string;
      headline: string;
      startMs: number;
      endMs: number;
      deeplink?: string;
    }>;
  } | null;
  voiceOutline: VoiceOutlineSegment[];
  dataDrivenSummary?: string;
  structured: ApiStructuredBriefing;
};

function extractContactNames(data: BriefingData): string[] {
  const names = new Set<string>();
  data.topActions?.forEach((a) => names.add(a.contactName));
  data.structured?.nudges?.forEach((n) => names.add(n.contactName));
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
    voiceSupported,
    voiceDuration,
    startListening,
    stopListening,
  } = useChatSession();

  useEffect(() => {
    if (briefingLoadedRef.current) return;
    briefingLoadedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/dashboard/briefing", {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error("Failed to load briefing");
        const raw = (await res.json()) as Record<string, unknown>;
        const st = raw.structured as ApiStructuredBriefing | undefined;
        const data: BriefingData = {
          ...(raw as unknown as BriefingData),
          voiceOutline: Array.isArray(raw.voiceOutline)
            ? (raw.voiceOutline as VoiceOutlineSegment[])
            : [],
          structured: {
            nudges: Array.isArray(st?.nudges) ? st!.nudges : [],
            meetings: Array.isArray(st?.meetings) ? st!.meetings : [],
            news: Array.isArray(st?.news) ? st!.news : [],
          },
        };
        setBriefingData(data);
      } catch (e) {
        console.error("[mobile] briefing fetch failed:", e);
      } finally {
        setBriefingLoading(false);
      }
    })();
  }, []);

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

  const partnerName = session?.user?.name?.split(" ")[0] ?? "there";
  const partnerDisplayName = session?.user?.name ?? "Partner";
  const hasMessages = messages.length > 0;

  const hasStructuredData = useMemo(() => {
    const s = briefingData?.structured;
    if (!s) return false;
    return (
      (s.nudges?.length ?? 0) > 0 ||
      (s.meetings?.length ?? 0) > 0 ||
      (s.news?.length ?? 0) > 0
    );
  }, [briefingData]);

  const displayStructured = useMemo((): ApiStructuredBriefing => {
    if (hasStructuredData && briefingData?.structured) return briefingData.structured;
    return getDemoStructuredBriefing();
  }, [hasStructuredData, briefingData]);

  const isLiveSummary = Boolean(briefingData) && hasStructuredData;

  const voiceOutline = useMemo((): VoiceOutlineSegment[] => {
    if (briefingData?.voiceOutline?.length) return briefingData.voiceOutline;
    if (!hasStructuredData) return getDemoVoiceOutline(partnerName);
    return [];
  }, [briefingData?.voiceOutline, hasStructuredData, partnerName]);

  return (
    <MobileShell>
      <div className="flex h-full flex-col">
        {/* Scrollable feed */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-5 px-4 py-4">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle">
                  Today&apos;s summary
                </p>
                {!isLiveSummary && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Sample
                  </span>
                )}
                {briefingLoading && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3 animate-pulse text-primary" />
                    Updating with your data…
                  </span>
                )}
              </div>
              <p className="mb-3 text-[13px] text-muted-foreground leading-snug">
                One briefing audio — use the text sections to jump to that moment.
              </p>
              <MobileBriefingListen
                partnerDisplayName={partnerDisplayName}
                structured={displayStructured}
                voiceOutline={voiceOutline}
                voiceMemo={briefingData?.voiceMemo ?? null}
                isPlaceholder={!isLiveSummary}
              />
            </section>

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
                        <MarkdownContent
                          content={msg.content}
                          className="text-[15px] leading-relaxed text-foreground"
                        />
                      ) : (
                        <AssistantReply
                          content={msg.content}
                          sources={msg.sources ?? []}
                          onSendMessage={handleSend}
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

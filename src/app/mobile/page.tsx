"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Send, Loader2, Sparkles, Mic, MicOff, ChevronRight, ChevronDown, ChevronUp, Phone, Calendar, Mail, ListTodo, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useSession } from "next-auth/react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { Button } from "@/components/ui/button";
import { AssistantReply } from "@/components/chat/assistant-reply";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { useChatSession, type ChatMessage, type PendingAction } from "@/hooks/use-chat-session";
import { useBriefingAudio } from "@/hooks/use-briefing-audio";
import { BriefingAudioControls } from "@/components/voice/briefing-audio-controls";
import { buildBriefingSpokenOpening } from "@/lib/utils/briefing-spoken-opening";
import { prepareBriefingForTTS } from "@/lib/utils/tts-prepare";
import { LiveTranscriptPreview } from "@/components/voice/live-transcript-preview";
import { CallMarvinOverlay } from "@/components/voice/call-marvin-overlay";
import { StickyActionBar } from "@/components/chat/sticky-action-bar";

type BriefingData = {
  briefing: string;
  topActions: { contactName: string; company: string; actionLabel: string; detail: string; deeplink: string; contactId?: string }[];
  structured: {
    nudges: { contactName: string; company: string; contactId: string; ruleType?: string }[];
    meetings: { title: string; startTime: string; meetingId: string }[];
    news?: { content: string; contactName?: string; company?: string }[];
  };
};

type ContactDraftTarget = {
  name: string;
  company?: string;
  isFollowUp: boolean;
};

function extractContactDraftTargets(data: BriefingData): ContactDraftTarget[] {
  // Walk nudges first so we capture ruleType context (FOLLOW_UP vs other),
  // then top actions for any partner-specific outreach the briefing
  // surfaces. We dedupe by full contact name and let the first occurrence
  // win — nudges always run first because that's where ruleType lives.
  const byName = new Map<string, ContactDraftTarget>();

  data.structured?.nudges?.forEach((n) => {
    if (n.company === "Campaign" || n.company === "Article Campaign") return;
    if (
      n.ruleType === "MEETING_PREP" ||
      n.ruleType === "CAMPAIGN_APPROVAL" ||
      n.ruleType === "ARTICLE_CAMPAIGN"
    ) {
      return;
    }
    if (!byName.has(n.contactName)) {
      byName.set(n.contactName, {
        name: n.contactName,
        company: n.company || undefined,
        isFollowUp: n.ruleType === "FOLLOW_UP",
      });
    }
  });

  data.topActions?.forEach((a) => {
    if (a.company === "Campaign" || a.company === "Article Campaign") return;
    if (a.deeplink?.startsWith("/meetings") || a.deeplink?.startsWith("/campaigns")) return;
    if (/\bmeeting\b/i.test(a.actionLabel)) return;
    if (!byName.has(a.contactName)) {
      // No ruleType on topActions — best-effort sniff at the action label.
      byName.set(a.contactName, {
        name: a.contactName,
        company: a.company || undefined,
        isFollowUp: /\bfollow[- ]?up\b/i.test(a.actionLabel),
      });
    }
  });

  return Array.from(byName.values()).slice(0, 3);
}

// Pre-action picker rows use a richer shape than the flat horizontal pill
// row (which still renders QuickActionItem). Two-line layout: action verb
// on top, subject context below, with leading icon and optional chip.
type RichActionItem = {
  query: string;
  actionLine: string;
  subjectLine?: string;
  leadingIcon: LucideIcon;
  trailingMeta?: string;
};

function formatMeetingTime(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getInitialPickerActions(data: BriefingData | null): RichActionItem[] {
  const items: RichActionItem[] = [];
  const hour = new Date().getHours();

  // 1. Next meeting prep
  if (data?.structured?.meetings?.length) {
    const next = data.structured.meetings[0];
    const time = formatMeetingTime(next.startTime);
    items.push({
      actionLine: "Prep client meeting",
      subjectLine: time ? `${next.title} — ${time}` : next.title,
      leadingIcon: Calendar,
      query: `Prepare me for the ${next.title} meeting`,
    });
  }

  // 2-3. Per-contact draft email rows
  if (data) {
    const targets = extractContactDraftTargets(data);
    targets.slice(0, 2).forEach(({ name, company, isFollowUp }) => {
      items.push({
        actionLine: isFollowUp ? "View drafted follow-up email" : "View drafted email",
        subjectLine: company ? `${name} · ${company}` : name,
        leadingIcon: Mail,
        trailingMeta: isFollowUp ? "Follow-up" : undefined,
        query: isFollowUp
          ? `Draft a follow up email to ${name}`
          : `Draft an email to ${name}`,
      });
    });
  }

  // 4. Today's meetings (mornings only)
  if (hour < 12) {
    const meetings = data?.structured?.meetings ?? [];
    const upcoming = meetings[0];
    const subject =
      meetings.length > 0 && upcoming
        ? `${meetings.length} meeting${meetings.length === 1 ? "" : "s"}${
            formatMeetingTime(upcoming.startTime)
              ? ` · next ${formatMeetingTime(upcoming.startTime)}`
              : ""
          }`
        : undefined;
    items.push({
      actionLine: "Today's meetings",
      subjectLine: subject,
      leadingIcon: ListTodo,
      query: "Show my meetings today",
    });
  }

  // 5. Who needs attention
  items.push({
    actionLine: "Who needs attention?",
    leadingIcon: Users,
    query: "Which contacts need attention?",
  });

  return items.slice(0, 5);
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
    const contacts = extractContactDraftTargets(data);
    contacts.slice(0, 2).forEach(({ name, isFollowUp }) => {
      suggestions.push({
        label: isFollowUp
          ? `View drafted follow up email to ${name}`
          : `View drafted email to ${name}`,
        query: isFollowUp
          ? `Draft a follow up email to ${name}`
          : `Draft an email to ${name}`,
      });
    });
  }

  if (hour < 12) {
    suggestions.push({ label: "My meetings today", query: "Show my meetings today" });
  }

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
  const [briefingExpanded, setBriefingExpanded] = useState(false);
  const briefingLoadedRef = useRef(false);

  const {
    messages,
    input,
    setInput,
    loading,
    mode,
    setMode,
    scrollRef,
    inputRef,
    handleSend,
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

  // Pre-action state: only the briefing exists (no user turns yet). We
  // surface every initial action inline as a vertical "Where do you want
  // to act?" card so the partner picks a path before typing. Once they
  // take any action, the inline card collapses and the existing
  // horizontal pill row above the chat bar takes over (existing behavior).
  const hasUserMessage = useMemo(
    () => messages.some((m) => m.role === "user"),
    [messages],
  );

  const initialActionCardActions = useMemo<RichActionItem[] | null>(() => {
    if (hasUserMessage) return null;
    if (!briefingData) return null;
    const items = getInitialPickerActions(briefingData);
    return items.length > 0 ? items : null;
  }, [briefingData, hasUserMessage]);

  const [inputFocused, setInputFocused] = useState(false);

  const stickyTarget = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant" || !m.blocks) continue;

      const hasConfirmation = m.blocks.some((b) => b.type === "confirmation_card");
      if (hasConfirmation) return null;

      const actionBars = m.blocks.filter(
        (b) => b.type === "action_bar"
      );
      const ab = actionBars[actionBars.length - 1];
      if (!ab) continue;

      const contactBlock = m.blocks.find((b) => b.type === "contact_card");
      const contactName = contactBlock?.data.name;

      return {
        label: contactName ? `Draft to ${contactName}` : ab.data.primary.label,
        primary: {
          label: ab.data.primary.label,
          onClick: () => handleSend(ab.data.primary.query),
        },
        more: [
          ...ab.data.secondary.map((s) => ({
            label: s.label,
            onClick: () => handleSend(s.query),
          })),
          ...(ab.data.tertiary ?? []).map((t) => ({
            label: t.label,
            onClick: () => handleSend(t.query),
          })),
        ],
      };
    }
    return null;
  }, [messages, handleSend]);

  const stickyEnabled = mode !== "call" && !inputFocused;

  const hasMessages = messages.length > 0;

  const callMarvinButton = voiceSupported ? (
    <button
      type="button"
      onClick={() => setMode("call")}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-blue-600 transition-[transform,colors,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96] active:bg-blue-50 dark:bg-blue-600/15 dark:text-blue-400 dark:active:bg-blue-950 dark:focus-visible:ring-blue-400/50"
      aria-label="Call Activate"
    >
      <Phone className="h-5 w-5 pointer-events-none" strokeWidth={2.25} />
    </button>
  ) : null;

  return (
    <MobileShell headerAction={callMarvinButton}>
      <div className="flex h-full flex-col">
        {/* Scrollable feed — top padding equals the floating header so the
            first message sits below it on first paint, but content can rise
            up under the frosted bar as the user scrolls. */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div
            className="space-y-5 px-4 pb-4"
            style={{ paddingTop: "calc(var(--mobile-header-h) + 12px)" }}
          >
            {briefingLoading && !hasMessages && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/35 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/35 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/35 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-[15px] text-muted-foreground-subtle">
                  Preparing your briefing...
                </span>
              </div>
            )}

            {!briefingLoading && !hasMessages && (
              <div className="flex flex-col items-center justify-center gap-4 pt-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-2xl">
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
              <div
                key={msg.id}
                data-msg-id={msg.id}
                data-msg-role={msg.role}
                className="space-y-1.5 scroll-mt-4"
              >
                {msg.role === "user" && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {(session?.user?.name || "You")
                        .split(/\s+/)
                        .map((p) => p[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground-subtle">
                      {session?.user?.name || "You"}
                    </p>
                  </div>
                )}
                <div className="min-w-0">
                  <div
                    className={
                      msg.role === "user"
                        ? "rounded-xl bg-gray-100 px-3.5 py-3 text-[15px] leading-relaxed text-foreground dark:bg-gray-800/60"
                        : ""
                    }
                  >
                    {msg.role === "assistant" ? (
                      msg.id.startsWith("briefing-") ? (
                        <div>
                          {briefingSpokenOpening && (
                            <div className="mb-3 rounded-xl bg-muted/40 px-3.5 py-3">
                              <p className="text-[15px] font-semibold leading-relaxed text-foreground">
                                Today at a glance
                              </p>
                              <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">
                                {briefingSpokenOpening}
                              </p>
                            </div>
                          )}
                          <div className="mb-3">
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
                          <button
                            type="button"
                            onClick={() => setBriefingExpanded((v) => !v)}
                            aria-expanded={briefingExpanded}
                            className="inline-flex items-center gap-1 text-[14px] font-medium text-primary hover:text-primary/80 active:opacity-90"
                          >
                            {briefingExpanded ? (
                              <>
                                <ChevronUp className="h-4 w-4" aria-hidden="true" />
                                Hide full morning brief
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                                View the full morning brief
                              </>
                            )}
                          </button>
                          {briefingExpanded && (
                            <MarkdownContent
                              content={msg.content}
                              className="mt-3 text-[15px] leading-relaxed text-foreground"
                            />
                          )}
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

            {/* Pre-action picker: only renders before the user takes any
                action. Lays out every suggested next step as a tappable
                row so the partner picks a path before typing. */}
            {initialActionCardActions && !loading && (
              <div className="rounded-2xl border border-border bg-card px-4 py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <p className="text-[15px] font-semibold text-foreground">
                    Where do you want to act?
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {initialActionCardActions.map((action) => {
                    const Icon = action.leadingIcon;
                    const hasSubject = Boolean(action.subjectLine);
                    return (
                      <button
                        key={action.query}
                        type="button"
                        onClick={() => handleSend(action.query)}
                        className={cn(
                          "group flex w-full min-h-[44px] items-center gap-3 rounded-xl border border-border bg-card px-3.5 text-left transition-colors",
                          hasSubject ? "py-2.5" : "py-3",
                          "hover:bg-muted/60",
                          "active:bg-muted active:scale-[0.99]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        )}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground transition-colors group-hover:text-foreground"
                          aria-hidden="true"
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-baseline justify-between gap-2">
                            <p className="min-w-0 flex-1 text-[15px] font-semibold leading-tight text-foreground line-clamp-1">
                              {action.actionLine}
                            </p>
                            {action.trailingMeta && (
                              <span className="shrink-0 truncate rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                {action.trailingMeta}
                              </span>
                            )}
                          </div>
                          {hasSubject && (
                            <p className="mt-0.5 text-[13px] font-normal leading-snug text-muted-foreground line-clamp-1">
                              {action.subjectLine}
                            </p>
                          )}
                        </div>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 self-center text-muted-foreground"
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-[15px] text-muted-foreground-subtle">
                  Searching your data & the web...
                </span>
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
          {/* Quick action pills — unified, thread-aware. Hidden in the
              pre-action state because the inline picker card above is
              showing the same options as full-width rows. */}
          {activeQuickActions.length > 0 && !loading && hasUserMessage && (
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
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
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

      <StickyActionBar enabled={stickyEnabled} target={stickyTarget} />

      <CallMarvinOverlay
        open={mode === "call"}
        onClose={() => setMode("chat")}
        messages={messages}
        onSend={handleSend}
        onConfirmAction={handleConfirmAction}
      />
    </MobileShell>
  );
}

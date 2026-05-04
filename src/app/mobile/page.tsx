"use client";

import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from "react";
import { Send, Loader2, Sparkles, Mic, MicOff, ChevronRight, ChevronDown, ChevronUp, AudioLines, Calendar, Mail, ListTodo, Users, Megaphone, Newspaper, type LucideIcon } from "lucide-react";
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
import { StrategicInsight } from "@/components/chat/blocks/strategic-insight";
import type { StrategicInsightBlock as StrategicInsightBlockType } from "@/lib/types/chat-blocks";

/**
 * Post-process a morning brief narrative so every section body uses markdown
 * bullet points. Handles both old cached prose-style narratives and new
 * LLM-generated ones that may occasionally skip bullet syntax.
 *
 * Pattern: lines starting with "**Heading**" are section labels. If the lines
 * below a heading are prose (no "- " prefix), split them into one bullet per
 * sentence that contains a proper noun (person/company name) as anchor.
 */
function ensureBriefBullets(raw: string): string {
  const lines = raw.split("\n");
  const out: string[] = [];
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^\*\*[^*]+\*\*\s*$/.test(trimmed)) {
      inSection = true;
      out.push(line);
      continue;
    }

    if (!inSection || !trimmed || trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) {
      if (!trimmed) inSection = false;
      out.push(line);
      continue;
    }

    const sentences = trimmed.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 0) {
      for (const s of sentences) {
        const clean = s.trim();
        if (clean.length > 15) out.push(`- ${clean}`);
      }
    } else {
      out.push(`- ${trimmed}`);
    }
  }

  return out.join("\n");
}

type BriefingData = {
  briefing: string;
  dataDrivenSummary?: string;
  topActions: { contactName: string; company: string; actionLabel: string; detail: string; deeplink: string; contactId?: string }[];
  structured: {
    nudges: {
      contactName: string;
      company: string;
      contactId: string;
      ruleType?: string;
      // Server already returns these for every top nudge; declared here so
      // `getInitialPickerActions` can mine them for the campaign-approval row
      // (e.g., parse the campaign name from `reason`, count pending from
      // `metadata.pendingCount`) and the morning-brief contact rows can
      // surface `metadata.strategicInsight` + `metadata.insights`.
      reason?: string;
      metadata?: string;
      nudgeId?: string;
      priority?: string;
      daysSince?: number;
    }[];
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

/**
 * Parse a nudge's serialized `metadata` blob into the two pieces the morning
 * brief renders: the `strategicInsight` synthesis (narrative + bold beats)
 * and the raw `insights` list that powers "Show Evidence (N signals)".
 *
 * Both are written by the nudge engine — `insights` at creation time and
 * `strategicInsight` later by `enrichNudgesWithInsights` — so a freshly
 * created nudge may have one without the other.
 */
function parseNudgeInsightMetadata(metadataStr: string | undefined): {
  insights: StrategicInsightBlockType["data"]["insights"];
  strategicInsight?: { narrative: string; oneLiner?: string };
} {
  if (!metadataStr) return { insights: [] };
  try {
    const parsed = JSON.parse(metadataStr) as {
      insights?: StrategicInsightBlockType["data"]["insights"];
      strategicInsight?: { narrative: string; oneLiner?: string };
    };
    return {
      insights: Array.isArray(parsed?.insights) ? parsed.insights : [],
      strategicInsight: parsed?.strategicInsight,
    };
  } catch {
    return { insights: [] };
  }
}

/**
 * Split the morning-brief markdown around the "**Who to contact:**" section
 * so the mobile view can interleave React contact rows in their natural
 * spot — after the "Good morning…" opener and before Meetings / Campaign
 * approvals / Articles to share / Signals & news.
 *
 * Section boundary: the morning-brief markdown separates sections with a
 * single blank line followed by another `**Heading:**` line. We splice from
 * the contacts header to the next section header (or end-of-string).
 *
 * If the markdown has no contacts block, `before` holds the whole input and
 * `after` is empty — the React contact list renders below it as a fallback.
 */
function splitMarkdownAroundContacts(markdown: string): {
  before: string;
  after: string;
} {
  const start = markdown.search(/\*\*Who to contact:\*\*/);
  if (start === -1) return { before: markdown, after: "" };
  const before = markdown.slice(0, start).trimEnd();
  const tail = markdown.slice(start);
  const nextHeader = tail.search(/\n\n\*\*[^*]+:\*\*/);
  const after = nextHeader === -1 ? "" : tail.slice(nextHeader + 2).trim();
  return { before, after };
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

  // 5. Campaign approval (only when the morning brief surfaces one). Sits
  // above "Who needs attention?" so it stays visible even when the catch-all
  // is appended last.
  const campaignRow = buildCampaignApprovalAction(data);
  if (campaignRow) {
    items.push(campaignRow);
  }

  // 6. Article share (only when morning brief surfaces an ARTICLE_CAMPAIGN nudge)
  const articleRow = buildArticleShareAction(data);
  if (articleRow) {
    items.push(articleRow);
  }

  // Always end with the universal catch-all. Trim the rest so the picker
  // stays a tight glanceable list while guaranteeing the catch-all renders.
  const trimmed = items.slice(0, 6);
  trimmed.push({
    actionLine: "Who needs attention?",
    leadingIcon: Users,
    query: "Which contacts need attention?",
  });
  return trimmed;
}

/**
 * Mine the morning briefing for a CAMPAIGN_APPROVAL nudge and turn it into
 * a rich action row. We prefer the campaign name parsed from `reason`
 * (engine writes `Campaign "X" has N contacts pending your review (due …)`)
 * and fall back to the recipient/contact pair the nudge is anchored to.
 */
function buildCampaignApprovalAction(
  data: BriefingData | null,
): RichActionItem | null {
  const nudge = data?.structured?.nudges?.find(
    (n) => n.ruleType === "CAMPAIGN_APPROVAL",
  );
  if (!nudge) return null;

  let campaignName: string | undefined;
  let pendingCount: number | undefined;

  if (nudge.reason) {
    const nameMatch = nudge.reason.match(/Campaign\s+"([^"]+)"/);
    if (nameMatch) campaignName = nameMatch[1];
    const countMatch = nudge.reason.match(
      /\bhas\s+(\d+)\s+contacts?\s+pending\b/i,
    );
    if (countMatch) pendingCount = Number(countMatch[1]);
  }

  if (nudge.metadata && pendingCount === undefined) {
    try {
      const meta = JSON.parse(nudge.metadata) as { pendingCount?: number };
      if (typeof meta.pendingCount === "number") pendingCount = meta.pendingCount;
    } catch {
      // best-effort only — `reason` is the canonical source
    }
  }

  const subjectLine = (() => {
    const parts: string[] = [];
    if (campaignName) parts.push(campaignName);
    if (pendingCount && pendingCount > 0) {
      parts.push(`${pendingCount} pending`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  })();

  return {
    actionLine: "Review campaign approval",
    subjectLine,
    leadingIcon: Megaphone,
    query: "Review my campaign approvals",
  };
}

function buildArticleShareAction(
  data: BriefingData | null,
): RichActionItem | null {
  const nudge = data?.structured?.nudges?.find(
    (n) => n.ruleType === "ARTICLE_CAMPAIGN",
  );
  if (!nudge) return null;

  let articleTitle: string | undefined;
  let matchCount: number | undefined;

  if (nudge.metadata) {
    try {
      const meta = JSON.parse(nudge.metadata) as {
        articleTitle?: string;
        matchCount?: number;
      };
      articleTitle = meta.articleTitle;
      matchCount = meta.matchCount;
    } catch {
      // best-effort
    }
  }

  if (!articleTitle && nudge.reason) {
    const titleMatch = nudge.reason.match(/article\s+"([^"]+)"/i);
    if (titleMatch) articleTitle = titleMatch[1];
    const countMatch = nudge.reason.match(/(\d+)\s+contacts?\s+matched/i);
    if (countMatch) matchCount = Number(countMatch[1]);
  }

  const subjectLine = (() => {
    const parts: string[] = [];
    if (articleTitle) parts.push(articleTitle);
    if (matchCount && matchCount > 0) {
      parts.push(`${matchCount} matched contact${matchCount === 1 ? "" : "s"}`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  })();

  return {
    actionLine: "Newly published article to share",
    subjectLine,
    leadingIcon: Newspaper,
    query: "Newly published articles to share",
  };
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

/**
 * "Who to contact:" section of the morning brief, rendered as React rows so
 * each contact can surface the same synthesized strategic insight + evidence
 * expander the desktop nudge cards show. Falls back to the engine's
 * `oneLiner` (or raw `reason`) until `enrichNudgesWithInsights` finishes.
 *
 * Excludes campaign/article rows — those have dedicated picker actions.
 */
function MorningBriefContactList({
  nudges,
}: {
  nudges: NonNullable<BriefingData["structured"]["nudges"]>;
}) {
  const contactNudges = nudges.filter(
    (n) =>
      n.ruleType !== "CAMPAIGN_APPROVAL" &&
      n.ruleType !== "ARTICLE_CAMPAIGN" &&
      n.company !== "Campaign" &&
      n.company !== "Article Campaign",
  );

  if (contactNudges.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-[15px] font-semibold text-foreground">
        Important Clients to follow up:
      </h3>
      <ul className="space-y-3">
        {contactNudges.slice(0, 5).map((n) => {
          const { insights, strategicInsight } = parseNudgeInsightMetadata(n.metadata);

          const touchPart = (() => {
            if (typeof n.daysSince === "number") {
              return `${n.daysSince} day${n.daysSince === 1 ? "" : "s"} since last outreach`;
            }
            return "Needs attention";
          })();

          // Insight data: prefer the synthesized narrative, then oneLiner, then
          // raw reason. We always render the StrategicInsight block so the
          // evidence expander shows up whenever insights exist, regardless of
          // whether the strategic synthesis has finished generating.
          const narrative =
            strategicInsight?.narrative ??
            strategicInsight?.oneLiner ??
            (n.reason ?? "");

          return (
            <li
              key={n.nudgeId ?? `${n.contactId}-${n.contactName}`}
              className="space-y-1.5"
            >
              <p className="text-[15px] leading-snug text-foreground">
                <span className="font-semibold">{n.contactName}</span>
                {n.company ? (
                  <>
                    {" · "}
                    <span className="font-semibold">{n.company}</span>
                  </>
                ) : null}
                {" — "}
                {touchPart}.
              </p>
              {narrative ? (
                <StrategicInsight
                  data={{ narrative, insights }}
                  embedded
                  density="comfortable"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
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

  const hasUserMessage = useMemo(
    () => messages.some((m) => m.role === "user"),
    [messages],
  );

  const allPickerActions = useMemo<RichActionItem[] | null>(() => {
    if (!briefingData) return null;
    const items = getInitialPickerActions(briefingData);
    return items.length > 0 ? items : null;
  }, [briefingData]);

  const initialActionCardActions = allPickerActions;

  const [completedActions, setCompletedActions] = useState<Set<string>>(
    () => new Set(),
  );

  const markActionCompleted = useCallback((query: string) => {
    setCompletedActions((prev) => {
      const next = new Set(prev);
      next.add(query.toLowerCase());
      return next;
    });
  }, []);

  const activeQuickActions = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const inlineActions = lastAssistant ? extractInlineActions(lastAssistant.content) : [];

    if (hasUserMessage && allPickerActions) {
      const remaining = allPickerActions
        .filter((a) => !completedActions.has(a.query.toLowerCase()))
        .map((a) => ({ label: a.actionLine, query: a.query }));
      const combined = [...inlineActions, ...remaining];
      return deduplicateActions(combined, usedQueries).slice(0, 5);
    }

    const initialActions = getInitialSuggestions(briefingData);
    const combined = inlineActions.length > 0
      ? [...inlineActions, ...initialActions]
      : initialActions;

    return deduplicateActions(combined, usedQueries).slice(0, 5);
  }, [messages, briefingData, usedQueries, hasUserMessage, allPickerActions, completedActions]);

  const [inputFocused, setInputFocused] = useState(false);

  // Floating footer (pills row + chat pill) is absolutely positioned so the
  // feed can scroll *under* it — that's what gives the frosted-glass layer
  // something to blur. We measure the footer's intrinsic height and surface
  // it as a CSS var so (a) the feed leaves matching bottom padding and
  // (b) the StickyActionBar lifts above it. ResizeObserver covers the
  // pills-vs-no-pills states without prop plumbing.
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [footerHeight, setFooterHeight] = useState(96);
  useLayoutEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const update = () => setFooterHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const callActive = mode === "call";
  const callMarvinButton = voiceSupported ? (
    <button
      type="button"
      onClick={() => setMode("call")}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[transform,colors,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96]",
        callActive
          ? "bg-primary text-primary-foreground shadow-[0_0_0_4px_rgba(34,81,255,0.18)]"
          : "bg-primary/10 text-primary active:bg-primary/15 dark:bg-primary/15 dark:text-primary dark:active:bg-primary/20 dark:focus-visible:ring-primary/50",
      )}
      aria-label={callActive ? "Voice mode active" : "Start voice mode"}
      aria-pressed={callActive}
    >
      <AudioLines
        className={cn(
          "h-5 w-5 pointer-events-none",
          callActive && "audio-bars-active",
        )}
        strokeWidth={2.25}
      />
    </button>
  ) : null;

  return (
    <MobileShell headerAction={callMarvinButton}>
      <div
        className="relative h-full"
        style={{ ["--mobile-footer-h" as string]: `${footerHeight}px` }}
      >
        {/* Scrollable feed — fills the frame so it can pass *under* both
            the floating header and the floating footer. Top padding clears
            the icon row only (the bar's bottom 36px is a fade zone meant
            for content to pass through). Bottom padding leaves room for
            the floating chat-pill footer (measured + buffered). */}
        <div className="absolute inset-0 overflow-y-auto scrollbar-thin">
          <div
            className="space-y-5 px-4"
            style={{
              paddingTop: "calc(var(--mobile-header-h) - 24px)",
              paddingBottom: "calc(var(--mobile-footer-h) + 12px)",
            }}
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
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground dark:bg-muted dark:text-muted-foreground">
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
                        ? "rounded-xl bg-muted/60 px-3.5 py-3 text-[15px] leading-relaxed text-foreground dark:bg-muted/40"
                        : ""
                    }
                  >
                    {msg.role === "assistant" ? (
                      msg.id.startsWith("briefing-") ? (
                        <>
                        <div className="rounded-xl bg-muted/40 px-3.5 py-3">
                          {briefingSpokenOpening && (
                            <div className="mb-3">
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
                          {briefingExpanded && (() => {
                            const rawMarkdown = briefingData?.dataDrivenSummary || msg.content;
                            const { before, after } = splitMarkdownAroundContacts(
                              ensureBriefBullets(rawMarkdown),
                            );
                            const hasContactNudges = Boolean(
                              briefingData?.structured?.nudges?.length,
                            );
                            return (
                              <div className="mt-3 space-y-4 border-t border-border/40 pt-3">
                                {before ? (
                                  <MarkdownContent
                                    content={before}
                                    className="text-[15px] leading-relaxed text-foreground"
                                  />
                                ) : null}
                                {hasContactNudges ? (
                                  <MorningBriefContactList
                                    nudges={briefingData!.structured.nudges}
                                  />
                                ) : null}
                                {after ? (
                                  <MarkdownContent
                                    content={after}
                                    className="text-[15px] leading-relaxed text-foreground"
                                  />
                                ) : null}
                              </div>
                            );
                          })()}
                        </div>
                        {initialActionCardActions && (
                          <div className="mt-3 rounded-2xl border border-border bg-card px-4 py-4">
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
                                const isCompleted = completedActions.has(action.query.toLowerCase());
                                return (
                                  <button
                                    key={action.query}
                                    type="button"
                                    onClick={() => {
                                      if (isCompleted) return;
                                      handleSend(action.query);
                                      setTimeout(() => {
                                        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
                                      }, 100);
                                    }}
                                    disabled={isCompleted}
                                    className={cn(
                                      "group flex w-full min-h-[44px] items-center gap-3 rounded-xl border px-3.5 text-left transition-colors",
                                      hasSubject ? "py-2.5" : "py-3",
                                      isCompleted
                                        ? "border-primary/20 bg-primary/[0.04] opacity-60 cursor-default"
                                        : [
                                            "border-border bg-card",
                                            "hover:bg-muted/60",
                                            "active:bg-muted active:scale-[0.99]",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                          ],
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                                        isCompleted
                                          ? "bg-primary/10 text-primary"
                                          : "bg-muted/50 text-muted-foreground group-hover:text-foreground",
                                      )}
                                      aria-hidden="true"
                                    >
                                      <Icon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                                        <p className={cn(
                                          "min-w-0 flex-1 text-[15px] font-semibold leading-tight line-clamp-1",
                                          isCompleted ? "text-foreground/60" : "text-foreground",
                                        )}>
                                          {action.actionLine}
                                        </p>
                                        {isCompleted ? (
                                          <span className="shrink-0 text-[10px] font-medium text-primary/70">
                                            Done
                                          </span>
                                        ) : action.trailingMeta ? (
                                          <span className="shrink-0 truncate rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                            {action.trailingMeta}
                                          </span>
                                        ) : null}
                                      </div>
                                      {hasSubject && (
                                        <p className="mt-0.5 text-[13px] font-normal leading-snug text-muted-foreground line-clamp-1">
                                          {action.subjectLine}
                                        </p>
                                      )}
                                    </div>
                                    {!isCompleted && (
                                      <ChevronRight
                                        className="h-4 w-4 shrink-0 self-center text-muted-foreground"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        </>
                      ) : (
                        <AssistantReply
                          content={msg.content}
                          sources={msg.sources ?? []}
                          blocks={msg.blocks}
                          onSendMessage={handleSend}
                          onConfirmAction={handleConfirmAction}
                          onActionCompleted={markActionCompleted}
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

        {/* Live transcript preview — floats above the footer */}
        {isListening && (
          <div
            className="absolute inset-x-0 z-40"
            style={{ bottom: `calc(${footerHeight}px + max(8px, env(safe-area-inset-bottom)))` }}
          >
            <LiveTranscriptPreview
              transcript={liveTranscript}
              isListening={isListening}
              duration={voiceDuration}
              audioLevel={voiceAudioLevel}
            />
          </div>
        )}

        {/* Floating bottom area — pills + chat pill, frosted-glass mirror
            of the header. The frosted layer fades *upward* (transparent at
            top, opaque-frosted at bottom) so feed content scrolls under it
            with a soft transition. The chat pill sits as a rounded card on
            top of the frosted layer with its own subtle shadow + ring. */}
        <div
          ref={footerRef}
          className="absolute bottom-0 inset-x-0 z-30"
          style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
        >
          {/* No footer backplate — chat content scrolls cleanly under the
              floating elements. The frost lives on the pills + chat pill
              themselves, not on a unified band. */}
          <div className="relative">
            {/* Quick action pills — unified, thread-aware. Hidden in the
                pre-action state because the inline picker card above is
                showing the same options as full-width rows. */}
            {activeQuickActions.length > 0 && !loading && hasUserMessage && (
              <div className="flex gap-2 overflow-x-auto px-4 pb-2 pt-2 scrollbar-none">
                {activeQuickActions.map((action) => (
                  <button
                    key={action.query}
                    type="button"
                    onClick={() => handleSend(action.query)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-white/80 px-4 py-2.5 text-[13px] font-medium text-primary shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-md transition-colors active:bg-primary/10 active:scale-[0.97]"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Floating chat pill */}
            <div className="px-3 pb-2 pt-1">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className={cn(
                  "flex items-end gap-1.5 rounded-3xl bg-white/95 pl-4 pr-1.5 py-1.5",
                  "shadow-[0_6px_24px_-6px_rgba(15,23,42,0.18),0_2px_8px_-2px_rgba(15,23,42,0.08)]",
                  "ring-1 ring-black/[0.06] backdrop-blur-md",
                  "focus-within:ring-primary/40 focus-within:ring-2",
                  "dark:bg-card/95 dark:ring-white/[0.08]",
                )}
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
                  className="flex-1 resize-none border-0 bg-transparent py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground-subtle disabled:opacity-50"
                  style={{ maxHeight: "120px", fontSize: "16px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = Math.min(target.scrollHeight, 120) + "px";
                  }}
                />
                {voiceSupported && (
                  <div className="flex items-center gap-1">
                    {isListening && voiceDuration > 0 && (
                      <span className="self-center text-xs font-mono text-destructive tabular-nums">
                        {Math.floor(voiceDuration / 60)}:{String(voiceDuration % 60).padStart(2, "0")}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant={isListening ? "destructive" : isTranscribing ? "secondary" : "ghost"}
                      size="icon"
                      disabled={loading || isTranscribing}
                      onClick={isListening ? stopListening : startListening}
                      className={cn(
                        "h-10 w-10 shrink-0 rounded-full",
                        isListening
                          ? "animate-pulse"
                          : isTranscribing
                            ? ""
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                      )}
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
                        <span className="absolute inset-0 rounded-full border-2 border-destructive animate-ping opacity-30" />
                      )}
                    </Button>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={loading || !input.trim()}
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full"
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

        {/* StickyActionBar lifted above the floating footer. Wrapping in a
            zero-height positioned div anchored at `bottom: --mobile-footer-h`
            puts the bar's intrinsic card just above the chat pill. */}
        <div
          className="pointer-events-none absolute inset-x-0 z-40"
          style={{ bottom: "var(--mobile-footer-h, 0px)" }}
        >
          <div className="pointer-events-auto">
            <StickyActionBar enabled={stickyEnabled} target={stickyTarget} />
          </div>
        </div>
      </div>

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

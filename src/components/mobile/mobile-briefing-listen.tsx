"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { VoiceOutlineSegment } from "@/components/voice-memo/voice-memo-client-briefing";
import type { VoiceMemoSegmentClient } from "@/components/voice-memo/voice-memo-briefing";
import { useBriefingTts } from "@/hooks/use-briefing-tts";
import type { ApiStructuredBriefing } from "@/lib/services/structured-briefing";
import {
  voiceIndexForIntro,
  voiceIndexForMeeting,
  voiceIndexForNews,
  voiceIndexForNudge,
} from "@/lib/utils/voice-segment-map";

function tryPlayHtmlAudio(
  el: HTMLAudioElement,
  onFail?: (reason: "play_rejected" | "not_supported") => void
) {
  el.muted = false;
  el.defaultMuted = false;
  el.volume = 1;
  const p = el.play();
  if (!p) {
    onFail?.("not_supported");
    return;
  }
  void p.catch(() => {
    const onReady = () => {
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("loadeddata", onReady);
      void el.play().catch(() => onFail?.("play_rejected"));
    };
    el.addEventListener("canplay", onReady);
    el.addEventListener("loadeddata", onReady);
    if (el.readyState === HTMLMediaElement.HAVE_NOTHING) el.load();
  });
}

function formatMmSs(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
  const s = Math.floor(totalSec % 60);
  const m = Math.floor(totalSec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatNudgeTouchPlain(n: ApiStructuredBriefing["nudges"][number]): string {
  if (n.lastContactedLabel && n.lastContactedLabel !== "No logged touch") {
    const days = n.daysSince != null ? ` (${n.daysSince} days ago)` : "";
    return `Last touch ${n.lastContactedLabel}${days}`;
  }
  if (n.lastContactedLabel === "No logged touch") {
    return "No logged touch in CRM";
  }
  if (n.daysSince != null) {
    return `${n.daysSince} days since last outreach`;
  }
  return "Needs attention";
}

function resolveAudioSegmentIndex(
  audioSegments: VoiceMemoSegmentClient[],
  outline: VoiceOutlineSegment | undefined,
  outlineIndex: number
): number {
  if (!outline || audioSegments.length === 0) return 0;
  const byId = audioSegments.findIndex((s) => s.id === outline.id);
  if (byId >= 0) return byId;
  return Math.min(outlineIndex, audioSegments.length - 1);
}

type Props = {
  partnerDisplayName: string;
  structured: ApiStructuredBriefing;
  voiceOutline: VoiceOutlineSegment[];
  voiceMemo?: {
    audioUrl: string;
    durationMs: number;
    segments: VoiceMemoSegmentClient[];
  } | null;
  isPlaceholder: boolean;
};

export function MobileBriefingListen({
  partnerDisplayName,
  structured,
  voiceOutline,
  voiceMemo,
  isPlaceholder,
}: Props) {
  const tts = useBriefingTts(voiceMemo ? [] : voiceOutline);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioMs, setAudioMs] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState(
    voiceMemo ? voiceMemo.durationMs / 1000 : 0
  );

  const totalMsAudio = voiceMemo
    ? Math.floor((audioDurationSec || voiceMemo.durationMs / 1000) * 1000)
    : 0;

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !voiceMemo) return;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    const onTime = () => setAudioMs(Math.floor(el.currentTime * 1000));
    const onPlay = () => setAudioPlaying(true);
    const onPause = () => setAudioPlaying(false);
    const onEnded = () => setAudioPlaying(false);
    const onDur = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setAudioDurationSec(el.duration);
      }
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onDur);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onDur);
    };
  }, [voiceMemo?.audioUrl]);

  useEffect(() => {
    if (voiceMemo) setAudioDurationSec(voiceMemo.durationMs / 1000);
  }, [voiceMemo?.durationMs]);

  const toggleAudioPlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    setAudioError(null);
    tryPlayHtmlAudio(el, () => {
      setAudioError(
        "Could not start playback. Check volume and silent mode, then tap play again. If this persists, refresh the page."
      );
    });
  }, []);

  const seekAudioToOutlineIndex = useCallback(
    (outlineIndex: number) => {
      const el = audioRef.current;
      if (!el || !voiceMemo) return;
      const outline = voiceOutline[outlineIndex];
      const ai = resolveAudioSegmentIndex(voiceMemo.segments, outline, outlineIndex);
      const seg = voiceMemo.segments[ai];
      if (!seg) return;
      el.currentTime = seg.startMs / 1000;
      setAudioMs(seg.startMs);
      setAudioError(null);
      tryPlayHtmlAudio(el, () => {
        setAudioError(
          "Could not start playback. Check volume and silent mode, then tap play again."
        );
      });
    },
    [voiceMemo, voiceOutline]
  );

  const seekAudioToMs = useCallback(
    (ms: number) => {
      const el = audioRef.current;
      if (!el || !voiceMemo) return;
      const sec = ms / 1000;
      el.currentTime = sec;
      setAudioMs(ms);
      setAudioError(null);
      tryPlayHtmlAudio(el, () => {
        setAudioError(
          "Could not start playback. Check volume and silent mode, then tap play again."
        );
      });
    },
    [voiceMemo]
  );

  const isOutlineRowActive = useCallback(
    (outlineVoiceIndex: number) => {
      if (voiceMemo) {
        const outline = voiceOutline[outlineVoiceIndex];
        const ai = resolveAudioSegmentIndex(voiceMemo.segments, outline, outlineVoiceIndex);
        const seg = voiceMemo.segments[ai];
        if (!seg) return false;
        return audioMs >= seg.startMs && audioMs < seg.endMs;
      }
      return tts.activeSegmentIndex === outlineVoiceIndex;
    },
    [voiceMemo, voiceOutline, audioMs, tts.activeSegmentIndex]
  );

  const handleRowSeek = useCallback(
    (outlineVoiceIndex: number) => {
      if (voiceMemo) {
        seekAudioToOutlineIndex(outlineVoiceIndex);
      } else {
        tts.seekToSegmentIndex(outlineVoiceIndex);
      }
    },
    [voiceMemo, seekAudioToOutlineIndex, tts]
  );

  const introIdx = voiceIndexForIntro(voiceOutline);

  const showTransport = Boolean(voiceMemo) || (tts.supported && voiceOutline.length > 0);

  return (
    <div className="space-y-4">
      {voiceMemo && (
        <audio
          ref={audioRef}
          src={voiceMemo.audioUrl}
          preload="auto"
          playsInline
          muted={false}
          className="sr-only"
          aria-hidden
          onError={() => {
            setAudioError(
              "Could not load briefing audio. Try refreshing. If you use an ad blocker or strict network, allow audio for this site."
            );
          }}
        />
      )}

      <p className="text-[15px] leading-relaxed text-foreground">
        Good morning,{" "}
        <span className="font-semibold text-foreground">{partnerDisplayName}</span> — here&apos;s
        your snapshot from your CRM.
      </p>

      {!voiceMemo && !tts.supported && (
        <p className="text-sm text-muted-foreground">
          Spoken briefing isn&apos;t available in this browser. Use Safari or Chrome on your phone,
          or open the dashboard for studio audio when configured.
        </p>
      )}

      {!voiceMemo && tts.error && (
        <p className="text-sm text-destructive" role="alert">
          {tts.error}
        </p>
      )}

      {voiceMemo && audioError && (
        <p className="text-sm text-destructive" role="alert">
          {audioError}
        </p>
      )}

      {showTransport && (
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground-subtle">
            Briefing audio
          </p>
          {voiceMemo ? (
            <BriefingTransport
              currentMs={audioMs}
              totalMs={totalMsAudio || 1}
              playing={audioPlaying}
              onToggle={toggleAudioPlay}
              onSeekMs={seekAudioToMs}
            />
          ) : (
            <BriefingTransport
              currentMs={tts.currentMs}
              totalMs={Math.max(1, tts.totalMs)}
              playing={tts.playing}
              onToggle={tts.togglePlay}
              onSeekMs={tts.seekToMs}
            />
          )}
        </div>
      )}

      {introIdx >= 0 && voiceOutline[introIdx] && (
        <SeekableRow
          active={isOutlineRowActive(introIdx)}
          onSeek={() => handleRowSeek(introIdx)}
          disabled={!voiceMemo && !tts.supported}
        >
          <p className="text-[15px] font-medium text-foreground">{voiceOutline[introIdx].headline}</p>
        </SeekableRow>
      )}

      {structured.nudges.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle">
            Who to contact
          </h3>
          <ul className="space-y-2">
            {structured.nudges.slice(0, 5).map((n, i) => {
              const vIdx = voiceIndexForNudge(i, voiceOutline);
              return (
                <li key={`${n.contactId}-${n.nudgeId ?? i}`}>
                  <SeekableRow
                    active={isOutlineRowActive(vIdx)}
                    onSeek={() => handleRowSeek(vIdx)}
                    disabled={!voiceMemo && !tts.supported}
                    deeplink={`/contacts/${n.contactId}`}
                  >
                    <p className="text-[15px] text-foreground">
                      <span className="font-semibold">{n.contactName}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="font-semibold">{n.company}</span>
                      <span className="text-muted-foreground"> — </span>
                      {formatNudgeTouchPlain(n)}
                    </p>
                    {(n.lastInteractionSummary ?? "").trim().length > 0 && (
                      <p className="mt-1 text-[14px] leading-snug text-muted-foreground">
                        Latest note:{" "}
                        {(n.lastInteractionSummary ?? "").trim().length > 160
                          ? `${(n.lastInteractionSummary ?? "").trim().slice(0, 157)}…`
                          : (n.lastInteractionSummary ?? "").trim()}
                      </p>
                    )}
                    {(n.reason ?? "").trim().length > 0 && (
                      <p className="mt-1 text-[14px] leading-snug text-muted-foreground">
                        Why this surfaced:{" "}
                        {(n.reason ?? "").trim().length > 120
                          ? `${(n.reason ?? "").trim().slice(0, 117)}…`
                          : (n.reason ?? "").trim()}
                      </p>
                    )}
                  </SeekableRow>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {structured.meetings.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle">
            Meetings
          </h3>
          <ul className="space-y-2">
            {structured.meetings.map((m) => {
              const vIdx = voiceIndexForMeeting(voiceOutline);
              return (
                <li key={m.meetingId}>
                  <SeekableRow
                    active={isOutlineRowActive(vIdx)}
                    onSeek={() => handleRowSeek(vIdx)}
                    disabled={!voiceMemo && !tts.supported}
                  >
                    <p className="text-[15px] text-foreground">
                      <span className="font-semibold">{m.title}</span>
                      <span className="text-muted-foreground"> — </span>
                      {m.startTime} with {m.attendeeNames.join(", ")}.
                    </p>
                  </SeekableRow>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {structured.news.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground-subtle">
            Signals &amp; news
          </h3>
          <ul className="space-y-2">
            {structured.news.slice(0, 4).map((s, i) => {
              const vIdx = voiceIndexForNews(voiceOutline);
              const label = s.company ?? s.contactName ?? "Signal";
              return (
                <li key={`${s.companyId ?? ""}-${i}-${s.content.slice(0, 20)}`}>
                  <SeekableRow
                    active={isOutlineRowActive(vIdx)}
                    onSeek={() => handleRowSeek(vIdx)}
                    disabled={!voiceMemo && !tts.supported}
                  >
                    <p className="text-[15px] text-foreground">
                      <span className="font-semibold">{label}</span>
                      <span className="text-muted-foreground">: </span>
                      {s.content.length > 160 ? `${s.content.slice(0, 157)}…` : s.content}
                    </p>
                  </SeekableRow>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {structured.nudges.length === 0 &&
        structured.meetings.length === 0 &&
        structured.news.length === 0 && (
          <p className="text-[15px] text-muted-foreground">
            Hi {partnerDisplayName.split(" ")[0]} — nothing urgent in your nudges, next 48 hours of
            meetings, or recent signals. Good time for proactive outreach.
          </p>
        )}

      {isPlaceholder && (
        <p className="text-[13px] text-muted-foreground">
          Sample layout — your live CRM data replaces this when the briefing loads.
        </p>
      )}
    </div>
  );
}

function BriefingTransport({
  currentMs,
  totalMs,
  playing,
  onToggle,
  onSeekMs,
}: {
  currentMs: number;
  totalMs: number;
  playing: boolean;
  onToggle: () => void;
  onSeekMs: (ms: number) => void;
}) {
  const durationSec = Math.max(0.1, totalMs / 1000);
  const currentSec = currentMs / 1000;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? "Pause briefing" : "Play briefing"}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm active:scale-[0.97]"
      >
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={durationSec}
          step={0.1}
          value={Math.min(currentSec, durationSec)}
          onChange={(e) => {
            const t = Number(e.target.value) * 1000;
            onSeekMs(t);
          }}
          className="h-2 w-full cursor-pointer accent-primary"
          aria-label="Briefing position"
        />
        <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground-subtle">
          <span>{formatMmSs(currentSec)}</span>
          <span>{formatMmSs(durationSec)}</span>
        </div>
      </div>
    </div>
  );
}

function SeekableRow({
  active,
  onSeek,
  disabled,
  deeplink,
  children,
}: {
  active: boolean;
  onSeek: () => void;
  disabled?: boolean;
  deeplink?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-xl border p-3 transition-colors",
        active ? "border-primary/50 bg-primary/10" : "border-border bg-muted/30"
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onSeek}
        className={cn(
          "min-w-0 flex-1 text-left",
          disabled && "cursor-not-allowed opacity-50",
          !disabled && "cursor-pointer active:opacity-90"
        )}
      >
        {children}
      </button>
      {deeplink && (
        <Link
          href={deeplink}
          className="flex shrink-0 items-start pt-0.5 text-muted-foreground hover:text-primary"
          aria-label="Open in app"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

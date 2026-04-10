import type { VoiceOutlineSegment } from "@/components/voice-memo/voice-memo-client-briefing";

/** Resolve voice outline index for nudge-{n} (handles demo intro segment at index 0). */
export function voiceIndexForNudge(
  nudgeIndex: number,
  voiceOutline: VoiceOutlineSegment[]
): number {
  const byId = voiceOutline.findIndex((s) => s.id === `nudge-${nudgeIndex}`);
  if (byId >= 0) return byId;
  if (voiceOutline[0]?.id?.startsWith("demo-")) {
    return 1 + nudgeIndex;
  }
  return Math.min(nudgeIndex, voiceOutline.length - 1);
}

export function voiceIndexForMeeting(voiceOutline: VoiceOutlineSegment[]): number {
  const byId = voiceOutline.findIndex((s) => s.id === "meeting-0");
  if (byId >= 0) return byId;
  const demo = voiceOutline.findIndex(
    (s) => s.id === "demo-3" || /prep|meeting|pipeline/i.test(s.headline)
  );
  if (demo >= 0) return demo;
  return 0;
}

export function voiceIndexForNews(voiceOutline: VoiceOutlineSegment[]): number {
  const byId = voiceOutline.findIndex((s) => s.id === "news-0");
  if (byId >= 0) return byId;
  const demo = voiceOutline.findIndex(
    (s) => s.id === "demo-4" || /news|signal|radar/i.test(s.headline)
  );
  if (demo >= 0) return demo;
  return Math.max(0, voiceOutline.length - 1);
}

export function voiceIndexForIntro(voiceOutline: VoiceOutlineSegment[]): number {
  if (voiceOutline[0]?.id?.startsWith("demo-")) return 0;
  return -1;
}

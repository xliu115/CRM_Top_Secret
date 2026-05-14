import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { parseBuffer } from "music-metadata";
import { openai } from "./llm-core";
import type { VoiceMemoSegmentScript } from "./llm-briefing";
import { computeSegmentOffsetsMs } from "@/lib/utils/voice-timeline";

/** Relative to project root; files are served as `/generated/voice-briefings/...` */
export const VOICE_BRIEFINGS_DIR = path.join("public", "generated", "voice-briefings");

export type VoiceMemoSegmentWithTiming = {
  id: string;
  headline: string;
  startMs: number;
  endMs: number;
  deeplink?: string;
};

export type VoiceMemoPayload = {
  audioUrl: string;
  mimeType: string;
  durationMs: number;
  segments: VoiceMemoSegmentWithTiming[];
};

export { computeSegmentOffsetsMs } from "@/lib/utils/voice-timeline";

/**
 * The opening segment is just a short greeting ("Hi Morgan…"). The default
 * tts-1 cadence makes that intro feel a beat too slow before the substance
 * starts, so we render only the first segment a touch faster. The body of
 * the brief stays at natural pace.
 */
const GREETING_SPEED = 1.1;
const BODY_SPEED = 1.0;

async function getMp3DurationMs(buffer: Buffer): Promise<number> {
  try {
    const meta = await parseBuffer(buffer);
    const sec = meta.format.duration;
    if (sec != null && sec > 0 && Number.isFinite(sec)) {
      return Math.round(sec * 1000);
    }
  } catch {
    // fall through
  }
  return estimateDurationFromBytes(buffer.length);
}

/** Rough fallback when metadata is missing (~64 kbps MP3 assumption). */
export function estimateDurationFromBytes(bytes: number): number {
  const kbps = 64;
  return Math.round((bytes * 8) / kbps);
}

export async function synthesizeVoiceMemo(
  partnerId: string,
  segments: VoiceMemoSegmentScript[]
): Promise<VoiceMemoPayload | null> {
  if (!openai || segments.length === 0) return null;

  const cacheKey = createHash("sha256")
    .update(
      partnerId +
        "\n" +
        `greet=${GREETING_SPEED};body=${BODY_SPEED}` +
        "\n" +
        segments.map((s) => s.script).join("\0")
    )
    .digest("hex");

  const dir = path.join(process.cwd(), VOICE_BRIEFINGS_DIR);
  const mp3Path = path.join(dir, `${cacheKey}.mp3`);
  const metaPath = path.join(dir, `${cacheKey}.json`);

  try {
    const existing = await fs.readFile(metaPath, "utf-8");
    const parsed = JSON.parse(existing) as VoiceMemoPayload;
    if (
      parsed?.audioUrl &&
      typeof parsed.durationMs === "number" &&
      Array.isArray(parsed.segments) &&
      parsed.segments.length > 0
    ) {
      try {
        await fs.access(mp3Path);
        return parsed;
      } catch {
        // meta without audio — regenerate
      }
    }
  } catch {
    // cache miss
  }

  try {
    const buffers: Buffer[] = [];
    const durationsMs: number[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const res = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: seg.script,
        speed: i === 0 ? GREETING_SPEED : BODY_SPEED,
      });
      const buf = Buffer.from(await res.arrayBuffer());
      buffers.push(buf);
      let dur = await getMp3DurationMs(buf);
      if (dur <= 0) dur = estimateDurationFromBytes(buf.length);
      durationsMs.push(dur);
    }

    const combined = Buffer.concat(buffers);
    const { startMs, endMs, totalMs } = computeSegmentOffsetsMs(durationsMs);

    const timed: VoiceMemoSegmentWithTiming[] = segments.map((s, i) => ({
      id: s.id,
      headline: s.headline,
      startMs: startMs[i]!,
      endMs: endMs[i]!,
      ...(s.deeplink ? { deeplink: s.deeplink } : {}),
    }));

    const payload: VoiceMemoPayload = {
      audioUrl: `/generated/voice-briefings/${cacheKey}.mp3`,
      mimeType: "audio/mpeg",
      durationMs: totalMs,
      segments: timed,
    };

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(mp3Path, combined);
    await fs.writeFile(metaPath, JSON.stringify(payload), "utf-8");

    return payload;
  } catch (err) {
    console.error("[voice-briefing] synthesize failed:", err);
    return null;
  }
}

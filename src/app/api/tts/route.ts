import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { openai } from "@/lib/services/llm-core";

const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = "sage";
const TTS_INSTRUCTIONS = [
  "Personality: a sharp, energetic executive assistant who actually knows the listener — bright, present, and quietly excited to kick off their day. Think trusted right-hand, not customer service.",
  "Voice: unmistakably human. Real warmth, real smile, real breath. You are a person talking to a friend over the desk, not an assistant reading copy.",
  "Energy: crisp and forward-leaning. Lift the listener — never sleepy, never neutral, never theatrical. The opening should feel like 'hey, good to see you, here's the deal'.",
  "Pacing: brisk and conversational. Move through context quickly; only slow down on names, companies, numbers, and the verb of each recommended action so they land.",
  "Inflection: lots of melodic variety. Pitch lifts on new information and on names. Settle and ground on the recommendations. Absolutely no flat newsreader cadence.",
  "Phrasing: heavy on natural contractions — you're, here's, let's, they've. Allow soft connectors like 'so', 'okay', 'and' to glue thoughts. Vary sentence rhythm; don't pause uniformly at every comma.",
  "Emphasis: hit the action verbs ('follow up', 'reconnect', 'prep', 'reach out') so the listener feels momentum and a clear next step.",
  "Hard avoids: robotic enunciation, AI-assistant cadence, over-pronouncing punctuation, formal corporate stiffness, monotone delivery, audiobook narration, or any 'announcer' quality. Do not sound like a synthesized voice.",
].join(" ");

/** Disk cache for TTS outputs. Cold first generation costs ~3-10s on the
 *  McKinsey AI Gateway; the briefing TTS text changes only when the
 *  underlying briefing changes, so caching by content hash means every
 *  subsequent "Play" tap returns in tens of ms. Files are tiny (~150KB) and
 *  pruning is a non-issue at single-tenant demo scale. */
const TTS_CACHE_DIR = path.join("public", "generated", "voice-tts");

function cacheKeyFor(text: string): string {
  return createHash("sha256")
    .update(`${TTS_MODEL}|${TTS_VOICE}|${TTS_INSTRUCTIONS}\n${text}`)
    .digest("hex");
}

function mp3Response(buffer: Buffer, cached: boolean): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "X-TTS-Cache": cached ? "hit" : "miss",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    await requirePartnerId();

    if (!openai) {
      return NextResponse.json(
        { error: "TTS not available", fallback: true },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 },
      );
    }

    const key = cacheKeyFor(text);
    const dir = path.join(process.cwd(), TTS_CACHE_DIR);
    const mp3Path = path.join(dir, `${key}.mp3`);

    try {
      const cached = await fs.readFile(mp3Path);
      if (cached.length > 0) return mp3Response(cached, true);
    } catch {
      // cache miss — fall through to live generation
    }

    const response = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text,
      instructions: TTS_INSTRUCTIONS,
      response_format: "mp3",
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    // Persist after we've materialized the buffer. Failure to write the
    // cache must NEVER fail the response — partners still get audio, the
    // next play just regenerates.
    fs.mkdir(dir, { recursive: true })
      .then(() => fs.writeFile(mp3Path, buffer))
      .catch((err) => console.warn("[tts] cache write failed:", err));

    return mp3Response(buffer, false);
  } catch (err) {
    console.error("[tts] Error:", err);
    return NextResponse.json(
      { error: "TTS generation failed", fallback: true },
      { status: 503 },
    );
  }
}

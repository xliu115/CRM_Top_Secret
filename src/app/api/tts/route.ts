import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { openai } from "@/lib/services/llm-core";

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

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "sage",
      input: text,
      instructions: [
        "Personality: a sharp, energetic executive assistant who actually knows the listener — bright, present, and quietly excited to kick off their day. Think trusted right-hand, not customer service.",
        "Voice: unmistakably human. Real warmth, real smile, real breath. You are a person talking to a friend over the desk, not an assistant reading copy.",
        "Energy: crisp and forward-leaning. Lift the listener — never sleepy, never neutral, never theatrical. The opening should feel like 'hey, good to see you, here's the deal'.",
        "Pacing: brisk and conversational. Move through context quickly; only slow down on names, companies, numbers, and the verb of each recommended action so they land.",
        "Inflection: lots of melodic variety. Pitch lifts on new information and on names. Settle and ground on the recommendations. Absolutely no flat newsreader cadence.",
        "Phrasing: heavy on natural contractions — you're, here's, let's, they've. Allow soft connectors like 'so', 'okay', 'and' to glue thoughts. Vary sentence rhythm; don't pause uniformly at every comma.",
        "Emphasis: hit the action verbs ('follow up', 'reconnect', 'prep', 'reach out') so the listener feels momentum and a clear next step.",
        "Hard avoids: robotic enunciation, AI-assistant cadence, over-pronouncing punctuation, formal corporate stiffness, monotone delivery, audiobook narration, or any 'announcer' quality. Do not sound like a synthesized voice.",
      ].join(" "),
      response_format: "mp3",
    });

    const stream = response.body as ReadableStream;

    return new Response(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[tts] Error:", err);
    return NextResponse.json(
      { error: "TTS generation failed", fallback: true },
      { status: 503 },
    );
  }
}

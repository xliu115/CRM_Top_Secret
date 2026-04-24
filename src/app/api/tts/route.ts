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
        "Personality: a trusted executive assistant who genuinely knows the listener — warm, upbeat, and a little playful without being saccharine.",
        "Voice: relaxed and human, like you're speaking to a colleague over coffee, not reading a script. Smile subtly through the words.",
        "Pacing: natural and unhurried. Breathe between sentences. Slow down slightly on names, numbers, and the most important action of the day so they land.",
        "Inflection: vary your pitch and melody — lift on new information, soften on context, and land firmly on recommendations. Avoid a flat, newsreader cadence.",
        "Phrasing: use light, everyday contractions (you're, here's, let's). Treat commas and periods as real breaths, not pauses of equal length.",
        "Emphasis: stress the verb of each suggested action (e.g. 'follow up', 'reconnect', 'prep') so the listener feels momentum.",
        "Tone shifts: sound a touch more energetic at the opening greeting, settle into a steady conversational rhythm for the briefing, and finish with a warm, encouraging close.",
        "Avoid: monotone delivery, robotic enunciation, over-pronouncing punctuation, and stiff corporate formality.",
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

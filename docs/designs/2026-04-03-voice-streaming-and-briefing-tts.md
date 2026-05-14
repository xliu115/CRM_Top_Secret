# Voice Streaming Transcription + Mobile Briefing TTS

**Date:** 2026-04-03
**Status:** Design approved, pending implementation plan

## Overview

Two voice interaction improvements to the ClientIQ platform:

1. **Live streaming transcription** — words appear as the user speaks (across all voice-input surfaces), replacing the current record-then-transcribe flow.
2. **Mobile briefing voice-over** — tap-to-play TTS narration of the daily briefing on the mobile interface, adding a "listen" interaction model alongside the existing text.

## Decisions

- **Streaming transcription approach:** Chunked Whisper (send 3-second audio chunks to the existing Whisper endpoint during recording). The OpenAI Realtime API was evaluated but rejected for now because (a) the McKinsey AI gateway likely does not support WebSocket connections, and (b) Next.js serverless route handlers cannot perform HTTP upgrades to WebSocket. Noted as a future upgrade path.
- **TTS approach:** OpenAI `gpt-4o-mini-tts` with streaming audio response, with browser `SpeechSynthesis` as a fallback if the gateway does not expose the TTS endpoint.
- **Auto-send behavior preserved:** After the user stops recording, the final transcript auto-sends (same as current behavior). Live preview is visual feedback only.
- **TTS scope:** Reads the narrative paragraph plus top actions. Does not read structured data (meetings list, nudges list).
- **TTS surface:** Mobile only (`/mobile`). Desktop briefing remains text-only.

---

## Feature 1: Live Streaming Transcription

### Current State

Voice input uses `MediaRecorder` to capture the full audio, then uploads it as a single file to `POST /api/transcribe`, which calls `openai.audio.transcriptions.create` with `whisper-1`. The user sees nothing until recording stops and transcription completes. Auto-send fires after transcription.

**Files involved:**
- `src/hooks/use-speech-recognition.ts` — recording + single-shot transcription
- `src/hooks/use-chat-session.ts` — wires voice result to auto-send
- `src/app/api/transcribe/route.ts` — Whisper API call
- `src/app/mobile/page.tsx` — mobile voice UI (via `useChatSession`)
- `src/app/chat/page.tsx` — chat voice UI (via `useChatSession`)
- `src/app/dashboard/page.tsx` — dashboard voice UI (direct `useSpeechRecognition`)

### Architecture

```
Browser Mic
  │
  ├─ getUserMedia + MediaRecorder.start(3000)
  │
  │  [every 3 seconds: ondataavailable]
  │    │
  │    ├─ POST /api/transcribe { file, prompt? }
  │    │    └─ whisper-1 with prompt = transcript-so-far
  │    │    └─ returns { text }
  │    │
  │    └─ Append text to liveTranscript (ordered by sequence number)
  │         └─ UI shows live preview bubble
  │
  └─ stopListening()
       ├─ Send final partial chunk
       ├─ Wait for all in-flight requests
       ├─ Fire onResult(fullTranscript)
       └─ Auto-send (unchanged behavior)
```

### New Hook: `useStreamingTranscription`

Replaces `useSpeechRecognition`. Same external interface so consuming components require minimal changes.

**Interface:**
```typescript
type UseStreamingTranscriptionOptions = {
  lang?: string;
  onResult?: (transcript: string) => void;
};

function useStreamingTranscription(options?: UseStreamingTranscriptionOptions): {
  isListening: boolean;
  isTranscribing: boolean;
  liveTranscript: string;
  isSupported: boolean;
  error: string | null;
  duration: number;
  startListening: () => Promise<void>;
  stopListening: () => void;
};
```

**Internal behavior:**
- `startListening`: calls `getUserMedia`, creates `MediaRecorder` with the same codec negotiation as today (webm/opus preferred, mp4 fallback), calls `recorder.start(3000)`.
- `ondataavailable`: each chunk is assigned a sequence number, wrapped in a `File`, sent via `POST /api/transcribe` with an optional `prompt` field containing the transcript accumulated so far.
- Responses are applied in sequence order. If chunk 3 returns before chunk 2, chunk 3 is buffered until chunk 2 resolves. This prevents out-of-order transcript display.
- `liveTranscript` is a reactive string that updates as each chunk's transcription returns.
- `stopListening`: stops the recorder, sends the final partial chunk, sets `isTranscribing = true`, waits for all pending requests, then fires `onResult` with the concatenated transcript. Sets `isTranscribing = false` and `isListening = false`.
- Minimum chunk size check: chunks smaller than ~1000 bytes are skipped (silence/noise).
- The old `useSpeechRecognition` hook is kept but deprecated; all call sites migrate to the new hook.

### API Route Change: `/api/transcribe`

Minor extension — accept an optional `prompt` string in the FormData:

```typescript
const prompt = formData.get("prompt") as string | null;

const transcription = await openai.audio.transcriptions.create({
  model: "whisper-1",
  file,
  language: "en",
  ...(prompt && { prompt }),
});
```

Whisper's `prompt` parameter guides the model toward coherent continuation, reducing repetition at chunk boundaries.

### UI: Live Transcript Preview

All three voice-input surfaces (mobile, chat, dashboard) show a floating preview while recording:

- **Position:** above the input bar, overlaying the chat content slightly
- **Style:** light semi-transparent background (`bg-card/90 backdrop-blur`), rounded, animated text cursor (blinking caret) at the end of the text
- **Content:** the `liveTranscript` string, updating every ~3 seconds as chunks return
- **Size:** max 3 lines on mobile, scrolls if longer. Full width minus padding.
- **Behavior:** appears when `isListening && liveTranscript.length > 0`, fades out when recording stops
- **Empty state:** while recording before the first chunk returns, show the existing recording indicator (duration + pulsing mic) — no preview bubble yet

### Error Handling

- If a single chunk fails: skip it, continue with the next. The transcript will have a gap but remain usable.
- If all chunks fail (e.g., expired API token): collect full audio as a blob and attempt one final single-shot transcription on stop (graceful degradation to current behavior).
- On 403: surface "Session expired — please refresh your API token" to the user via the `error` state.

### Migration

- `use-chat-session.ts`: change import from `useSpeechRecognition` to `useStreamingTranscription`. No other changes needed — the interface is identical.
- `dashboard/page.tsx`: same import swap. The `liveTranscript` binding to `setChatInput` continues to work but now updates incrementally.
- Add live preview UI component to mobile, chat, and dashboard input areas.

---

## Feature 2: Mobile Briefing Voice-Over (TTS)

### Current State

The mobile daily briefing is a text message rendered as markdown in the chat thread. There is no audio playback, no TTS, and no text-to-speech infrastructure anywhere in the codebase.

**Files involved:**
- `src/app/mobile/page.tsx` — briefing fetch, rendering, quick actions
- `src/app/api/dashboard/briefing/route.ts` — briefing data API
- `src/lib/services/llm-briefing.ts` — narrative generation

### Architecture

```
User taps Play button on briefing message
  │
  ├─ POST /api/tts { text: prepared briefing string }
  │    └─ openai.audio.speech.create (gpt-4o-mini-tts, voice: "coral", mp3, streaming)
  │    └─ Stream audio bytes back to client
  │
  ├─ Client creates Blob URL from response
  ├─ Assigns to Audio element → playback starts
  │
  └─ Controls: pause / resume / stop
       └─ If API fails → fallback to browser SpeechSynthesis
```

### New API Route: `POST /api/tts`

```typescript
// src/app/api/tts/route.ts
export async function POST(request: NextRequest) {
  try {
    await requirePartnerId();

    if (!openai) {
      return NextResponse.json(
        { error: "TTS not available", fallback: true },
        { status: 503 }
      );
    }

    const { text } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: text,
      instructions: "Speak in a warm, professional tone like a personal assistant giving a morning briefing. Be clear and concise.",
      response_format: "mp3",
    });

    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("[tts] Error:", err);
    return NextResponse.json(
      { error: "TTS generation failed", fallback: true },
      { status: 503 }
    );
  }
}
```

If the gateway rejects the TTS call or any error occurs, the route returns `{ error: "...", fallback: true }` with status 503, signaling the client to use browser TTS.

### TTS Content Preparation

A utility function (in `src/lib/utils/tts-prepare.ts`) prepares the briefing text for spoken delivery:

```typescript
function prepareBriefingForTTS(
  narrative: string,
  topActions: BriefingData["topActions"]
): string
```

- Strips markdown formatting (bold, links, headers, bullets)
- Converts top actions into natural spoken sentences: "Your top priority is to follow up with Sarah Chen at Acme Corp about the quarterly review."
- Joins narrative + spoken actions with a transition phrase: "Here are your priorities for today."
- Target length: 150-300 words (~30-60 seconds of speech)

### New Hook: `useBriefingAudio`

```typescript
function useBriefingAudio(): {
  play: (text: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  error: string | null;
};
```

**Internal behavior:**
- `play(text)`: sets `isLoading = true`, fetches `POST /api/tts` with the text, consumes the full streamed response into a `Blob` (via `response.blob()`), creates a blob URL with `URL.createObjectURL`, assigns to an `Audio` element, starts playback. Sets `isPlaying = true` on the `canplay` event. Note: we consume the full stream into a blob rather than using `MediaSource` for progressive playback — this is simpler, more cross-browser compatible (especially on iOS Safari), and the briefing audio is short enough (~30-60s) that the download completes quickly.
- `pause()` / `resume()`: delegates to `Audio.pause()` / `Audio.play()`.
- `stop()`: pauses and resets `currentTime = 0`.
- On `Audio.ended`: resets all state.
- On fetch error with status 503 and `fallback: true`: switches to `window.speechSynthesis`:
  - Creates `SpeechSynthesisUtterance` with the same text
  - Selects best English voice via `speechSynthesis.getVoices().filter(v => v.lang.startsWith("en"))`
  - Maps pause/resume/stop to `speechSynthesis.pause()` / `.resume()` / `.cancel()`
- Cleans up Audio element and revokes blob URL on unmount.

### Mobile UI Changes

Only the mobile page (`src/app/mobile/page.tsx`) gets TTS controls. Changes to the briefing message rendering:

**Play button on briefing message:**
- Rendered at the bottom of messages where `msg.id.startsWith("briefing-")`
- Small inline button: play icon + "Listen" label (or pause icon + elapsed time while playing)
- While loading: spinner replaces play icon
- While playing: pause button + "0:15" elapsed counter
- While paused: play button + "Paused"
- A small "AI voice" caption below the button (OpenAI usage policy compliance)

**Interaction rules:**
- Typing or tapping quick actions while audio plays does NOT interrupt audio
- Navigating away from `/mobile` stops and cleans up audio
- Respects device volume and silent mode (standard `Audio` element behavior)
- No autoplay — strictly tap-to-play
- Play button only appears after briefing has loaded (not during skeleton state)

### Fallback: Browser SpeechSynthesis

If the OpenAI TTS endpoint is unavailable (gateway blocks it, 503, network error):

- The hook transparently switches to `window.speechSynthesis`
- Same play/pause/stop controls work
- Voice quality is lower but functional
- No visual indicator of fallback mode (seamless to the user)
- If `speechSynthesis` is also unavailable (rare), the play button is hidden

---

## Future Upgrade Path

### Realtime API for Transcription

When the McKinsey AI gateway adds WebSocket/Realtime API support:

1. Replace the internals of `useStreamingTranscription` with a WebSocket connection to OpenAI's Realtime Transcription API
2. Use `gpt-4o-transcribe` model for true word-by-word delta streaming
3. Use the ephemeral token pattern: `POST /api/realtime-token` returns a short-lived session token, browser connects directly to `wss://api.openai.com/v1/realtime`
4. External hook interface stays identical — zero changes in consuming components

### Voice Conversation Mode

The TTS + streaming transcription foundation enables a future "voice conversation" mode on mobile:
- Briefing reads aloud (TTS)
- User responds by voice (streaming transcription)
- Assistant response reads aloud (TTS)
- Continuous listen-and-talk loop

This is explicitly out of scope for this iteration but the architecture supports it.

---

## Dependencies

- `openai` npm package (already installed) — used for both Whisper and TTS calls
- No new npm dependencies required
- OpenAI API features used: `audio.transcriptions.create` (existing), `audio.speech.create` (new)

## Open Questions (Resolved)

- **Gateway TTS support?** — Will be tested early in implementation. Fallback to browser SpeechSynthesis is designed in.
- **Chunk interval?** — 3 seconds chosen as balance between latency (shorter = more responsive) and accuracy (longer = better context for Whisper). Tunable.
- **TTS voice?** — "coral" selected. Can be changed to "marin" or "cedar" (recommended by OpenAI for quality) during implementation if preferred.

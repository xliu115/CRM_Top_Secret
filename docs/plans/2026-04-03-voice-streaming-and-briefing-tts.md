# Voice Streaming Transcription + Mobile Briefing TTS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live streaming transcription (words appear while speaking) across all voice surfaces, and tap-to-play TTS narration of the mobile daily briefing.

**Architecture:** Chunked Whisper transcription sends 3-second audio chunks to the existing `/api/transcribe` endpoint during recording, accumulating partial transcripts. TTS uses OpenAI `gpt-4o-mini-tts` via a new `/api/tts` route with browser SpeechSynthesis fallback.

**Tech Stack:** Next.js 16, React hooks, OpenAI SDK (`openai` npm — already installed), MediaRecorder API, Web Audio (Audio element for playback), Vitest for tests.

**Design spec:** [`docs/designs/2026-04-03-voice-streaming-and-briefing-tts.md`](../designs/2026-04-03-voice-streaming-and-briefing-tts.md)

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `src/hooks/use-streaming-transcription.ts` | Chunked MediaRecorder + incremental Whisper transcription hook |
| `src/hooks/use-briefing-audio.ts` | TTS playback lifecycle hook (OpenAI TTS + SpeechSynthesis fallback) |
| `src/app/api/tts/route.ts` | OpenAI TTS API route, streams MP3 back to client |
| `src/lib/utils/tts-prepare.ts` | Prepares briefing text for spoken delivery (strip markdown, format actions) |
| `src/components/voice/live-transcript-preview.tsx` | Floating live transcript bubble shown while recording |
| `src/components/voice/briefing-audio-controls.tsx` | Play/pause/stop UI for briefing TTS on mobile |
| `tests/streaming-transcription.test.ts` | Tests for chunk sequencing, ordering, error handling |
| `tests/tts-prepare.test.ts` | Tests for briefing text preparation |
| `tests/briefing-audio.test.ts` | Tests for TTS hook fallback logic |

### Modified files

| File | Change |
|------|--------|
| `src/app/api/transcribe/route.ts` | Accept optional `prompt` FormData field, pass to Whisper |
| `src/hooks/use-chat-session.ts` | Import `useStreamingTranscription` instead of `useSpeechRecognition` |
| `src/app/mobile/page.tsx` | Add live transcript preview, add briefing audio controls |
| `src/app/chat/page.tsx` | Add live transcript preview |
| `src/app/dashboard/page.tsx` | Swap to `useStreamingTranscription`, add live transcript preview |

### Unchanged (kept for reference)

| File | Note |
|------|------|
| `src/hooks/use-speech-recognition.ts` | Kept but deprecated — no call sites after migration |

---

## Task 1: Extend `/api/transcribe` to Accept Prompt

**Files:**
- Modify: `src/app/api/transcribe/route.ts`
- Test: `tests/streaming-transcription.test.ts` (partial — prompt forwarding)

- [ ] **Step 1: Write the test for prompt forwarding**

Create `tests/streaming-transcription.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({ text: "hello world" });

vi.mock("@/lib/services/llm-core", () => ({
  openai: {
    audio: {
      transcriptions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    },
  },
}));

vi.mock("@/lib/auth/get-current-partner", () => ({
  requirePartnerId: vi.fn().mockResolvedValue("partner-1"),
}));

describe("transcribe route - prompt parameter", () => {
  it("passes prompt to Whisper when provided", async () => {
    const { POST } = await import("@/app/api/transcribe/route");

    const formData = new FormData();
    const audioBlob = new Blob(["fake-audio-data-that-is-long-enough-to-pass"], {
      type: "audio/webm",
    });
    formData.append("file", new File([audioBlob], "recording.webm", { type: "audio/webm" }));
    formData.append("prompt", "Good morning I wanted to");

    const request = new Request("http://localhost:3000/api/transcribe", {
      method: "POST",
      body: formData,
    });

    await POST(request as any);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "whisper-1",
        language: "en",
        prompt: "Good morning I wanted to",
      }),
    );
  });

  it("omits prompt when not provided", async () => {
    mockCreate.mockClear();
    const { POST } = await import("@/app/api/transcribe/route");

    const formData = new FormData();
    const audioBlob = new Blob(["fake-audio-data-that-is-long-enough-to-pass"], {
      type: "audio/webm",
    });
    formData.append("file", new File([audioBlob], "recording.webm", { type: "audio/webm" }));

    const request = new Request("http://localhost:3000/api/transcribe", {
      method: "POST",
      body: formData,
    });

    await POST(request as any);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.prompt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/streaming-transcription.test.ts`
Expected: FAIL — current route ignores `prompt` field.

- [ ] **Step 3: Implement prompt forwarding in the transcribe route**

Modify `src/app/api/transcribe/route.ts` — add prompt extraction after the file validation:

```typescript
// After: const file = formData.get("file");
// After: if (!file || !(file instanceof File)) { ... }

const prompt = formData.get("prompt") as string | null;

const transcription = await openai.audio.transcriptions.create({
  model: "whisper-1",
  file,
  language: "en",
  ...(prompt ? { prompt } : {}),
});
```

The full route stays the same except for these two additions (the `prompt` extraction line and the spread in the create call).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/streaming-transcription.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/transcribe/route.ts tests/streaming-transcription.test.ts
git commit -m "feat(transcribe): accept optional prompt for Whisper continuity"
```

---

## Task 2: Create `useStreamingTranscription` Hook

**Files:**
- Create: `src/hooks/use-streaming-transcription.ts`

- [ ] **Step 1: Create the streaming transcription hook**

Create `src/hooks/use-streaming-transcription.ts`:

```typescript
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type UseStreamingTranscriptionOptions = {
  lang?: string;
  onResult?: (transcript: string) => void;
};

type ChunkResult = {
  seq: number;
  text: string;
  resolved: boolean;
};

export function useStreamingTranscription(
  options: UseStreamingTranscriptionOptions = {},
) {
  const { onResult } = options;
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const seqRef = useRef(0);
  const resultsRef = useRef<ChunkResult[]>([]);
  const pendingCountRef = useRef(0);
  const transcriptSoFarRef = useRef("");
  const fullAudioChunksRef = useRef<Blob[]>([]);
  const stoppedRef = useRef(false);
  const resolveAllPendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const rebuildTranscript = useCallback(() => {
    const results = resultsRef.current;
    let text = "";
    for (let i = 0; i < results.length; i++) {
      if (!results[i].resolved) break;
      text += (text && results[i].text ? " " : "") + results[i].text;
    }
    transcriptSoFarRef.current = text;
    setLiveTranscript(text);
    return text;
  }, []);

  const sendChunk = useCallback(
    async (blob: Blob, seq: number) => {
      if (blob.size < 1000) {
        resultsRef.current[seq] = { seq, text: "", resolved: true };
        rebuildTranscript();
        return;
      }

      pendingCountRef.current++;
      const mimeType = blob.type;
      const ext = mimeType.includes("webm") ? "webm" : "m4a";
      const file = new File([blob], `chunk-${seq}.${ext}`, { type: mimeType });
      const formData = new FormData();
      formData.append("file", file);

      const promptText = transcriptSoFarRef.current;
      if (promptText) {
        formData.append("prompt", promptText);
      }

      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          if (res.status === 403) {
            setError("Session expired — please refresh your API token");
          }
          resultsRef.current[seq] = { seq, text: "", resolved: true };
        } else {
          const { text } = await res.json();
          resultsRef.current[seq] = {
            seq,
            text: text?.trim() || "",
            resolved: true,
          };
        }
      } catch {
        resultsRef.current[seq] = { seq, text: "", resolved: true };
      } finally {
        pendingCountRef.current--;
        rebuildTranscript();
        if (pendingCountRef.current === 0 && resolveAllPendingRef.current) {
          resolveAllPendingRef.current();
          resolveAllPendingRef.current = null;
        }
      }
    },
    [rebuildTranscript],
  );

  const startListening = useCallback(async () => {
    setError(null);
    setLiveTranscript("");
    setDuration(0);
    seqRef.current = 0;
    resultsRef.current = [];
    pendingCountRef.current = 0;
    transcriptSoFarRef.current = "";
    fullAudioChunksRef.current = [];
    stoppedRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          fullAudioChunksRef.current.push(e.data);

          if (!stoppedRef.current) {
            const seq = seqRef.current++;
            resultsRef.current[seq] = { seq, text: "", resolved: false };
            sendChunk(e.data, seq);
          }
        }
      };

      recorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        stoppedRef.current = true;

        setIsTranscribing(true);

        if (pendingCountRef.current > 0) {
          await new Promise<void>((resolve) => {
            resolveAllPendingRef.current = resolve;
          });
        }

        const finalTranscript = transcriptSoFarRef.current;

        if (finalTranscript.trim()) {
          onResultRef.current?.(finalTranscript.trim());
        } else {
          const fullBlob = new Blob(fullAudioChunksRef.current, { type: mimeType });
          if (fullBlob.size >= 1000) {
            try {
              const file = new File(
                [fullBlob],
                `recording.${mimeType.includes("webm") ? "webm" : "m4a"}`,
                { type: mimeType },
              );
              const formData = new FormData();
              formData.append("file", file);
              const res = await fetch("/api/transcribe", {
                method: "POST",
                body: formData,
              });
              if (res.ok) {
                const { text } = await res.json();
                if (text?.trim()) {
                  onResultRef.current?.(text.trim());
                }
              }
            } catch {
              // Fallback also failed — nothing to send
            }
          }
        }

        setIsTranscribing(false);
        setIsListening(false);
      };

      recorder.start(3000);
      setIsListening(true);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
      ) {
        setError(
          "Microphone access denied. Please allow microphone permission and try again.",
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to start recording",
        );
      }
      setIsListening(false);
    }
  }, [sendChunk]);

  const stopListening = useCallback(() => {
    stoppedRef.current = true;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    isListening,
    isTranscribing,
    transcript: liveTranscript,
    liveTranscript,
    isSupported,
    error,
    duration,
    startListening,
    stopListening,
  };
}
```

- [ ] **Step 2: Verify the hook compiles**

Run: `npx tsc --noEmit src/hooks/use-streaming-transcription.ts` or check for lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-streaming-transcription.ts
git commit -m "feat: add useStreamingTranscription hook with chunked Whisper"
```

---

## Task 3: Create Live Transcript Preview Component

**Files:**
- Create: `src/components/voice/live-transcript-preview.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/voice/live-transcript-preview.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

type LiveTranscriptPreviewProps = {
  transcript: string;
  isListening: boolean;
  duration: number;
};

export function LiveTranscriptPreview({
  transcript,
  isListening,
  duration,
}: LiveTranscriptPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  if (!isListening) return null;

  if (!transcript) {
    return (
      <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-card/90 px-4 py-3 shadow-sm backdrop-blur">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
        </span>
        <span className="text-sm text-muted-foreground">
          Listening... {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
        </span>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2 rounded-xl bg-card/90 px-4 py-3 shadow-sm backdrop-blur">
      <div
        ref={scrollRef}
        className="max-h-[4.5rem] overflow-y-auto text-[15px] leading-relaxed text-foreground"
      >
        {transcript}
        <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/voice/live-transcript-preview.tsx
git commit -m "feat: add LiveTranscriptPreview component"
```

---

## Task 4: Migrate Voice Input Consumers

**Files:**
- Modify: `src/hooks/use-chat-session.ts`
- Modify: `src/app/mobile/page.tsx`
- Modify: `src/app/chat/page.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Migrate `use-chat-session.ts`**

In `src/hooks/use-chat-session.ts`, change the import on line 4:

```typescript
// Before:
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

// After:
import { useStreamingTranscription } from "@/hooks/use-streaming-transcription";
```

And change the hook call (around line 34-42):

```typescript
// Before:
  const {
    isListening,
    isTranscribing,
    transcript: liveTranscript,
    isSupported: voiceSupported,
    duration: voiceDuration,
    startListening,
    stopListening,
  } = useSpeechRecognition({ onResult: handleVoiceResult });

// After:
  const {
    isListening,
    isTranscribing,
    transcript: liveTranscript,
    isSupported: voiceSupported,
    duration: voiceDuration,
    startListening,
    stopListening,
  } = useStreamingTranscription({ onResult: handleVoiceResult });
```

Also export `liveTranscript` from the hook return (add to the return object around line 131-149):

```typescript
  return {
    messages,
    input,
    setInput,
    loading,
    scrollRef,
    inputRef,
    handleSend,
    handleClearChat,
    handleKeyDown,
    prependMessage,
    isListening,
    isTranscribing,
    liveTranscript,
    voiceSupported,
    voiceDuration,
    startListening,
    stopListening,
  };
```

- [ ] **Step 2: Add live preview to mobile page**

In `src/app/mobile/page.tsx`, add the import at the top:

```typescript
import { LiveTranscriptPreview } from "@/components/voice/live-transcript-preview";
```

Destructure `liveTranscript` from `useChatSession()` (around line 96-113 — it's already aliased but now also available directly):

```typescript
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
    prependMessage,
    isListening,
    isTranscribing,
    liveTranscript,
    voiceSupported,
    voiceDuration,
    startListening,
    stopListening,
  } = useChatSession();
```

Insert `<LiveTranscriptPreview>` just above the bottom bar's quick actions section (before the `<div className="shrink-0 border-t border-border bg-card">` around line 269):

```tsx
        <LiveTranscriptPreview
          transcript={liveTranscript}
          isListening={isListening}
          duration={voiceDuration}
        />

        {/* Bottom area: quick actions + input */}
        <div
          className="shrink-0 border-t border-border bg-card"
          ...
```

- [ ] **Step 3: Add live preview to chat page**

In `src/app/chat/page.tsx`, add the same import:

```typescript
import { LiveTranscriptPreview } from "@/components/voice/live-transcript-preview";
```

Add `liveTranscript` and `voiceDuration` to the destructured values from `useChatSession()`.

Insert `<LiveTranscriptPreview>` above the input bar area, same pattern as mobile.

- [ ] **Step 4: Migrate dashboard page**

In `src/app/dashboard/page.tsx`, change the import (around line where `useSpeechRecognition` is imported):

```typescript
// Before:
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

// After:
import { useStreamingTranscription } from "@/hooks/use-streaming-transcription";
```

Change the hook call:

```typescript
// Before:
  const { isListening, transcript: liveTranscript, isSupported, startListening, stopListening } =
    useSpeechRecognition({ onResult: handleVoiceResult });

// After:
  const { isListening, liveTranscript, isSupported, duration: voiceDuration, startListening, stopListening } =
    useStreamingTranscription({ onResult: handleVoiceResult });
```

The existing `useEffect` that syncs `liveTranscript` to `setChatInput` will continue to work unchanged.

- [ ] **Step 5: Verify all pages compile**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Manual smoke test**

1. Open `http://localhost:3000/mobile` — tap mic, speak for 6+ seconds, verify transcript text appears incrementally, stop and verify auto-send.
2. Open `http://localhost:3000/chat` — same test.
3. Open `http://localhost:3000/dashboard` — tap mic on hero input, verify live text in the input field, stop and verify navigation to chat.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-chat-session.ts src/app/mobile/page.tsx src/app/chat/page.tsx src/app/dashboard/page.tsx
git commit -m "feat: migrate all voice surfaces to streaming transcription with live preview"
```

---

## Task 5: Create TTS Text Preparation Utility

**Files:**
- Create: `src/lib/utils/tts-prepare.ts`
- Test: `tests/tts-prepare.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/tts-prepare.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { prepareBriefingForTTS } from "@/lib/utils/tts-prepare";

describe("prepareBriefingForTTS", () => {
  it("strips markdown from narrative", () => {
    const result = prepareBriefingForTTS(
      "**Good morning!** You have [3 meetings](http://example.com) today.",
      [],
    );
    expect(result).toBe("Good morning! You have 3 meetings today.");
  });

  it("appends top actions as spoken sentences", () => {
    const result = prepareBriefingForTTS("Hello.", [
      {
        contactName: "Sarah Chen",
        company: "Acme Corp",
        actionLabel: "Follow up",
        detail: "quarterly review discussion",
        deeplink: "/contacts/1",
      },
    ]);
    expect(result).toContain("Hello.");
    expect(result).toContain("Sarah Chen");
    expect(result).toContain("Acme Corp");
    expect(result).toContain("quarterly review discussion");
  });

  it("handles empty narrative gracefully", () => {
    const result = prepareBriefingForTTS("", [
      {
        contactName: "John",
        company: "BigCo",
        actionLabel: "Check in",
        detail: "project update",
        deeplink: "/contacts/2",
      },
    ]);
    expect(result).toContain("John");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles no actions", () => {
    const result = prepareBriefingForTTS("Your day looks clear.", []);
    expect(result).toBe("Your day looks clear.");
  });

  it("limits to reasonable spoken length", () => {
    const longNarrative = "Word ".repeat(500);
    const result = prepareBriefingForTTS(longNarrative, []);
    expect(result.split(" ").length).toBeLessThanOrEqual(350);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tts-prepare.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the utility**

Create `src/lib/utils/tts-prepare.ts`:

```typescript
import { stripMarkdownToPlainText } from "./strip-markdown";

type TopAction = {
  contactName: string;
  company: string;
  actionLabel: string;
  detail: string;
  deeplink: string;
  contactId?: string;
};

const MAX_WORDS = 300;

export function prepareBriefingForTTS(
  narrative: string,
  topActions: TopAction[],
): string {
  const parts: string[] = [];

  const plainNarrative = stripMarkdownToPlainText(narrative).trim();
  if (plainNarrative) {
    parts.push(plainNarrative);
  }

  if (topActions.length > 0) {
    parts.push("Here are your priorities for today.");

    topActions.forEach((action, i) => {
      const ordinal =
        i === 0 ? "First" : i === 1 ? "Second" : i === 2 ? "Third" : `Next`;
      const sentence = `${ordinal}, ${action.actionLabel.toLowerCase()} with ${action.contactName} at ${action.company} regarding ${action.detail}.`;
      parts.push(sentence);
    });
  }

  let text = parts.join(" ");

  const words = text.split(/\s+/);
  if (words.length > MAX_WORDS) {
    text = words.slice(0, MAX_WORDS).join(" ") + ".";
  }

  return text;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tts-prepare.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/tts-prepare.ts tests/tts-prepare.test.ts
git commit -m "feat: add prepareBriefingForTTS utility"
```

---

## Task 6: Create `/api/tts` Route

**Files:**
- Create: `src/app/api/tts/route.ts`

- [ ] **Step 1: Create the TTS API route**

Create `src/app/api/tts/route.ts`:

```typescript
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
      voice: "coral",
      input: text,
      instructions:
        "Speak in a warm, professional tone like a personal assistant giving a morning briefing. Be clear and concise.",
      response_format: "mp3",
    });

    return new Response(response.body as ReadableStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Manual test — verify gateway support**

Run the dev server, then test with curl:

```bash
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Good morning. Here is your daily briefing."}' \
  --output /tmp/test-briefing.mp3
```

If the file plays successfully, the gateway supports TTS. If it returns a 503 JSON error, the fallback path will be used. Note this result for the next task.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/tts/route.ts
git commit -m "feat: add /api/tts route for OpenAI text-to-speech"
```

---

## Task 7: Create `useBriefingAudio` Hook

**Files:**
- Create: `src/hooks/use-briefing-audio.ts`
- Test: `tests/briefing-audio.test.ts`

- [ ] **Step 1: Write tests for fallback logic**

Create `tests/briefing-audio.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("briefing audio - TTS prepare integration", () => {
  it("prepareBriefingForTTS produces non-empty output for typical briefing", async () => {
    const { prepareBriefingForTTS } = await import("@/lib/utils/tts-prepare");

    const result = prepareBriefingForTTS(
      "Good morning! You have 2 meetings today and 3 nudges to review.",
      [
        {
          contactName: "Sarah Chen",
          company: "Acme Corp",
          actionLabel: "Follow up",
          detail: "Q2 proposal",
          deeplink: "/contacts/1",
        },
      ],
    );

    expect(result.length).toBeGreaterThan(20);
    expect(result).not.toContain("**");
    expect(result).not.toContain("[");
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run tests/briefing-audio.test.ts`
Expected: PASS (uses already-implemented utility).

- [ ] **Step 3: Create the hook**

Create `src/hooks/use-briefing-audio.ts`:

```typescript
"use client";

import { useRef, useState, useCallback, useEffect } from "react";

type UseBriefingAudioReturn = {
  play: (text: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  error: string | null;
  elapsed: number;
};

export function useBriefingAudio(): UseBriefingAudioReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const synthUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const usingFallbackRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (usingFallbackRef.current) {
      window.speechSynthesis?.cancel();
      synthUtteranceRef.current = null;
    }
    usingFallbackRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setElapsed(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startTimer = useCallback(() => {
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }, []);

  const playWithSpeechSynthesis = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) {
        setError("Voice playback not available on this device");
        setIsLoading(false);
        return;
      }

      usingFallbackRef.current = true;
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      if (voices.length > 0) {
        utterance.voice = voices[0];
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsLoading(false);
        setIsPlaying(true);
        startTimer();
      };
      utterance.onend = () => cleanup();
      utterance.onerror = () => {
        setError("Voice playback failed");
        cleanup();
      };

      synthUtteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    },
    [cleanup, startTimer],
  );

  const play = useCallback(
    async (text: string) => {
      cleanup();
      setError(null);
      setIsLoading(true);

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (body.fallback) {
            playWithSpeechSynthesis(text);
            return;
          }
          throw new Error(body.error || "TTS failed");
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.oncanplay = () => {
          setIsLoading(false);
          setIsPlaying(true);
          startTimer();
          audio.play();
        };

        audio.onended = () => cleanup();

        audio.onerror = () => {
          setError("Audio playback failed");
          cleanup();
        };

        audio.load();
      } catch (err) {
        playWithSpeechSynthesis(text);
      }
    },
    [cleanup, playWithSpeechSynthesis, startTimer],
  );

  const pause = useCallback(() => {
    if (usingFallbackRef.current) {
      speechSynthesis?.pause();
    } else {
      audioRef.current?.pause();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (usingFallbackRef.current) {
      speechSynthesis?.resume();
    } else {
      audioRef.current?.play();
    }
    startTimer();
    setIsPlaying(true);
    setIsPaused(false);
  }, [startTimer]);

  const stop = useCallback(() => cleanup(), [cleanup]);

  return {
    play,
    pause,
    resume,
    stop,
    isPlaying,
    isPaused,
    isLoading,
    error,
    elapsed,
  };
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-briefing-audio.ts tests/briefing-audio.test.ts
git commit -m "feat: add useBriefingAudio hook with OpenAI TTS and SpeechSynthesis fallback"
```

---

## Task 8: Create Briefing Audio Controls Component

**Files:**
- Create: `src/components/voice/briefing-audio-controls.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/voice/briefing-audio-controls.tsx`:

```tsx
"use client";

import { Play, Pause, Square, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type BriefingAudioControlsProps = {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  elapsed: number;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function BriefingAudioControls({
  isPlaying,
  isPaused,
  isLoading,
  elapsed,
  onPlay,
  onPause,
  onResume,
  onStop,
}: BriefingAudioControlsProps) {
  if (isLoading) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled className="h-8 gap-1.5 px-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Loading...</span>
        </Button>
      </div>
    );
  }

  if (isPlaying) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPause}
          className="h-8 gap-1.5 px-3 text-primary"
        >
          <Pause className="h-3.5 w-3.5" />
          <span className="text-xs font-mono tabular-nums">{formatTime(elapsed)}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStop}
          className="h-8 w-8 p-0 text-muted-foreground"
        >
          <Square className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onResume}
          className="h-8 gap-1.5 px-3 text-primary"
        >
          <Play className="h-3.5 w-3.5" />
          <span className="text-xs">Resume</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStop}
          className="h-8 w-8 p-0 text-muted-foreground"
        >
          <Square className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onPlay}
        className="h-8 gap-1.5 px-3 text-muted-foreground hover:text-primary"
      >
        <Volume2 className="h-3.5 w-3.5" />
        <span className="text-xs">Listen</span>
      </Button>
      <span className="text-[10px] text-muted-foreground/60">AI voice</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/voice/briefing-audio-controls.tsx
git commit -m "feat: add BriefingAudioControls component"
```

---

## Task 9: Wire TTS into Mobile Briefing

**Files:**
- Modify: `src/app/mobile/page.tsx`

- [ ] **Step 1: Add imports and hook**

Add imports at the top of `src/app/mobile/page.tsx`:

```typescript
import { useBriefingAudio } from "@/hooks/use-briefing-audio";
import { BriefingAudioControls } from "@/components/voice/briefing-audio-controls";
import { prepareBriefingForTTS } from "@/lib/utils/tts-prepare";
```

Inside the `MobilePage` component, after the existing hook calls, add:

```typescript
  const briefingAudio = useBriefingAudio();

  const handlePlayBriefing = useCallback(() => {
    if (!briefingData) return;
    const ttsText = prepareBriefingForTTS(
      briefingData.briefing,
      briefingData.topActions,
    );
    briefingAudio.play(ttsText);
  }, [briefingData, briefingAudio]);
```

Also add the `useCallback` import if not already present.

- [ ] **Step 2: Add audio controls to briefing message**

In the message rendering section (around line 228-241), after the `<MarkdownContent>` for briefing messages, add the audio controls:

```tsx
{msg.role === "assistant" ? (
  msg.id.startsWith("briefing-") ? (
    <div>
      <MarkdownContent
        content={msg.content}
        className="text-[15px] leading-relaxed text-foreground"
      />
      <BriefingAudioControls
        isPlaying={briefingAudio.isPlaying}
        isPaused={briefingAudio.isPaused}
        isLoading={briefingAudio.isLoading}
        elapsed={briefingAudio.elapsed}
        onPlay={handlePlayBriefing}
        onPause={briefingAudio.pause}
        onResume={briefingAudio.resume}
        onStop={briefingAudio.stop}
      />
    </div>
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
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Manual smoke test**

1. Open `http://localhost:3000/mobile`
2. Wait for briefing to load
3. Tap "Listen" button on the briefing message
4. Verify audio plays (or falls back to browser voice if gateway blocks TTS)
5. Test pause/resume/stop controls
6. Verify the text briefing is still fully visible and unchanged

- [ ] **Step 5: Commit**

```bash
git add src/app/mobile/page.tsx
git commit -m "feat: wire TTS audio controls into mobile briefing"
```

---

## Task 10: Run Full Test Suite and Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass, including the new ones in `tests/streaming-transcription.test.ts`, `tests/tts-prepare.test.ts`, and `tests/briefing-audio.test.ts`.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: No new lint errors.

- [ ] **Step 4: End-to-end smoke test**

Test all three voice surfaces:

1. **Mobile** (`/mobile`): mic → live transcript preview → auto-send. Briefing → Listen → audio plays.
2. **Chat** (`/chat`): mic → live transcript preview → auto-send.
3. **Dashboard** (`/dashboard`): mic → live text in hero input → navigates to chat on stop.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues from final verification"
```

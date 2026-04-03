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

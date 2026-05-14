import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { callLLMJson } from "@/lib/services/llm-core";

type DraftJson = {
  title?: string;
  nextStep?: string | null;
  lens?: string;
  companyHint?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    await requirePartnerId();
    const body = (await request.json()) as { transcript?: string };
    const transcript =
      typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) {
      return NextResponse.json({ error: "transcript required" }, { status: 400 });
    }

    const parsed = await callLLMJson<DraftJson>(
      `You help partners capture pipeline items from spoken notes. Output JSON only with keys:
title (short working title), nextStep (one line or null), lens ("pipeline" or "clients"), companyHint (optional string).
Do not invent companies or people not mentioned. Use "pipeline" unless they clearly discuss account relationship level.`,
      `Transcript:\n${transcript}`,
      { maxTokens: 400, temperature: 0.2 },
    );

    if (parsed?.title) {
      return NextResponse.json({
        title: parsed.title,
        nextStep: parsed.nextStep ?? null,
        lens: parsed.lens === "clients" ? "clients" : "pipeline",
        companyHint: parsed.companyHint ?? null,
      });
    }

    const firstLine = transcript.split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? "Voice note";
    return NextResponse.json({
      title: firstLine.slice(0, 120),
      nextStep: null,
      lens: "pipeline" as const,
      companyHint: null,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

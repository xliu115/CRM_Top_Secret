import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { sequenceRepo } from "@/lib/repositories";
import {
  advanceSequence,
  recordResponse,
  pauseSequence,
  resumeSequence,
  archiveSequence,
} from "@/lib/services/cadence-engine";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePartnerId();
    const { id } = await params;

    const sequence = await sequenceRepo.findById(id);
    if (!sequence) {
      return NextResponse.json(
        { error: "Sequence not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(sequence);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePartnerId();
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const action = body.action as string | undefined;

    switch (action) {
      case "advance": {
        const result = await advanceSequence(id);
        if (!result) {
          return NextResponse.json(
            { error: "Sequence not found or not active" },
            { status: 404 }
          );
        }
        return NextResponse.json(result);
      }
      case "respond": {
        const result = await recordResponse(id);
        if (!result) {
          return NextResponse.json(
            { error: "Sequence not found or not active" },
            { status: 404 }
          );
        }
        return NextResponse.json(result);
      }
      case "pause": {
        const result = await pauseSequence(id);
        return NextResponse.json(result);
      }
      case "resume": {
        const result = await resumeSequence(id);
        if (!result) {
          return NextResponse.json(
            { error: "Sequence not found or not paused" },
            { status: 404 }
          );
        }
        return NextResponse.json(result);
      }
      case "archive": {
        const result = await archiveSequence(id);
        return NextResponse.json(result);
      }
      case "update-step": {
        const stepId = body.stepId as string | undefined;
        const emailSubject = body.emailSubject as string | undefined;
        const emailBody = body.emailBody as string | undefined;
        if (!stepId) {
          return NextResponse.json(
            { error: "stepId is required" },
            { status: 400 }
          );
        }
        const step = await sequenceRepo.updateStep(stepId, {
          ...(emailSubject !== undefined ? { emailSubject } : {}),
          ...(emailBody !== undefined ? { emailBody } : {}),
        });
        return NextResponse.json(step);
      }
      default:
        return NextResponse.json(
          {
            error:
              "Invalid action. Use: advance, respond, pause, resume, archive, update-step",
          },
          { status: 400 }
        );
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

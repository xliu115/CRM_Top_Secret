import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { sequenceRepo } from "@/lib/repositories";
import { kickoffSequence } from "@/lib/services/cadence-engine";

export async function GET(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;

    const sequences = await sequenceRepo.findByPartnerId(partnerId, {
      status,
    });
    return NextResponse.json(sequences);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[sequences GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const contactId = body.contactId as string | undefined;
    const originNudgeId = body.originNudgeId as string | undefined;
    const angleStrategy = (body.angleStrategy as string) ?? "check-in";
    const initialSubject = body.initialSubject as string | undefined;
    const initialBody = body.initialBody as string | undefined;

    if (!contactId || !originNudgeId) {
      return NextResponse.json(
        { error: "contactId and originNudgeId are required" },
        { status: 400 }
      );
    }

    const result = await kickoffSequence({
      contactId,
      partnerId,
      originNudgeId,
      angleStrategy,
      initialSubject,
      initialBody,
    });

    if (result.alreadyActive) {
      return NextResponse.json(
        {
          error: "An active sequence already exists for this contact",
          sequence: result.sequence,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[sequences POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

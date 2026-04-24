import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";

type MeetingResponse = "accepted" | "declined" | "proposed_new_time";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePartnerId();
    const { id } = await params;

    let body: { response?: MeetingResponse; newTimeIso?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const response = body.response;
    if (!response || !["accepted", "declined", "proposed_new_time"].includes(response)) {
      return NextResponse.json(
        { error: "response must be 'accepted', 'declined', or 'proposed_new_time'" },
        { status: 400 },
      );
    }

    // Stub: acknowledge without persisting a meeting RSVP yet. This endpoint will
    // be wired to calendar integration in a follow-up — for now, the UI uses the
    // 200 response to render the status banner locally.
    return NextResponse.json({
      ok: true,
      meetingId: id,
      response,
      newTimeIso: body.newTimeIso ?? null,
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

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { campaignRepo } from "@/lib/repositories";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  try {
    await requirePartnerId();
    const { recipientId } = await params;

    let body: { personalizedBody?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body.personalizedBody !== "string") {
      return NextResponse.json(
        { error: "personalizedBody is required" },
        { status: 400 }
      );
    }

    const updated = await campaignRepo.updateRecipient(recipientId, {
      personalizedBody: body.personalizedBody,
    });

    return NextResponse.json({ id: updated.id, personalizedBody: updated.personalizedBody });
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

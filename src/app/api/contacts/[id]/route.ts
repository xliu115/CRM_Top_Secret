import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { contactRepo } from "@/lib/repositories";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const contact = await contactRepo.findById(id, partnerId);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json(contact);
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
    const partnerId = await requirePartnerId();
    const { id } = await params;
    const body = await request.json();

    if (!("staleThresholdDays" in body)) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const raw = body.staleThresholdDays;
    let days: number | null = null;

    if (raw !== null) {
      days = Math.round(Number(raw));
      if (isNaN(days) || days < 1 || days > 365) {
        return NextResponse.json(
          { error: "staleThresholdDays must be between 1 and 365, or null to clear" },
          { status: 400 }
        );
      }
    }

    const contact = await contactRepo.updateStaleThreshold(id, partnerId, days);
    return NextResponse.json(contact);
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

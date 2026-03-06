import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { prisma } from "@/lib/db/prisma";

const VALID_STATUS = ["OPEN", "SNOOZED", "DONE"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const body = await request.json();
    const status = body?.status;

    if (
      !status ||
      !VALID_STATUS.includes(status as (typeof VALID_STATUS)[number])
    ) {
      return NextResponse.json(
        { error: "Invalid status. Must be OPEN, SNOOZED, or DONE" },
        { status: 400 }
      );
    }

    const updated = await prisma.nudge.updateMany({
      where: { id, contact: { partnerId } },
      data: { status },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Nudge not found" }, { status: 404 });
    }

    const nudgeWithRelations = await prisma.nudge.findUnique({
      where: { id },
      include: {
        contact: { include: { company: true } },
        signal: true,
      },
    });

    return NextResponse.json(nudgeWithRelations);
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

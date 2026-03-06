import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { meetingRepo } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get("upcoming") === "true";

    const meetings = upcoming
      ? await meetingRepo.findUpcomingByPartnerId(partnerId)
      : await meetingRepo.findByPartnerId(partnerId);

    return NextResponse.json(meetings);
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

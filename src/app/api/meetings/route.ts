import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { meetingRepo, nudgeRepo } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get("upcoming") === "true";

    const [meetings, openNudges] = await Promise.all([
      upcoming
        ? meetingRepo.findUpcomingByPartnerId(partnerId)
        : meetingRepo.findByPartnerId(partnerId),
      nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" }),
    ]);

    const nudgeContactIds = [
      ...new Set(
        openNudges
          .filter((n) => n.ruleType === "MEETING_PREP")
          .map((n) => n.contactId)
      ),
    ];

    return NextResponse.json({ meetings, nudgeContactIds });
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

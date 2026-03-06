import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  contactRepo,
  nudgeRepo,
  meetingRepo,
  interactionRepo,
} from "@/lib/repositories";

export async function GET(_request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    const [contactCount, openNudgeCount, upcomingMeetingCount, recentInteractions] =
      await Promise.all([
        contactRepo.countByPartnerId(partnerId),
        nudgeRepo.countOpenByPartnerId(partnerId),
        meetingRepo.countUpcomingByPartnerId(partnerId),
        interactionRepo.findRecentByPartnerId(partnerId, 5),
      ]);

    return NextResponse.json({
      contactCount,
      openNudgeCount,
      upcomingMeetingCount,
      recentInteractions,
    });
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

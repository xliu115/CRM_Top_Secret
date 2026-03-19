import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  contactRepo,
  nudgeRepo,
  meetingRepo,
  interactionRepo,
} from "@/lib/repositories";
import { refreshNudgesForPartner } from "@/lib/services/nudge-engine";
import { ingestNewsForPartner } from "@/lib/services/news-ingestion-service";

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

    if (openNudgeCount === 0) {
      autoRefreshNudges(partnerId).catch((err) =>
        console.error("[dashboard] Auto-refresh nudges failed:", err)
      );
    }

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

async function autoRefreshNudges(partnerId: string) {
  console.log("[dashboard] No open nudges — auto-refreshing...");
  const newsCount = await ingestNewsForPartner(partnerId);
  const nudgeCount = await refreshNudgesForPartner(partnerId);
  console.log(`[dashboard] Auto-refresh complete: ${newsCount} news, ${nudgeCount} nudges`);
}

import { NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { loadTierRecommendations } from "@/lib/services/tier-recommendations-service";

/**
 * POST /api/contacts/tier-recommendations/load
 * Computes tier suggestions for the current partner (not persisted until accepted via PATCH).
 */
export async function POST() {
  try {
    const partnerId = await requirePartnerId();
    const recommendations = await loadTierRecommendations(partnerId);
    return NextResponse.json({ recommendations });
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

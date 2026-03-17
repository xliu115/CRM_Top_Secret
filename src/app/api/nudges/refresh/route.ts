import { NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { refreshNudgesForPartner } from "@/lib/services/nudge-engine";
import { ingestNewsForPartner } from "@/lib/services/news-ingestion-service";
import { nudgeRepo, partnerRepo } from "@/lib/repositories";
import { sendNudgeDigest } from "@/lib/services/email-service";

export async function POST() {
  try {
    const partnerId = await requirePartnerId();

    // 1. Fetch real news from Tavily and store as ExternalSignal records
    const newsCount = await ingestNewsForPartner(partnerId);
    console.log(`[nudge-refresh] Ingested ${newsCount} news signals`);

    // 2. Generate nudges from all signals (including freshly fetched news)
    const count = await refreshNudgesForPartner(partnerId);

    // 3. Send digest email in the background
    const partner = await partnerRepo.findById(partnerId);
    if (partner && count > 0) {
      const nudges = await nudgeRepo.findByPartnerId(partnerId, {
        status: "OPEN",
      });
      sendNudgeDigest(partner.name, partner.email, nudges).catch((err) =>
        console.error("[nudge-refresh] Email send failed:", err)
      );
    }

    return NextResponse.json({ count, newsIngested: newsCount });
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

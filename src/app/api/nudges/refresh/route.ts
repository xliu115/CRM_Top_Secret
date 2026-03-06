import { NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { refreshNudgesForPartner } from "@/lib/services/nudge-engine";
import { nudgeRepo, partnerRepo } from "@/lib/repositories";
import { sendNudgeDigest } from "@/lib/services/email-service";

export async function POST() {
  try {
    const partnerId = await requirePartnerId();

    const count = await refreshNudgesForPartner(partnerId);

    // Send digest email in the background (don't block the response)
    const partner = await partnerRepo.findById(partnerId);
    if (partner && count > 0) {
      const nudges = await nudgeRepo.findByPartnerId(partnerId, {
        status: "OPEN",
      });
      sendNudgeDigest(partner.name, partner.email, nudges).catch((err) =>
        console.error("[nudge-refresh] Email send failed:", err)
      );
    }

    return NextResponse.json({ count });
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

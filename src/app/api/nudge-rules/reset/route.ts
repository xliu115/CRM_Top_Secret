import { NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { nudgeRuleConfigRepo } from "@/lib/repositories";

export async function POST() {
  try {
    const partnerId = await requirePartnerId();
    const config = await nudgeRuleConfigRepo.resetToDefaults(partnerId);
    return NextResponse.json(config);
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

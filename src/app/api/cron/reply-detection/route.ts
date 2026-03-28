import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/utils/cron-auth";
import { detectUnrepliedInbound } from "@/lib/services/cadence-engine";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await detectUnrepliedInbound();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/reply-detection] Fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

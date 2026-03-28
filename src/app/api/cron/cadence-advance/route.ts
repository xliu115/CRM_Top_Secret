import { NextRequest, NextResponse } from "next/server";
import { autoAdvanceDueSequences } from "@/lib/services/cadence-engine";
import { verifyCronSecret } from "@/lib/utils/cron-auth";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await autoAdvanceDueSequences();

    const advanced = results.filter((r) => r.advanced).length;
    const completed = results.filter((r) => r.completed).length;

    console.log(
      `[cron/cadence-advance] Advanced: ${advanced}, Completed: ${completed}`
    );

    return NextResponse.json({
      advanced,
      completed,
      total: results.length,
      details: results,
    });
  } catch (err) {
    console.error("[cron/cadence-advance] Fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { ingestArticles } from "@/lib/services/content-ingestion-service";
import { verifyCronSecret } from "@/lib/utils/cron-auth";

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const newArticles = await ingestArticles();
    return NextResponse.json({ success: true, newArticles });
  } catch (err) {
    console.error("[cron/content-ingestion] Fatal error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

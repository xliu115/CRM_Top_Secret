import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { nudgeRepo } from "@/lib/repositories";

const VALID_STATUS = ["OPEN", "SNOOZED", "DONE"] as const;
const VALID_PRIORITY = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export async function GET(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");

    const filters: { status?: string; priority?: string } = {};
    if (status && VALID_STATUS.includes(status as (typeof VALID_STATUS)[number])) {
      filters.status = status;
    }
    if (
      priority &&
      VALID_PRIORITY.includes(priority as (typeof VALID_PRIORITY)[number])
    ) {
      filters.priority = priority;
    }

    const nudges = await nudgeRepo.findByPartnerId(partnerId, filters);
    return NextResponse.json(nudges);
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

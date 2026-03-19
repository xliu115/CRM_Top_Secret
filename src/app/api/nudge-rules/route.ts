import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { nudgeRuleConfigRepo } from "@/lib/repositories";

export async function GET() {
  try {
    const partnerId = await requirePartnerId();
    const config = await nudgeRuleConfigRepo.upsert(partnerId, {});
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

const BOOLEAN_FIELDS = [
  "staleContactEnabled",
  "jobChangeEnabled",
  "companyNewsEnabled",
  "upcomingEventEnabled",
  "meetingPrepEnabled",
  "eventAttendedEnabled",
  "eventRegisteredEnabled",
  "articleReadEnabled",
  "linkedinActivityEnabled",
] as const;

const INT_FIELDS = [
  "staleDaysCritical",
  "staleDaysHigh",
  "staleDaysMedium",
  "staleDaysLow",
] as const;

export async function PATCH(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();
    const body = await request.json();

    const updates: Record<string, boolean | number> = {};

    for (const field of BOOLEAN_FIELDS) {
      if (field in body && typeof body[field] === "boolean") {
        updates[field] = body[field];
      }
    }

    for (const field of INT_FIELDS) {
      if (field in body && typeof body[field] === "number") {
        const val = Math.round(body[field]);
        if (val < 1 || val > 365) {
          return NextResponse.json(
            { error: `${field} must be between 1 and 365` },
            { status: 400 }
          );
        }
        updates[field] = val;
      }
    }

    const config = await nudgeRuleConfigRepo.upsert(partnerId, updates);
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

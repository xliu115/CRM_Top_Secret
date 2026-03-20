import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { contactRepo } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";

const VALID_IMPORTANCE = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const VALID_NUDGE_TYPES = [
  "STALE_CONTACT",
  "JOB_CHANGE",
  "COMPANY_NEWS",
  "UPCOMING_EVENT",
  "MEETING_PREP",
  "EVENT_ATTENDED",
  "EVENT_REGISTERED",
  "ARTICLE_READ",
  "LINKEDIN_ACTIVITY",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const contact = await contactRepo.findById(id, partnerId);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json(contact);
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;
    const body = await request.json();

    const hasThreshold = "staleThresholdDays" in body;
    const hasNudgeTypes = "disabledNudgeTypes" in body;
    const hasImportance = "importance" in body;

    if (!hasThreshold && !hasNudgeTypes && !hasImportance) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({ where: { id, partnerId } });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (hasImportance) {
      const raw = body.importance;
      if (typeof raw !== "string" || !VALID_IMPORTANCE.includes(raw as (typeof VALID_IMPORTANCE)[number])) {
        return NextResponse.json(
          { error: `importance must be one of: ${VALID_IMPORTANCE.join(", ")}` },
          { status: 400 }
        );
      }
      data.importance = raw;
    }

    if (hasThreshold) {
      const raw = body.staleThresholdDays;
      if (raw === null) {
        data.staleThresholdDays = null;
      } else {
        const days = Math.round(Number(raw));
        if (isNaN(days) || days < 1 || days > 365) {
          return NextResponse.json(
            { error: "staleThresholdDays must be between 1 and 365, or null to clear" },
            { status: 400 }
          );
        }
        data.staleThresholdDays = days;
      }
    }

    /** Persisted via raw SQL so updates work even if the generated Prisma client is out of sync with the DB. */
    let disabledNudgeTypesValue: string | null | undefined;
    if (hasNudgeTypes) {
      const types = body.disabledNudgeTypes;
      if (types === null || (Array.isArray(types) && types.length === 0)) {
        disabledNudgeTypesValue = null;
      } else if (
        Array.isArray(types) &&
        types.every((t: unknown) => typeof t === "string" && VALID_NUDGE_TYPES.includes(t as string))
      ) {
        disabledNudgeTypesValue = JSON.stringify(types);
      } else {
        return NextResponse.json(
          { error: `disabledNudgeTypes must be an array of valid types: ${VALID_NUDGE_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.contact.update({ where: { id }, data });
      }
      if (hasNudgeTypes) {
        await tx.$executeRawUnsafe(
          `UPDATE contacts SET disabled_nudge_types = ? WHERE id = ? AND partner_id = ?`,
          disabledNudgeTypesValue ?? null,
          id,
          partnerId
        );
      }
    });

    const updated = await contactRepo.findById(id, partnerId);
    if (!updated) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
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

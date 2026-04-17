import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { prisma } from "@/lib/db/prisma";
import { refreshCompanyBrief } from "@/lib/services/llm-company-brief";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const company = await prisma.company.findFirst({
      where: { id, contacts: { some: { partnerId } } },
    });
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    const brief = await refreshCompanyBrief(
      company.id,
      company.name,
      company.industry ?? "",
    );

    return NextResponse.json({ companyBrief: brief });
  } catch (err) {
    console.error("[company-brief/refresh] Error:", err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

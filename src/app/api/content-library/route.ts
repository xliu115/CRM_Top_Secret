import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { campaignRepo } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  try {
    await requirePartnerId();

    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") ?? undefined;
    const practice = searchParams.get("practice") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize")) || 20)
    );

    const { items, total } = await campaignRepo.findContentItems(
      { type, practice, search },
      page,
      pageSize
    );

    return NextResponse.json({ items, total });
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

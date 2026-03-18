import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { contactRepo } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const importance = searchParams.get("importance");

    const searchQuery = q?.trim();
    let contacts = searchQuery
      ? await contactRepo.search(searchQuery, partnerId)
      : await contactRepo.findByPartnerId(partnerId);

    if (importance) {
      contacts = contacts.filter((c) => c.importance === importance.toUpperCase());
    }

    return NextResponse.json(contacts);
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

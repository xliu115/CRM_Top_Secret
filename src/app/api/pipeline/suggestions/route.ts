import { NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { pipelineRepo } from "@/lib/repositories";

export async function GET() {
  try {
    const partnerId = await requirePartnerId();
    const suggestions = await pipelineRepo.listPendingSuggestions(partnerId);
    return NextResponse.json({ suggestions });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

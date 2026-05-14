import { NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { refreshPipelineSuggestions } from "@/lib/services/pipeline-suggestions-service";

export async function POST() {
  try {
    const partnerId = await requirePartnerId();
    await refreshPipelineSuggestions(partnerId);
    return NextResponse.json({ ok: true });
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

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { partnerRepo } from "@/lib/repositories";
import { retrieveContext } from "@/lib/services/rag-service";
import { generateChatAnswer } from "@/lib/services/llm-service";

export async function POST(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    let body: {
      message?: string;
      history?: { role: "user" | "assistant"; content: string }[];
    } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const partner = await partnerRepo.findById(partnerId);
    const partnerName = partner?.name ?? "User";

    const sources = await retrieveContext(message, partnerId);
    const answer = await generateChatAnswer({
      question: message,
      retrievedDocs: sources,
      partnerName,
      history: body.history ?? [],
    });

    return NextResponse.json({ answer, sources });
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

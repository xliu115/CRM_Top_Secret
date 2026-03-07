import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { partnerRepo } from "@/lib/repositories";
import { retrieveContext, searchWeb } from "@/lib/services/rag-service";
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

    // Run CRM search and web search in parallel; don't let one failure break the other
    const [crmSources, webSources] = await Promise.all([
      retrieveContext(message, partnerId).catch((err) => {
        console.error("[chat] CRM retrieval failed:", err);
        return [] as Awaited<ReturnType<typeof retrieveContext>>;
      }),
      searchWeb(message, 5).catch((err) => {
        console.error("[chat] Web search failed:", err);
        return [] as Awaited<ReturnType<typeof searchWeb>>;
      }),
    ]);

    const sources = [...crmSources, ...webSources];

    let answer: string;
    try {
      answer = await generateChatAnswer({
        question: message,
        retrievedDocs: sources,
        partnerName,
        history: body.history ?? [],
      });
    } catch (llmErr) {
      console.error("[chat] LLM generation failed:", llmErr);
      answer =
        "I found some relevant information but had trouble generating a response. " +
        (sources.length > 0
          ? "Please check the sources below for details."
          : "Please try again in a moment.");
    }

    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error("[chat] Error:", err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

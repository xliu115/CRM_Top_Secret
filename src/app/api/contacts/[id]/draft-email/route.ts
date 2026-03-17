import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  contactRepo,
  interactionRepo,
  signalRepo,
  partnerRepo,
} from "@/lib/repositories";
import { generateEmail } from "@/lib/services/llm-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const contact = await contactRepo.findById(id, partnerId);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    let requestBody: { nudgeReason?: string } = {};
    try {
      requestBody = await request.json();
    } catch {
      // Default to empty object if no JSON body
    }

    const nudgeReason = requestBody?.nudgeReason ?? "General check-in";

    const [partner, interactions, signals] = await Promise.all([
      partnerRepo.findById(partnerId),
      interactionRepo.findByContactId(id),
      signalRepo.findByContactId(id),
    ]);
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const recentInteractions = interactions
      .slice(0, 5)
      .map(
        (i) =>
          `${i.type} (${i.date.toISOString().split("T")[0]}): ${i.summary}`
      );
    const signalStrings = signals
      .slice(0, 5)
      .map((s) => `${s.type}: ${s.content}`);

    const { subject, body: emailBody } = await generateEmail({
      partnerName: partner.name,
      contactName: contact.name,
      contactTitle: contact.title,
      companyName: contact.company.name,
      nudgeReason,
      recentInteractions,
      signals: signalStrings,
    });

    return NextResponse.json({ subject, body: emailBody });
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

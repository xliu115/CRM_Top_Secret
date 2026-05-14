import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { contactRepo, partnerRepo } from "@/lib/repositories";
import { Resend } from "resend";
import { buildContact360EmailHtml } from "@/lib/services/email-service";
import type { Contact360Result } from "@/lib/services/llm-contact360";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS =
  process.env.RESEND_FROM || "ClientIQ <onboarding@resend.dev>";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body?.recipientEmail) {
      return NextResponse.json(
        { error: "recipientEmail is required" },
        { status: 400 }
      );
    }

    if (!body.result || !body.result.sections) {
      return NextResponse.json(
        { error: "result with sections is required" },
        { status: 400 }
      );
    }

    const contact = await contactRepo.findById(id, partnerId);
    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    const partner = await partnerRepo.findById(partnerId);
    const senderName = partner?.name ?? "A colleague";

    const result: Contact360Result = body.result;
    const html = buildContact360EmailHtml(
      result,
      contact.name,
      contact.company?.name ?? "",
      senderName
    );

    if (!resend) {
      console.log("[contact360/share] RESEND_API_KEY not set — skipping send");
      return NextResponse.json({
        sent: false,
        error: "Email service not configured",
      });
    }

    const recipientEmail: string = body.recipientEmail;
    const recipientName: string = body.recipientName ?? "";

    await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipientEmail,
      subject: `Contact 360: ${contact.name} at ${contact.company?.name ?? ""}`,
      html,
    });

    console.log(
      `[contact360/share] Sent dossier for ${contact.name} to ${recipientName || recipientEmail}`
    );

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[contact360/share] Error:", err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

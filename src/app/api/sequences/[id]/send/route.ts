import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { sequenceRepo, partnerRepo, contactRepo } from "@/lib/repositories";
import { sendOutreachEmail } from "@/lib/services/email-service";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const sequence = await sequenceRepo.findById(id);
    if (!sequence) {
      return NextResponse.json(
        { error: "Sequence not found" },
        { status: 404 }
      );
    }

    if (sequence.partnerId !== partnerId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const currentStep = sequence.steps.find(
      (s) => s.stepNumber === sequence.currentStep
    );
    if (!currentStep) {
      return NextResponse.json(
        { error: "No current step found" },
        { status: 400 }
      );
    }

    if (!currentStep.emailSubject || !currentStep.emailBody) {
      return NextResponse.json(
        { error: "Email draft not ready for this step" },
        { status: 400 }
      );
    }

    const [partner, contact] = await Promise.all([
      partnerRepo.findById(partnerId),
      contactRepo.findById(sequence.contactId, partnerId),
    ]);

    if (!partner || !contact) {
      return NextResponse.json(
        { error: "Partner or contact not found" },
        { status: 404 }
      );
    }

    const result = await sendOutreachEmail({
      fromName: partner.name,
      toEmail: contact.email,
      toName: contact.name,
      subject: currentStep.emailSubject,
      body: currentStep.emailBody,
    });

    if (!result.sent) {
      return NextResponse.json(
        { error: result.error ?? "Failed to send email" },
        { status: 500 }
      );
    }

    await sequenceRepo.updateStep(currentStep.id, {
      status: "SENT",
      executedAt: new Date(),
    });

    await prisma.interaction.create({
      data: {
        contactId: sequence.contactId,
        type: "EMAIL",
        date: new Date(),
        summary: `Outreach: ${currentStep.emailSubject}`,
        sentiment: "NEUTRAL",
        direction: "OUTBOUND",
        cadenceStepId: currentStep.id,
      },
    });

    await prisma.contact.update({
      where: { id: sequence.contactId },
      data: { lastContacted: new Date() },
    });

    return NextResponse.json({
      sent: true,
      stepId: currentStep.id,
      messageId: result.messageId,
    });
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

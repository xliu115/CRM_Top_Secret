import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { contactRepo, partnerRepo, nudgeRepo } from "@/lib/repositories";
import { sendOutreachEmail } from "@/lib/services/email-service";
import { classifySequenceWorthy } from "@/lib/services/llm-service";
import { kickoffSequence } from "@/lib/services/cadence-engine";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    let body: {
      contactId: string;
      nudgeId?: string;
      subject: string;
      body: string;
      nudgeReason?: string;
      ruleType?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { contactId, nudgeId, subject, body: emailBody, nudgeReason, ruleType } = body;

    if (!contactId || !subject || !emailBody) {
      return NextResponse.json(
        { error: "contactId, subject, and body are required" },
        { status: 400 }
      );
    }

    const [partner, contact] = await Promise.all([
      partnerRepo.findById(partnerId),
      contactRepo.findById(contactId, partnerId),
    ]);

    if (!partner || !contact) {
      return NextResponse.json(
        { error: "Partner or contact not found" },
        { status: 404 }
      );
    }

    // Demo mode: skip actual Resend send to avoid sandbox domain restrictions.
    // In production, uncomment the sendOutreachEmail call below.
    // const result = await sendOutreachEmail({
    //   fromName: partner.name,
    //   toEmail: contact.email,
    //   toName: contact.name,
    //   subject,
    //   body: emailBody,
    // });
    // if (!result.sent) {
    //   return NextResponse.json(
    //     { error: result.error ?? "Failed to send email" },
    //     { status: 500 }
    //   );
    // }
    const result = { sent: true, messageId: `demo-${Date.now()}` };

    // Log interaction + update lastContacted
    await Promise.all([
      prisma.interaction.create({
        data: {
          contactId,
          type: "EMAIL",
          date: new Date(),
          summary: `Outreach: ${subject}`,
          sentiment: "NEUTRAL",
          direction: "OUTBOUND",
        },
      }),
      prisma.contact.update({
        where: { id: contactId },
        data: { lastContacted: new Date() },
      }),
    ]);

    // Classify whether this email warrants a follow-up sequence
    const lastContacted = contact.lastContacted
      ? Math.floor((Date.now() - new Date(contact.lastContacted).getTime()) / 86_400_000)
      : undefined;

    const classification = await classifySequenceWorthy({
      ruleType: ruleType ?? "STALE_CONTACT",
      nudgeReason: nudgeReason ?? "",
      emailSubject: subject,
      emailBody,
      contactImportance: contact.importance,
      daysSinceLastContact: lastContacted,
    });

    let sequenceStarted = false;
    let sequenceId: string | undefined;

    if (classification.shouldSequence) {
      const seqResult = await kickoffSequence({
        contactId,
        partnerId,
        originNudgeId: nudgeId ?? `auto-${Date.now()}`,
        angleStrategy: inferAngleStrategy(ruleType),
        initialSubject: subject,
        initialBody: emailBody,
        alreadySent: true,
      });

      if (!seqResult.alreadyActive) {
        sequenceStarted = true;
        sequenceId = seqResult.sequence.id;
      }
    }

    // Mark the nudge as DONE if provided
    if (nudgeId) {
      try {
        await nudgeRepo.updateStatus(nudgeId, "DONE");
      } catch {
        // Non-critical — nudge may already be done
      }
    }

    return NextResponse.json({
      sent: true,
      sequenceStarted,
      sequenceId,
      classificationReason: classification.reason,
      messageId: result.messageId,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[outreach/send] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

function inferAngleStrategy(ruleType?: string): string {
  switch (ruleType) {
    case "COMPANY_NEWS":
      return "news-reference";
    case "EVENT_ATTENDED":
    case "EVENT_REGISTERED":
    case "UPCOMING_EVENT":
      return "event-followup";
    case "ARTICLE_READ":
    case "LINKEDIN_ACTIVITY":
      return "value-add";
    default:
      return "check-in";
  }
}

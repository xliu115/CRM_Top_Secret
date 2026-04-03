import { NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { campaignRepo, partnerRepo } from "@/lib/repositories";
import { buildCampaignEmailHtml, sendCampaignEmail } from "@/lib/services/email-service";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const campaign = await campaignRepo.findById(id, partnerId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status === "SENT") {
      return NextResponse.json({
        ok: true,
        message: "Campaign already sent",
        skipped: true,
      });
    }

    const isCentral = campaign.source === "CENTRAL";

    const partner = await partnerRepo.findById(partnerId);
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const template = campaign.bodyTemplate ?? "";
    const subject = campaign.subject ?? "Campaign";

    const contentItems = campaign.contents.map((cc) => ({
      contentItemId: cc.contentItem.id,
      title: cc.contentItem.title,
      description: cc.contentItem.description ?? undefined,
      url: cc.contentItem.url ?? undefined,
      type: cc.contentItem.type,
      eventDate: cc.contentItem.eventDate ?? undefined,
      eventLocation: cc.contentItem.eventLocation ?? undefined,
    }));

    let toSend = campaign.recipients.filter(
      (r) => r.status === "PENDING" || r.status === "FAILED"
    );

    if (isCentral) {
      toSend = toSend.filter((r) => r.approvalStatus === "APPROVED");
    }

    if (toSend.length === 0) {
      const allRecipientsSent =
        campaign.recipients.length > 0 &&
        campaign.recipients.every((r) => r.status === "SENT" || (isCentral && r.approvalStatus === "REJECTED"));
      await campaignRepo.update(id, partnerId, {
        sendStartedAt: new Date(),
        status: allRecipientsSent ? "SENT" : "FAILED",
        sentAt: allRecipientsSent ? new Date() : undefined,
        lastError: campaign.recipients.length === 0 ? "No recipients" : null,
      });
      return NextResponse.json({
        ok: true,
        sentCount: 0,
        failedCount: 0,
        totalAttempted: 0,
        message:
          campaign.recipients.length === 0
            ? "No recipients to send"
            : "No pending recipients",
      });
    }

    const now = new Date();
    await campaignRepo.update(id, partnerId, {
      sendStartedAt: now,
      status: "IN_PROGRESS",
    });

    const senderDefault = { name: partner.name, email: partner.email };
    const partnerCache = new Map<string, { name: string; email: string }>();
    partnerCache.set(partnerId, senderDefault);

    async function getSenderForRecipient(r: typeof toSend[0]) {
      if (!isCentral || !r.assignedPartnerId) {
        return senderDefault;
      }
      const cached = partnerCache.get(r.assignedPartnerId);
      if (cached) return cached;
      const assigned = await prisma.partner.findUnique({
        where: { id: r.assignedPartnerId },
        select: { name: true, email: true },
      });
      const sender = assigned ?? senderDefault;
      partnerCache.set(r.assignedPartnerId, sender);
      return sender;
    }

    const results = await Promise.allSettled(
      toSend.map(async (r) => {
        const contact = r.contact;
        const email = contact?.email ?? r.unmatchedEmail;
        if (!email) {
          await campaignRepo.updateRecipient(r.id, {
            status: "FAILED",
            failureReason: "No email address for recipient",
          });
          return { recipientId: r.id, sent: false };
        }

        const sender = await getSenderForRecipient(r);

        const opening = r.personalizedBody ?? "";
        const html = buildCampaignEmailHtml({
          personalizedOpening: opening,
          bodyTemplate: template,
          signatureBlock: campaign.signatureBlock ?? undefined,
          contentItems,
          recipientId: r.id,
          rsvpToken: r.rsvpToken ?? undefined,
          appUrl,
        });

        const toName = contact?.name ?? email;
        const sendResult = await sendCampaignEmail({
          fromName: sender.name,
          fromEmail: sender.email,
          toEmail: email,
          toName,
          subject,
          html,
        });

        if (sendResult.sent) {
          await campaignRepo.updateRecipient(r.id, {
            status: "SENT",
            sentAt: new Date(),
            failureReason: null,
          });
        } else {
          await campaignRepo.updateRecipient(r.id, {
            status: "FAILED",
            failureReason: sendResult.error ?? "Send failed",
          });
        }

        return { recipientId: r.id, sent: sendResult.sent };
      })
    );

    const sentCount = results.filter(
      (x) => x.status === "fulfilled" && x.value.sent
    ).length;
    const failedCount = toSend.length - sentCount;

    const finalStatus =
      sentCount === 0 && toSend.length > 0 ? "FAILED" : "SENT";

    await campaignRepo.update(id, partnerId, {
      status: finalStatus,
      sentAt: finalStatus === "SENT" ? new Date() : campaign.sentAt ?? undefined,
      lastError:
        failedCount > 0 && sentCount === 0
          ? "All recipient sends failed"
          : failedCount > 0
            ? `${failedCount} recipient(s) failed`
            : null,
    });

    return NextResponse.json({
      ok: true,
      sentCount,
      failedCount,
      totalAttempted: toSend.length,
      status: finalStatus,
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

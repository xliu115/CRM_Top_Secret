import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { campaignRepo } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { checkCampaignApprovalComplete } from "@/lib/services/campaign-approval";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { recipientId } = await params;

    let body: {
      personalizedBody?: string;
      approvalStatus?: string;
      reassignToPartnerId?: string;
    } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const recipient = await prisma.campaignRecipient.findUnique({
      where: { id: recipientId },
      include: { campaign: true },
    });

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    if (recipient.assignedPartnerId && recipient.assignedPartnerId !== partnerId) {
      return NextResponse.json({ error: "Not authorized for this recipient" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (typeof body.personalizedBody === "string") {
      updateData.personalizedBody = body.personalizedBody;
    }

    if (body.approvalStatus === "APPROVED" || body.approvalStatus === "REJECTED") {
      updateData.approvalStatus = body.approvalStatus;
    }

    if (typeof body.reassignToPartnerId === "string") {
      updateData.assignedPartnerId = body.reassignToPartnerId;
      updateData.approvalStatus = "PENDING";
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid update fields provided" },
        { status: 400 }
      );
    }

    const updated = await prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: updateData,
    });

    if (updateData.approvalStatus && recipient.campaign.source === "CENTRAL") {
      await checkCampaignApprovalComplete(recipient.campaignId);
    }

    return NextResponse.json({
      id: updated.id,
      personalizedBody: updated.personalizedBody,
      approvalStatus: updated.approvalStatus,
      assignedPartnerId: updated.assignedPartnerId,
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

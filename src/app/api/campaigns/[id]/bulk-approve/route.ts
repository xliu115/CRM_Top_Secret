import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { prisma } from "@/lib/db/prisma";
import { checkCampaignApprovalComplete } from "@/lib/services/campaign-approval";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id: campaignId } = await params;

    let body: { recipientIds?: string[]; action?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { recipientIds, action } = body;
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return NextResponse.json(
        { error: "recipientIds must be a non-empty array" },
        { status: 400 }
      );
    }
    if (action !== "APPROVED" && action !== "REJECTED") {
      return NextResponse.json(
        { error: 'action must be "APPROVED" or "REJECTED"' },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign || campaign.source !== "CENTRAL") {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const { count } = await prisma.campaignRecipient.updateMany({
      where: {
        id: { in: recipientIds },
        campaignId,
        assignedPartnerId: partnerId,
        approvalStatus: "PENDING",
      },
      data: { approvalStatus: action },
    });

    await checkCampaignApprovalComplete(campaignId);

    return NextResponse.json({ ok: true, updated: count });
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

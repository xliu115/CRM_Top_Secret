import { prisma } from "@/lib/db/prisma";

/**
 * After a recipient approval action, check whether all recipients for the
 * campaign have been resolved (no PENDING left). If so, transition the
 * campaign from PENDING_APPROVAL -> IN_PROGRESS.
 */
export async function checkCampaignApprovalComplete(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign || campaign.status !== "PENDING_APPROVAL") return;

  const pendingCount = await prisma.campaignRecipient.count({
    where: {
      campaignId,
      approvalStatus: "PENDING",
    },
  });

  if (pendingCount === 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "IN_PROGRESS", sendStartedAt: new Date() },
    });
  }
}

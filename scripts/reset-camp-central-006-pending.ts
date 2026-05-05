/**
 * Flip Morgan's 3 recipients on `camp-central-006` (Sustainability & ESG
 * Insights) back to PENDING so the chat "Review my campaign approvals"
 * intent surfaces them instead of falling through to "all caught up".
 *
 * Background: the open CAMPAIGN_APPROVAL nudge for Morgan says "Campaign
 * has 3 contacts pending your review", but the seed pre-marked her
 * recipients as APPROVED ("all APPROVED, already moved to IN_PROGRESS").
 * The nudge text and DB state were out of sync, which made the brief lead
 * with a campaign that vanished on tap. Re-opening the approvals re-aligns
 * the demo flow: brief → tap → see the 3 rows defaulted to APPROVED →
 * confirm.
 */
import { prisma } from "@/lib/db/prisma";

const CAMPAIGN_ID = "camp-central-006";
const PARTNER_ID = "p-morgan-chen";

async function main() {
  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId: CAMPAIGN_ID, assignedPartnerId: PARTNER_ID },
    include: { contact: { select: { name: true } } },
  });
  console.log(
    `Found ${recipients.length} recipient(s) for ${PARTNER_ID} on ${CAMPAIGN_ID}:`,
  );
  for (const r of recipients) {
    console.log(
      `  - ${r.contact?.name ?? "(?)"} approvalStatus=${r.approvalStatus} status=${r.status}`,
    );
  }

  const result = await prisma.campaignRecipient.updateMany({
    where: {
      campaignId: CAMPAIGN_ID,
      assignedPartnerId: PARTNER_ID,
    },
    data: {
      approvalStatus: "PENDING",
      status: "PENDING",
    },
  });
  console.log(`\nFlipped ${result.count} recipient(s) → PENDING.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

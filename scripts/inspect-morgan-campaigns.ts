import { prisma } from "@/lib/db/prisma";

async function main() {
  const PARTNER = "p-morgan-chen";

  const nudges = await prisma.nudge.findMany({
    where: {
      contact: { partnerId: PARTNER },
      status: "OPEN",
      ruleType: "CAMPAIGN_APPROVAL",
    },
    include: { contact: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  console.log(`OPEN CAMPAIGN_APPROVAL nudges for ${PARTNER}: ${nudges.length}`);
  for (const n of nudges) {
    let campaignId: string | undefined;
    try {
      const meta = JSON.parse(n.metadata ?? "{}");
      campaignId = meta?.campaignId;
    } catch {}
    console.log(`  ${n.id}  contact=${n.contact.name}  campaignId=${campaignId ?? "(none)"}`);
    console.log(`    reason: ${n.reason}`);
  }

  console.log();
  const campaigns = await prisma.campaign.findMany({
    where: { partnerId: PARTNER },
    include: {
      recipients: {
        select: {
          id: true,
          approvalStatus: true,
          status: true,
          assignedPartnerId: true,
          contact: { select: { name: true } },
        },
      },
    },
  });
  console.log(`Total campaigns for ${PARTNER}: ${campaigns.length}`);
  for (const c of campaigns) {
    const pending = c.recipients.filter(
      (r) => r.approvalStatus === "PENDING" && r.assignedPartnerId === PARTNER,
    );
    console.log(`\n  Campaign: ${c.name} (${c.id})`);
    console.log(`    status: ${c.status}`);
    console.log(`    total recipients: ${c.recipients.length}`);
    console.log(`    PENDING for ${PARTNER}: ${pending.length}`);
    const counts: Record<string, number> = {};
    for (const r of c.recipients) {
      const k = `${r.approvalStatus ?? "(null)"}|assignedTo=${r.assignedPartnerId ?? "(null)"}|status=${r.status}`;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const [k, v] of Object.entries(counts)) {
      console.log(`      ${v}× ${k}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

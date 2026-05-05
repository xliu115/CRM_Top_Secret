import { prisma } from "@/lib/db/prisma";

async function main() {
  const nudges = await prisma.nudge.findMany({
    where: { contact: { partnerId: "p-morgan-chen" }, status: "OPEN" },
    include: { contact: { select: { name: true } } },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });
  console.log(`Total OPEN nudges: ${nudges.length}\n`);

  let hasInsight = 0;
  let hasEmail = 0;
  const ruleTypeCounts: Record<string, number> = {};

  for (const n of nudges) {
    ruleTypeCounts[n.ruleType] = (ruleTypeCounts[n.ruleType] || 0) + 1;
    let meta: { strategicInsight?: { narrative?: string } } = {};
    try {
      meta = JSON.parse(n.metadata ?? "{}");
    } catch {}
    if (meta.strategicInsight?.narrative) hasInsight++;
    if (n.generatedEmail) hasEmail++;
  }
  console.log("Rule-type breakdown:", ruleTypeCounts);
  console.log(
    `\nWith strategic insight (narrative): ${hasInsight} / ${nudges.length}`,
  );
  console.log(
    `With cached email draft:             ${hasEmail} / ${nudges.length}`,
  );

  console.log("\nContact nudges (non-campaign):");
  const contactNudges = nudges.filter(
    (n) =>
      n.ruleType !== "CAMPAIGN_APPROVAL" && n.ruleType !== "ARTICLE_CAMPAIGN",
  );
  for (const n of contactNudges.slice(0, 12)) {
    let meta: { strategicInsight?: unknown } = {};
    try {
      meta = JSON.parse(n.metadata ?? "{}");
    } catch {}
    const has = meta.strategicInsight ? "YES" : "no ";
    const em = n.generatedEmail ? "YES" : "no ";
    console.log(
      `  insight=${has} email=${em} | ${n.priority.padEnd(7)} | ${n.ruleType.padEnd(18)} | ${n.contact.name}`,
    );
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

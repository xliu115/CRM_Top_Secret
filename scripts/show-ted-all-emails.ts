import { prisma } from "@/lib/db/prisma";

async function main() {
  const c = await prisma.contact.findFirst({
    where: { name: "Ted Sarandos", partnerId: "p-morgan-chen" },
    select: { id: true },
  });
  if (!c) return;

  const all = await prisma.nudge.findMany({
    where: {
      contactId: c.id,
      generatedEmail: { not: null },
      ruleType: { notIn: ["CAMPAIGN_APPROVAL", "ARTICLE_CAMPAIGN"] },
    },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      ruleType: true,
      priority: true,
      createdAt: true,
      generatedEmail: true,
    },
  });

  console.log(`Found ${all.length} nudge(s) with generatedEmail (in fast-path query order):\n`);
  for (const n of all) {
    console.log(`  [${n.status}] ${n.ruleType} ${n.priority} ${n.id} (created ${n.createdAt.toISOString().slice(0, 10)})`);
    try {
      const e = JSON.parse(n.generatedEmail!);
      console.log(`     subject: "${e.subject}"`);
      console.log(`     body: "${(e.body || "").slice(0, 110).replace(/\n/g, " ⏎ ")}"`);
    } catch {
      console.log(`     (unparseable)`);
    }
    console.log();
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

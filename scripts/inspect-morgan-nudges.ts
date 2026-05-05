import { prisma } from "@/lib/db/prisma";

async function main() {
  const nudges = await prisma.nudge.findMany({
    where: {
      contact: { partnerId: "p-morgan-chen" },
      status: "OPEN",
    },
    include: {
      contact: { select: { id: true, name: true, company: { select: { name: true } } } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  console.log(`Open nudges for Morgan: ${nudges.length}`);
  for (const n of nudges) {
    let oneLiner = "";
    if (n.metadata) {
      try {
        const md = JSON.parse(n.metadata);
        oneLiner = md.strategicInsight?.oneLiner ?? "";
      } catch {}
    }
    console.log(
      `  [${n.priority.padEnd(7)}] ${n.ruleType.padEnd(18)} ${n.contact.name.padEnd(22)} @ ${(n.contact.company?.name ?? "").padEnd(14)}`,
    );
    if (oneLiner) console.log(`           ↳ "${oneLiner}"`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

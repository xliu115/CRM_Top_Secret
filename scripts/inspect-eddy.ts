import { prisma } from "@/lib/db/prisma";

async function main() {
  const contacts = await prisma.contact.findMany({
    where: { name: { contains: "Eddy" }, partnerId: "p-morgan-chen" },
    include: {
      company: { select: { name: true } },
      nudges: {
        where: { status: "OPEN" },
        select: {
          id: true,
          ruleType: true,
          priority: true,
          generatedEmail: true,
        },
      },
    },
  });
  console.log(`Found ${contacts.length} Eddy contact(s)`);
  for (const c of contacts) {
    console.log(`\n  ${c.name} (${c.id}) @ ${c.company?.name ?? "?"}`);
    console.log(`    OPEN nudges: ${c.nudges.length}`);
    for (const n of c.nudges) {
      const hasEmail = n.generatedEmail ? "YES" : "NO";
      console.log(
        `      - ${n.ruleType.padEnd(18)} priority=${n.priority.padEnd(6)} email=${hasEmail} id=${n.id}`,
      );
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

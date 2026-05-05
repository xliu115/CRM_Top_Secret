import { prisma } from "@/lib/db/prisma";

async function main() {
  const contacts = await prisma.contact.findMany({
    where: { name: "Ted Sarandos", partnerId: "p-morgan-chen" },
    include: {
      company: { select: { id: true, name: true } },
      nudges: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          ruleType: true,
          status: true,
          priority: true,
          reason: true,
          createdAt: true,
          generatedEmail: true,
          metadata: true,
          signalId: true,
          signal: { select: { id: true, type: true, content: true, url: true } },
        },
      },
      signals: {
        orderBy: { date: "desc" },
        select: { id: true, type: true, content: true, url: true, date: true },
        take: 25,
      },
    },
  });
  console.log(`Found ${contacts.length} Ted Sarandos contact(s)`);
  for (const c of contacts) {
    console.log(`\n=== ${c.name} (${c.id}) @ ${c.company?.name ?? "?"} ===`);
    console.log(`\n  ALL nudges (${c.nudges.length}):`);
    for (const n of c.nudges) {
      console.log(
        `    [${n.status}] ${n.ruleType.padEnd(18)} ${n.priority.padEnd(7)} ${n.createdAt.toISOString().slice(0, 10)}`,
      );
      console.log(`      reason: ${n.reason.slice(0, 120)}`);
      if (n.signal) {
        console.log(
          `      signal: ${n.signal.type} — ${n.signal.content.slice(0, 100)}`,
        );
      }
    }
    console.log(`\n  Recent signals (${c.signals.length}):`);
    for (const s of c.signals) {
      console.log(
        `    [${s.date.toISOString().slice(0, 10)}] ${s.type.padEnd(18)} ${s.content.slice(0, 100)}`,
      );
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

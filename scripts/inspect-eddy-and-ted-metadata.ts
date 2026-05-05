import { prisma } from "@/lib/db/prisma";

async function main() {
  for (const name of ["Eddy Cue", "Ted Sarandos"]) {
    const c = await prisma.contact.findFirst({
      where: { name, partnerId: "p-morgan-chen" },
      include: {
        nudges: {
          where: { status: "OPEN" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    console.log(`\n========== ${name} (${c?.id}) ==========`);
    if (!c?.nudges[0]) {
      console.log("  no open nudge");
      continue;
    }
    const n = c.nudges[0];
    console.log(`id: ${n.id}`);
    console.log(`ruleType: ${n.ruleType}, priority: ${n.priority}`);
    console.log(`reason: ${n.reason}`);
    console.log(`generatedEmail: ${n.generatedEmail ? "PRESENT" : "missing"}`);
    if (n.metadata) {
      try {
        const md = JSON.parse(n.metadata);
        console.log("metadata.strategicInsight:", JSON.stringify(md.strategicInsight, null, 2));
        console.log("metadata.insights count:", md.insights?.length ?? 0);
        if (md.insights) {
          for (const i of md.insights.slice(0, 4)) {
            console.log(`  - [${i.type}] ${i.reason?.slice(0, 100)}`);
          }
        }
      } catch (e) {
        console.log("metadata parse error", e);
      }
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

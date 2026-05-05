import { prisma } from "@/lib/db/prisma";

async function main() {
  const result = await prisma.nudge.updateMany({
    where: {
      contact: { name: "Eddy Cue", partnerId: "p-morgan-chen" },
      status: { not: "OPEN" },
    },
    data: { status: "OPEN" },
  });
  console.log(`Reopened ${result.count} nudge(s) for Eddy Cue.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

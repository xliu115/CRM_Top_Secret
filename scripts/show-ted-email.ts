import { prisma } from "@/lib/db/prisma";

async function main() {
  const c = await prisma.contact.findFirst({
    where: { name: "Ted Sarandos", partnerId: "p-morgan-chen" },
    include: { nudges: { where: { status: "OPEN" }, take: 1 } },
  });
  const n = c?.nudges[0];
  if (!n) {
    console.log("no open nudge");
    return;
  }
  console.log("nudge id:", n.id);
  if (n.generatedEmail) {
    try {
      const e = JSON.parse(n.generatedEmail);
      console.log("\nSUBJECT:", e.subject);
      console.log("\nBODY:\n", e.body);
    } catch {
      console.log("raw:", n.generatedEmail);
    }
  } else {
    console.log("(no generated email)");
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Dismiss every OPEN nudge for Eddy Cue (ct-021) so he stops appearing in
 * Morgan's morning brief. The user prefers Ted Sarandos's Netflix-acquisition
 * nudge as the lead and finds Eddy's nudges noisy. Reversible: re-open with a
 * Prisma update if you want him back.
 */
import { prisma } from "@/lib/db/prisma";

const CONTACT_NAME = "Eddy Cue";
const PARTNER_ID = "p-morgan-chen";

async function main() {
  const contact = await prisma.contact.findFirst({
    where: { name: CONTACT_NAME, partnerId: PARTNER_ID },
    select: { id: true, name: true },
  });
  if (!contact) {
    console.error(`Contact "${CONTACT_NAME}" not found for ${PARTNER_ID}`);
    process.exit(1);
  }

  const open = await prisma.nudge.findMany({
    where: { contactId: contact.id, status: "OPEN" },
    select: { id: true, ruleType: true, priority: true, reason: true },
  });
  console.log(
    `Dismissing ${open.length} OPEN nudge(s) for ${contact.name} (${contact.id})`,
  );
  for (const n of open) {
    console.log(
      `  - [${n.priority}] ${n.ruleType.padEnd(14)} ${n.reason.slice(0, 80)}`,
    );
  }

  if (open.length > 0) {
    const result = await prisma.nudge.updateMany({
      where: { contactId: contact.id, status: "OPEN" },
      data: { status: "DONE" },
    });
    console.log(`\nMarked ${result.count} nudge(s) as DONE.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

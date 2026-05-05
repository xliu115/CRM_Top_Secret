/**
 * Null out generatedEmail on every DONE/SNOOZED nudge across the partner.
 *
 * Why: the chat fast-path uses any-status-with-email as a fallback, which
 * means stale drafts on closed nudges from old test sessions can leak into
 * the live UI if the OPEN-first ordering ever fails (it just did — see
 * scripts/show-ted-all-emails.ts). Clearing them removes the failure mode
 * entirely. The OPEN nudge for each contact still has its draft.
 *
 * Reversible if needed; nothing else reads generatedEmail off closed nudges.
 */
import { prisma } from "@/lib/db/prisma";

const PARTNER_ID = "p-morgan-chen";

async function main() {
  const stale = await prisma.nudge.findMany({
    where: {
      contact: { partnerId: PARTNER_ID },
      status: { in: ["DONE", "SNOOZED"] },
      generatedEmail: { not: null },
    },
    include: { contact: { select: { name: true } } },
  });
  console.log(
    `Clearing generatedEmail on ${stale.length} closed nudge(s) for ${PARTNER_ID}:`,
  );
  for (const n of stale) {
    console.log(`  - [${n.status}] ${n.contact.name} (${n.id})`);
  }

  if (stale.length > 0) {
    const result = await prisma.nudge.updateMany({
      where: {
        contact: { partnerId: PARTNER_ID },
        status: { in: ["DONE", "SNOOZED"] },
        generatedEmail: { not: null },
      },
      data: { generatedEmail: null },
    });
    console.log(`\nCleared ${result.count} stale draft(s).`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

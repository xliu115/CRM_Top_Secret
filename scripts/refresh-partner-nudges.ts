/**
 * Regenerate open nudges for a specific partner without going through the API
 * (no Next.js dev server required). Useful when seed data changes and you want
 * to immediately reflect new signals/articles on the dashboard.
 *
 * Usage:
 *   npx tsx scripts/refresh-partner-nudges.ts [partner-email-or-id]
 *
 * Defaults to Morgan Chen.
 */

import "dotenv/config";
import { refreshNudgesForPartner, enrichNudgesWithInsights } from "../src/lib/services/nudge-engine";
import { prisma } from "../src/lib/db/prisma";

async function main() {
  const arg = process.argv[2] ?? "morgan.chen@firm.com";

  const partner = await prisma.partner.findFirst({
    where: {
      OR: [{ id: arg }, { email: arg }],
    },
  });

  if (!partner) {
    console.error(`Partner not found for "${arg}"`);
    process.exit(1);
  }

  console.log(`Refreshing nudges for ${partner.name} (${partner.id})…`);
  const count = await refreshNudgesForPartner(partner.id);
  console.log(`  → ${count} open nudges generated`);

  console.log(`Enriching with strategic insights…`);
  await enrichNudgesWithInsights(partner.id);

  const byType = await prisma.nudge.groupBy({
    by: ["ruleType"],
    where: { contact: { partnerId: partner.id }, status: "OPEN" },
    _count: { _all: true },
  });
  console.log("Breakdown:");
  for (const row of byType) {
    console.log(`  ${row.ruleType.padEnd(22)} ${row._count._all}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

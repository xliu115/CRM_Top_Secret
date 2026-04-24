/**
 * Purge fabricated contact-level signals and invalidate stale strategic
 * insight narratives that were generated from them.
 *
 * Context: the original seed (`prisma/seed-data/signals.ts`) populated
 * random `JOB_CHANGE`, `EVENT`, and `LINKEDIN_ACTIVITY` signals per
 * contact. This produced factually wrong content like claiming Jensen
 * Huang had transitioned from CEO to "VP of AI & Data". The signal
 * generator has been reduced to curated, URL-backed company news, but
 * the existing SQLite DB still contains the fabricated rows and the
 * derived insight narratives cached on nudges.
 *
 * This script:
 *   1. Clears `metadata.strategicInsight` on every nudge so it will be
 *      regenerated from current signals the next time it's viewed.
 *   2. Detaches and deletes `ExternalSignal` rows whose `type` is not
 *      `NEWS` (i.e. fabricated EVENT / JOB_CHANGE / LINKEDIN_ACTIVITY).
 *   3. Deletes nudges that were derived from those fabricated signals
 *      (rule types that only make sense with per-contact signals).
 *
 * Run with: `npx tsx scripts/purge-fabricated-signals.ts`
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const FABRICATED_SIGNAL_TYPES = ["JOB_CHANGE", "EVENT", "LINKEDIN_ACTIVITY"];

// Rule types whose reasons embed the now-purged signal content verbatim.
const DERIVED_NUDGE_RULE_TYPES = [
  "JOB_CHANGE",
  "LINKEDIN_ACTIVITY",
  "EVENT_ATTENDED",
  "EVENT_REGISTERED",
  "UPCOMING_EVENT",
];

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  const prisma = new PrismaClient({ adapter });

  console.log("🧹 Purging fabricated signals and cached narratives...\n");

  // 1. Strip cached `strategicInsight` from every nudge. The narrative
  //    may reference claims that no longer have supporting signals; let
  //    the LLM regenerate from the curated data on next view.
  const allNudges = await prisma.nudge.findMany({
    where: { metadata: { not: null } },
    select: { id: true, metadata: true },
  });
  let narrativesCleared = 0;
  for (const n of allNudges) {
    if (!n.metadata) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(n.metadata) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!("strategicInsight" in parsed)) continue;
    delete parsed.strategicInsight;
    await prisma.nudge.update({
      where: { id: n.id },
      data: { metadata: JSON.stringify(parsed) },
    });
    narrativesCleared++;
  }
  console.log(`Cleared cached strategicInsight on ${narrativesCleared} nudge(s).`);

  // 2. Detach nudges from fabricated signals and delete derived nudges.
  const fabricatedSignals = await prisma.externalSignal.findMany({
    where: { type: { in: FABRICATED_SIGNAL_TYPES } },
    select: { id: true },
  });
  const fabricatedIds = fabricatedSignals.map((s) => s.id);
  console.log(`Found ${fabricatedIds.length} fabricated signal(s).`);

  if (fabricatedIds.length > 0) {
    const derivedDeleted = await prisma.nudge.deleteMany({
      where: {
        OR: [
          { signalId: { in: fabricatedIds } },
          { ruleType: { in: DERIVED_NUDGE_RULE_TYPES } },
        ],
      },
    });
    console.log(`Deleted ${derivedDeleted.count} nudge(s) derived from fabricated signals.`);

    // Null out any other nudge→signal references just in case.
    await prisma.nudge.updateMany({
      where: { signalId: { in: fabricatedIds } },
      data: { signalId: null },
    });

    const sigDeleted = await prisma.externalSignal.deleteMany({
      where: { id: { in: fabricatedIds } },
    });
    console.log(`Deleted ${sigDeleted.count} fabricated ExternalSignal(s).`);
  }

  const remainingSignals = await prisma.externalSignal.count();
  const remainingNudges = await prisma.nudge.count();
  console.log(`\n✓ Done. ${remainingSignals} signal(s) and ${remainingNudges} nudge(s) remain.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

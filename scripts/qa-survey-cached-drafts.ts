import { prisma } from "@/lib/db/prisma";

/**
 * Survey cached email drafts on nudges to find ones that look like they
 * came from the buggy `generateEmailTemplate` fallback (when an LLM call
 * failed). Telltale signs:
 *   - "Looking forward to reconnecting." closing (verbatim from the template)
 *   - "Last time we spoke, note on …" (raw lowercased note text)
 *
 * Usage: npx tsx scripts/qa-survey-cached-drafts.ts [--clear]
 */

async function main() {
  const clear = process.argv.includes("--clear");
  const nudges = await prisma.nudge.findMany({
    where: { generatedEmail: { not: null } },
    select: {
      id: true,
      contactId: true,
      generatedEmail: true,
      contact: { select: { name: true, partnerId: true } },
    },
  });

  let bad = 0;
  let good = 0;
  const badIds: string[] = [];
  const samples: string[] = [];

  for (const n of nudges) {
    let parsed: { body?: string; subject?: string };
    try {
      parsed = JSON.parse(n.generatedEmail ?? "{}");
    } catch {
      continue;
    }
    const body = parsed.body ?? "";
    const isTemplate =
      /Looking forward to reconnecting\./i.test(body) &&
      /Best regards,/i.test(body);
    const hasRawNote = /Last time we spoke, (note|email|call|meeting) on /i.test(body);
    if (isTemplate || hasRawNote) {
      bad++;
      badIds.push(n.id);
      if (samples.length < 4) {
        samples.push(`[${n.contact?.name ?? "?"}] ${body.split("\n").slice(0, 6).join(" / ").slice(0, 280)}`);
      }
    } else {
      good++;
    }
  }

  console.log(`Total nudges with cached draft: ${nudges.length}`);
  console.log(`  Looks like LLM-crafted:     ${good}`);
  console.log(`  Looks like buggy template:  ${bad}`);
  if (samples.length) {
    console.log("\nSamples of buggy drafts:");
    for (const s of samples) console.log("  -", s);
  }
  if (clear && badIds.length) {
    console.log(`\nClearing generatedEmail on ${badIds.length} nudges...`);
    const result = await prisma.nudge.updateMany({
      where: { id: { in: badIds } },
      data: { generatedEmail: null },
    });
    console.log(`Cleared ${result.count} cached drafts.`);
  } else if (clear) {
    console.log("\nNothing to clear.");
  } else if (bad > 0) {
    console.log("\nRe-run with --clear to wipe these poisoned cached drafts so they regenerate.");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

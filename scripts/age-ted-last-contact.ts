/**
 * Backdate Ted Sarandos's last interaction to 56 days ago for Morgan's demo.
 *
 * Three things have to move together so the brief, the contact-list line, and
 * the strategic-insight narrative all agree:
 *
 *   1. Contact.lastContacted   — drives the "X days since last outreach" line
 *                                in the morning brief contact list (computed
 *                                via differenceInDays in the briefing route).
 *   2. Nudge.metadata           — the cached strategicInsight narrative
 *      .strategicInsight         currently bakes in "8-day gap". We rewrite
 *                                the narrative + evidenceCitations text so
 *                                the expander tells the same story.
 *   3. Nudge.generatedEmail     — cleared so the prewarm script regenerates
 *                                an email tuned to a long-cold contact
 *                                (different opener than the 8-day version).
 */
import { prisma } from "@/lib/db/prisma";

const CONTACT_NAME = "Ted Sarandos";
const PARTNER_ID = "p-morgan-chen";
const TARGET_DAYS = 56;

async function main() {
  const contact = await prisma.contact.findFirst({
    where: { name: CONTACT_NAME, partnerId: PARTNER_ID },
    select: { id: true, name: true, lastContacted: true },
  });
  if (!contact) {
    console.error(`Contact "${CONTACT_NAME}" not found for ${PARTNER_ID}`);
    process.exit(1);
  }

  // 56 days + 1 hour back so differenceInDays(now, lastContacted) floors to 56
  // even if the demo box's clock drifts a few seconds.
  const target = new Date(
    Date.now() - TARGET_DAYS * 24 * 60 * 60 * 1000 - 60 * 60 * 1000,
  );

  console.log(
    `Ted's lastContacted: ${contact.lastContacted?.toISOString() ?? "(null)"} → ${target.toISOString()}`,
  );

  await prisma.contact.update({
    where: { id: contact.id },
    data: { lastContacted: target },
  });

  // Sweep his open nudge metadata: update narrative text + clear the cached
  // generatedEmail so prewarm rewrites it with the new "long-cold" framing.
  const openNudges = await prisma.nudge.findMany({
    where: { contactId: contact.id, status: "OPEN" },
    select: { id: true, metadata: true, ruleType: true, reason: true },
  });
  console.log(`Updating ${openNudges.length} open nudge(s)…`);

  for (const n of openNudges) {
    let metadata: Record<string, unknown> | null = null;
    if (n.metadata) {
      try {
        metadata = JSON.parse(n.metadata) as Record<string, unknown>;
      } catch {
        metadata = null;
      }
    }

    if (metadata && typeof metadata === "object") {
      const si = metadata.strategicInsight as
        | {
            narrative?: string;
            oneLiner?: string;
            suggestedAction?: { context?: string };
            evidenceCitations?: { claim?: string }[];
          }
        | undefined;
      if (si) {
        if (si.narrative) {
          si.narrative = si.narrative
            .replace(
              /\*\*\d+-day gap since last interaction\*\*/g,
              `**${TARGET_DAYS}-day gap since last interaction**`,
            )
            .replace(
              /\d+-day gap since last interaction/g,
              `${TARGET_DAYS}-day gap since last interaction`,
            )
            .replace(
              /(only been apart for|been about) [^,.]+/i,
              `gone quiet for ${TARGET_DAYS} days`,
            );
        }
        if (si.suggestedAction?.context) {
          si.suggestedAction.context = si.suggestedAction.context.replace(
            /\d+\s+day(s)?/g,
            `${TARGET_DAYS} days`,
          );
        }
        if (Array.isArray(si.evidenceCitations)) {
          for (const c of si.evidenceCitations) {
            if (c?.claim) {
              c.claim = c.claim.replace(
                /\d+-day gap/g,
                `${TARGET_DAYS}-day gap`,
              );
            }
          }
        }
      }

      // The flat "insights" list also has a FOLLOW_UP entry that may carry a
      // waitingDays counter or "no response in N days" copy. Keep them aligned.
      const insights = metadata.insights as
        | { type?: string; reason?: string; waitingDays?: number }[]
        | undefined;
      if (Array.isArray(insights)) {
        for (const ins of insights) {
          if (ins?.type === "FOLLOW_UP") {
            if (typeof ins.waitingDays === "number") {
              ins.waitingDays = TARGET_DAYS;
            }
            if (typeof ins.reason === "string") {
              ins.reason = ins.reason.replace(
                /no response in \d+ days/i,
                `no response in ${TARGET_DAYS} days`,
              );
            }
          }
          if (ins?.type === "STALE_CONTACT" && typeof ins.reason === "string") {
            ins.reason = ins.reason.replace(
              /\d+ days/g,
              `${TARGET_DAYS} days`,
            );
          }
        }
      }
    }

    await prisma.nudge.update({
      where: { id: n.id },
      data: {
        metadata: metadata ? JSON.stringify(metadata) : null,
        // Clear the cached email — prewarm will regenerate with the fresh
        // 56-day-cold context so the opener doesn't say "since dinner last
        // month".
        generatedEmail: null,
      },
    });
    console.log(
      `  - ${n.ruleType.padEnd(12)} ${n.id} (metadata rewritten, email cleared)`,
    );
  }

  await prisma.$disconnect();
  console.log(
    `\nDone. Now run:\n  npx tsx scripts/prewarm-partner.ts --partner=p-morgan-chen --no-refresh`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

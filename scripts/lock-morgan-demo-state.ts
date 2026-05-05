/**
 * Canonical "demo state" for Morgan Chen.
 *
 * This script forces the database back to the curated configuration the
 * demo expects, regardless of what dry runs, accidental Send Email taps,
 * or background refreshes might have done since the last run. It is
 * idempotent — safe to run as many times as you want — and is the single
 * source of truth for the demo nudge layout.
 *
 * What it locks:
 *   1. Ted Sarandos (Netflix) — HIGH FOLLOW_UP, OPEN, with the
 *      InterPositive AI strategic-insight narrative, 56-day gap framing,
 *      and the hand-crafted Sven-voice email body
 *   2. Ted's Contact.lastContacted = 56 days ago (drives the brief's
 *      "X days since last outreach" line)
 *   3. Eddy Cue (Apple) — every nudge DONE, every cached email cleared
 *      (he was noisy and we don't want him in the brief)
 *   4. camp-central-006 (Sustainability & ESG) — Morgan's 3 recipients
 *      reset to PENDING so "Review my campaign approvals" surfaces them
 *   5. All DONE / SNOOZED nudges cluster-wide have generatedEmail nulled
 *      so the chat fast-path can never serve a stale draft if the OPEN
 *      ordering hiccups
 *
 * Usage:
 *   npx tsx scripts/lock-morgan-demo-state.ts
 *
 * Then prewarm to bust the briefing cache:
 *   npx tsx scripts/prewarm-partner.ts --partner=p-morgan-chen --no-refresh
 *
 * Or use the shorthand wrapper:
 *   npx tsx scripts/demo-prep.ts
 */
import { prisma } from "@/lib/db/prisma";

const PARTNER_ID = "p-morgan-chen";

// ── 1. Ted Sarandos canonical state ─────────────────────────────────
const TED_TARGET_DAYS = 56;
const TED_NUDGE_ID = "aaca87eb-1410-4250-bf43-82ce60886d0a";

const TED_EMAIL = {
  subject: "InterPositive — and that dinner conversation",
  body: `Hi Ted,

Saw the InterPositive AI announcement — congrats. Hard not to read it as a bet on the thesis you were laying out at dinner: that the next margin frontier in streaming is the unit cost of original production, not just the top of the funnel.

Most of the coverage frames it as a cost-savings story. The question I keep turning over, and the one I'd be curious how you're thinking about, is the operating model — whether InterPositive becomes a capability the creative orgs actively pull from, or an internal vendor they route around. The first 90 days usually set that pattern.

No agenda from my side — just didn't want the moment to pass without a note. If a coffee or a 30-minute call in the next month or two makes sense, I'd enjoy it. If it's a stretch, I'll catch you at the next industry thing.

Either way, congrats on the deal.

Best,
Morgan`,
};

const TED_STRATEGIC_INSIGHT = {
  narrative: `With **Netflix's recent acquisition of InterPositive AI** and a busy content rollout including **ONE PIECE Season 2**, Ted Sarandos is under pressure to integrate new technologies while maintaining a robust content strategy. The **${TED_TARGET_DAYS}-day gap since last interaction** suggests a ripe opportunity to reconnect, especially as he seeks deeper collaboration with his finance team on monetization strategies. Engaging now can position us as a strategic partner during this pivotal moment.`,
  oneLiner: "Ted Sarandos faces pressure to integrate AI while launching new content.",
  suggestedAction: {
    label: "Discuss Netflix's AI and content strategy",
    context: `Given the recent acquisition of InterPositive AI and the launch of major content like ONE PIECE Season 2, Ted is focused on integrating AI tools to enhance production efficiency while navigating a busy content slate. This is an ideal moment to reach out and offer insights that align with his current priorities, particularly around monetization and technology integration.`,
    emailAngle: "AI and content integration",
  },
  evidenceCitations: [
    {
      claim:
        "Netflix's recent acquisition of InterPositive AI and a busy content rollout including ONE PIECE Season 2",
      insightTypes: ["COMPANY_NEWS"],
      signalIds: ["sig-0037", "sig-0038"],
      sourceUrls: [
        "https://www.newsshooter.com/2026/03/05/netflix-buys-ben-afflecks-interpositive-ai-startup/",
        "https://www.hollywoodreporter.com/tv/tv-news/netflix-march-2026-new-releases-movies-tv-1236520338/",
      ],
    },
    {
      claim: `${TED_TARGET_DAYS}-day gap since last interaction suggests a ripe opportunity to reconnect`,
      insightTypes: ["FOLLOW_UP"],
      signalIds: ["signal-id-1"],
      sourceUrls: [],
    },
  ],
  generatedAt: new Date().toISOString(),
};

const TED_INSIGHTS = [
  {
    type: "COMPANY_NEWS",
    reason:
      'Netflix in the news: "Netflix launches ONE PIECE Season 2 on March 10 and Peaky Blinders film on March 20 — major content slate for March"',
    signalContent:
      "Netflix launches ONE PIECE Season 2 on March 10 and Peaky Blinders film on March 20 — major content slate for March",
    signalUrl:
      "https://www.hollywoodreporter.com/tv/tv-news/netflix-march-2026-new-releases-movies-tv-1236520338/",
    priority: "HIGH",
  },
  {
    type: "COMPANY_NEWS",
    reason:
      "Netflix in the news: \"Netflix acquires Ben Affleck's InterPositive AI startup — AI tools for color correction, VFX, and relighting to reduce production costs\"",
    signalContent:
      "Netflix acquires Ben Affleck's InterPositive AI startup — AI tools for color correction, VFX, and relighting to reduce production costs",
    signalUrl:
      "https://www.newsshooter.com/2026/03/05/netflix-buys-ben-afflecks-interpositive-ai-startup/",
    priority: "HIGH",
  },
  {
    type: "FOLLOW_UP",
    reason: `Follow up with Ted Sarandos — no response in ${TED_TARGET_DAYS} days`,
    waitingDays: TED_TARGET_DAYS,
    priority: "HIGH",
  },
];

const TED_REASON =
  "Netflix's InterPositive AI acquisition + content slate — and 56 days since last outreach.";

async function lockTed() {
  const ted = await prisma.contact.findFirst({
    where: { name: "Ted Sarandos", partnerId: PARTNER_ID },
    select: { id: true },
  });
  if (!ted) throw new Error("Ted Sarandos not found");

  // 1a — backdate lastContacted to 56 days + 1 hour ago (floor → 56)
  const targetDate = new Date(
    Date.now() - TED_TARGET_DAYS * 24 * 60 * 60 * 1000 - 60 * 60 * 1000,
  );
  await prisma.contact.update({
    where: { id: ted.id },
    data: { lastContacted: targetDate },
  });

  // 1b — find or restore the canonical Ted nudge
  let nudge = await prisma.nudge.findUnique({ where: { id: TED_NUDGE_ID } });

  const metadata = JSON.stringify({
    insights: TED_INSIGHTS,
    strategicInsight: TED_STRATEGIC_INSIGHT,
  });
  const generatedEmail = JSON.stringify(TED_EMAIL);

  if (!nudge) {
    // The original was hard-deleted. Recreate it.
    nudge = await prisma.nudge.create({
      data: {
        id: TED_NUDGE_ID,
        contactId: ted.id,
        ruleType: "FOLLOW_UP",
        priority: "HIGH",
        status: "OPEN",
        reason: TED_REASON,
        metadata,
        generatedEmail,
      },
    });
    console.log("  Ted nudge re-created from scratch");
  } else {
    await prisma.nudge.update({
      where: { id: TED_NUDGE_ID },
      data: {
        contactId: ted.id,
        status: "OPEN",
        ruleType: "FOLLOW_UP",
        priority: "HIGH",
        reason: TED_REASON,
        metadata,
        generatedEmail,
      },
    });
    console.log(`  Ted nudge reset → status=OPEN  (was ${nudge.status})`);
  }

  console.log(`  Ted lastContacted → ${TED_TARGET_DAYS} days ago`);
}

// ── 2. Eddy Cue stays dismissed, no stale drafts ────────────────────
async function lockEddy() {
  const eddy = await prisma.contact.findFirst({
    where: { name: "Eddy Cue", partnerId: PARTNER_ID },
    select: { id: true },
  });
  if (!eddy) return;

  const open = await prisma.nudge.updateMany({
    where: { contactId: eddy.id, status: "OPEN" },
    data: { status: "DONE" },
  });
  if (open.count > 0) {
    console.log(`  Eddy: re-dismissed ${open.count} OPEN nudge(s)`);
  } else {
    console.log("  Eddy: still fully dismissed ✓");
  }

  await prisma.nudge.updateMany({
    where: { contactId: eddy.id, generatedEmail: { not: null } },
    data: { generatedEmail: null },
  });
}

// ── 3. Campaign approval — Morgan's 3 recipients PENDING ────────────
async function lockCampaignApproval() {
  const result = await prisma.campaignRecipient.updateMany({
    where: { campaignId: "camp-central-006", assignedPartnerId: PARTNER_ID },
    data: { approvalStatus: "PENDING", status: "PENDING" },
  });
  console.log(
    `  camp-central-006: ${result.count} recipient(s) reset to PENDING`,
  );
}

// ── 4. Cluster-wide: clear stale drafts on closed nudges ────────────
async function clearStaleClosedDrafts() {
  const result = await prisma.nudge.updateMany({
    where: {
      contact: { partnerId: PARTNER_ID },
      status: { in: ["DONE", "SNOOZED"] },
      generatedEmail: { not: null },
    },
    data: { generatedEmail: null },
  });
  if (result.count > 0) {
    console.log(`  Cleared generatedEmail on ${result.count} closed nudge(s)`);
  }
}

async function main() {
  console.log(`Locking demo state for ${PARTNER_ID}…\n`);
  await lockTed();
  await lockEddy();
  await lockCampaignApproval();
  await clearStaleClosedDrafts();
  console.log("\nDone. Now run prewarm to bust the briefing cache:");
  console.log(
    "  npx tsx scripts/prewarm-partner.ts --partner=p-morgan-chen --no-refresh",
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

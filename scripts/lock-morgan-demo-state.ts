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
 *   1. Two demo meetings pushed forward so they always live in the future:
 *      - mtg-084 "Deal Review: Meta Platforms Expansion" (Mark Zuckerberg) → today
 *      - mtg-085 "Apple Contract Renewal Discussion" (Eddy Cue + Sundar) → tomorrow
 *      These drive the morning brief's "two meetings on your calendar"
 *      spoken opening and the "Prep client meeting" action card.
 *   2. Ted Sarandos (Netflix) — HIGH FOLLOW_UP, OPEN, with the
 *      InterPositive AI strategic-insight narrative, 56-day gap framing,
 *      and the hand-crafted Sven-voice email body
 *   3. Ted's Contact.lastContacted = 56 days ago (drives the brief's
 *      "X days since last outreach" line)
 *   4. Eddy Cue (Apple) — every nudge DONE, every cached email cleared
 *      (he was noisy and we don't want him in the brief)
 *   5. camp-central-006 (Sustainability & ESG) — Morgan's 3 recipients
 *      reset to PENDING so "Review my campaign approvals" surfaces them
 *   6. All DONE / SNOOZED nudges cluster-wide have generatedEmail nulled
 *      so the chat fast-path can never serve a stale draft if the OPEN
 *      ordering hiccups
 *
 * Order of operations matters: we move meetings + age Ted's lastContacted
 * BEFORE calling `refreshNudgesForPartner`, because the engine wipes all
 * OPEN nudges and recreates from scratch. Patching Ted's canonical email
 * onto a fixed nudge id is futile — the engine assigns a fresh id every
 * refresh. So we run refresh first, then look up Ted's freshly-created
 * FOLLOW_UP nudge by contact and patch it in place.
 *
 * Demo safety: `BRIEFING_DISABLE_AUTO_REFRESH=1` in `.env` keeps the
 * briefing route from running another refresh that would clobber Ted.
 *
 * Usage:
 *   npx tsx scripts/lock-morgan-demo-state.ts
 *
 * Or, for end-to-end demo prep (lock + briefing cache + TTS prewarm):
 *   npx tsx scripts/demo-prep.ts
 */
import { prisma } from "@/lib/db/prisma";
import { refreshNudgesForPartner } from "@/lib/services/nudge-engine";

const PARTNER_ID = "p-morgan-chen";

// ── Meetings: keep these in the future on every run ─────────────────
// We anchor on "today's local time" so re-running this script throughout
// the day always lands the meetings at sensible "later today" / "tomorrow
// morning" slots. If today's slot has already passed when the script
// runs (e.g. lock at 6pm targeting a 5pm meeting), we bump to "now + 1h"
// rounded up to the next half hour so it still reads as "today".
const META_MEETING_ID = "mtg-084";
const APPLE_MEETING_ID = "mtg-085";

function nextHalfHour(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  const m = out.getMinutes();
  if (m === 0 || m === 30) {
    out.setMinutes(m + 30);
  } else if (m < 30) {
    out.setMinutes(30);
  } else {
    out.setHours(out.getHours() + 1);
    out.setMinutes(0);
  }
  return out;
}

function todayAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function tomorrowAt(hour: number, minute: number): Date {
  const d = todayAt(hour, minute);
  d.setDate(d.getDate() + 1);
  return d;
}

function pickTodayOrBumpForward(preferred: Date): Date {
  const now = new Date();
  if (preferred.getTime() > now.getTime() + 30 * 60 * 1000) return preferred;
  const bumped = nextHalfHour(new Date(now.getTime() + 60 * 60 * 1000));
  // Don't push past 7pm; if we'd cross that line, fall to tomorrow morning.
  if (bumped.getHours() >= 19) return tomorrowAt(10, 0);
  return bumped;
}

// ── Ted Sarandos canonical state ────────────────────────────────────
const TED_TARGET_DAYS = 56;

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

async function ageTedLastContacted() {
  const ted = await prisma.contact.findFirst({
    where: { name: "Ted Sarandos", partnerId: PARTNER_ID },
    select: { id: true },
  });
  if (!ted) throw new Error("Ted Sarandos not found");
  const targetDate = new Date(
    Date.now() - TED_TARGET_DAYS * 24 * 60 * 60 * 1000 - 60 * 60 * 1000,
  );
  await prisma.contact.update({
    where: { id: ted.id },
    data: { lastContacted: targetDate },
  });
  console.log(`  Ted lastContacted → ${TED_TARGET_DAYS} days ago`);
}

/**
 * Patch Ted's freshly-created OPEN FOLLOW_UP nudge with the canonical
 * subject/body/metadata. Runs AFTER `refreshNudgesForPartner` so the
 * engine has already created Ted's nudge with a fresh id.
 *
 * If somehow no Ted FOLLOW_UP open nudge exists (e.g. config disables
 * the rule), we fall back to creating one — Ted is a demo centerpiece
 * and must always show.
 */
async function patchTedNudge() {
  const ted = await prisma.contact.findFirst({
    where: { name: "Ted Sarandos", partnerId: PARTNER_ID },
    select: { id: true },
  });
  if (!ted) throw new Error("Ted Sarandos not found");

  const metadata = JSON.stringify({
    insights: TED_INSIGHTS,
    strategicInsight: TED_STRATEGIC_INSIGHT,
  });
  const generatedEmail = JSON.stringify(TED_EMAIL);

  const followUp = await prisma.nudge.findFirst({
    where: { contactId: ted.id, status: "OPEN", ruleType: "FOLLOW_UP" },
    select: { id: true },
  });

  if (followUp) {
    await prisma.nudge.update({
      where: { id: followUp.id },
      data: {
        priority: "HIGH",
        reason: TED_REASON,
        metadata,
        generatedEmail,
      },
    });
    console.log(`  Ted FOLLOW_UP nudge patched → ${followUp.id.slice(0, 8)}`);
  } else {
    // Engine didn't surface Ted as FOLLOW_UP this pass (rule disabled or
    // unusual config). Manufacture one so the demo never silently loses
    // Ted from the briefing.
    const created = await prisma.nudge.create({
      data: {
        contactId: ted.id,
        ruleType: "FOLLOW_UP",
        priority: "HIGH",
        status: "OPEN",
        reason: TED_REASON,
        metadata,
        generatedEmail,
      },
      select: { id: true },
    });
    console.log(`  Ted FOLLOW_UP nudge created → ${created.id.slice(0, 8)}`);
  }

  // Mark every other OPEN Ted nudge DONE so the briefing never picks
  // a competing one over the canonical FOLLOW_UP.
  const otherOpen = await prisma.nudge.updateMany({
    where: {
      contactId: ted.id,
      status: "OPEN",
      ruleType: { not: "FOLLOW_UP" },
    },
    data: { status: "DONE" },
  });
  if (otherOpen.count > 0) {
    console.log(`  Ted: closed ${otherOpen.count} other OPEN nudge(s)`);
  }
}

// ── Meetings: anchor demo to safe future windows ────────────────────
async function lockMeetings() {
  const metaTarget = pickTodayOrBumpForward(todayAt(17, 0)); // today 5:00 PM
  const appleTarget = tomorrowAt(10, 0); // tomorrow 10:00 AM

  const m1 = await prisma.meeting.update({
    where: { id: META_MEETING_ID },
    data: { startTime: metaTarget },
    select: { title: true, startTime: true },
  });
  console.log(
    `  ${META_MEETING_ID} "${m1.title}" → ${m1.startTime.toLocaleString()}`,
  );

  const m2 = await prisma.meeting.update({
    where: { id: APPLE_MEETING_ID },
    data: { startTime: appleTarget },
    select: { title: true, startTime: true },
  });
  console.log(
    `  ${APPLE_MEETING_ID} "${m2.title}" → ${m2.startTime.toLocaleString()}`,
  );
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

  console.log("[1/6] Anchoring meeting times to safe future windows");
  await lockMeetings();

  console.log("\n[2/6] Aging Ted's lastContacted before refresh");
  await ageTedLastContacted();

  console.log("\n[3/6] Refreshing nudges (engine wipes + recreates OPEN set)");
  const tRefresh = Date.now();
  await refreshNudgesForPartner(PARTNER_ID);
  console.log(`      done in ${((Date.now() - tRefresh) / 1000).toFixed(1)}s`);

  console.log("\n[4/6] Patching Ted's fresh nudge with canonical email");
  await patchTedNudge();

  console.log("\n[5/6] Re-dismissing Eddy + clearing his stale drafts");
  await lockEddy();

  console.log("\n[6/6] Resetting campaign approval + clearing stale drafts");
  await lockCampaignApproval();
  await clearStaleClosedDrafts();

  console.log("\nDone. Briefing cache will rebuild on next request.");
  console.log("Recommended next: `npx tsx scripts/demo-prep.ts` to also");
  console.log("warm the briefing response cache + the mobile TTS audio.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

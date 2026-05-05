/**
 * Pre-warm every cache that drives the live demo so the first browser open
 * after `npm run dev` is instant:
 *   - the morning brief response (~30s otherwise)
 *   - the email-draft cache (~10s per cold tap otherwise)
 *   - the strategic-insight cache (already free; included for completeness)
 *
 * Usage:
 *   npx tsx scripts/prewarm-partner.ts --partner=p-morgan-chen
 *   npx tsx scripts/prewarm-partner.ts --partner=p-morgan-chen --concurrency=4
 *   npx tsx scripts/prewarm-partner.ts --partner=p-morgan-chen --no-refresh --no-briefing
 *
 * What it does, in order:
 *   1. refreshNudgesForPartner — regenerates the nudge set so caches are
 *      computed against the current rules / signals (skip with --no-refresh).
 *   2. enrichNudgesWithInsights — fills meta.strategicInsight (idempotent).
 *   3. generateAndCacheNudgeEmail for every contact nudge missing
 *      generatedEmail (idempotent; CAMPAIGN_APPROVAL / ARTICLE_CAMPAIGN are
 *      skipped because the partner taps a picker for those, not a single
 *      drafted email).
 *   4. Hits GET /api/dashboard/briefing once so the in-memory response cache
 *      is hot for subsequent /mobile loads (skip with --no-briefing). Reads
 *      BASE_URL from --base-url=… or env BRIEFING_BASE_URL or
 *      http://localhost:3000.
 *
 * Safe to re-run. Each step is a no-op if the cache is already populated.
 */
import { prisma } from "@/lib/db/prisma";
import {
  refreshNudgesForPartner,
  enrichNudgesWithInsights,
} from "@/lib/services/nudge-engine";
import { generateAndCacheNudgeEmail } from "@/lib/services/nudge-email-cache";

type Args = {
  partnerId: string;
  refresh: boolean;
  briefing: boolean;
  baseUrl: string;
  concurrency: number;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = {
    partnerId: "",
    refresh: true,
    briefing: true,
    baseUrl: process.env.BRIEFING_BASE_URL ?? "http://localhost:3000",
    concurrency: 3,
  };
  for (const a of argv) {
    if (a.startsWith("--partner=")) out.partnerId = a.slice("--partner=".length);
    else if (a === "--no-refresh") out.refresh = false;
    else if (a === "--no-briefing") out.briefing = false;
    else if (a.startsWith("--base-url="))
      out.baseUrl = a.slice("--base-url=".length).replace(/\/$/, "");
    else if (a.startsWith("--concurrency="))
      out.concurrency = Math.max(1, Number(a.slice("--concurrency=".length)));
  }
  if (!out.partnerId) {
    console.error(
      "usage: prewarm-partner.ts --partner=<id> [--no-refresh] [--no-briefing] [--base-url=<url>] [--concurrency=N]",
    );
    process.exit(2);
  }
  return out;
}

async function pMapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<void>,
): Promise<void> {
  const queue = items.map((item, idx) => ({ item, idx }));
  const workers: Promise<void>[] = [];
  const drain = async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      await fn(next.item, next.idx);
    }
  };
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    workers.push(drain());
  }
  await Promise.all(workers);
}

async function main() {
  const args = parseArgs();
  const partner = await prisma.partner.findUnique({
    where: { id: args.partnerId },
    select: { id: true, name: true },
  });
  if (!partner) {
    console.error(`Partner ${args.partnerId} not found.`);
    process.exit(1);
  }

  console.log(`\nPre-warming caches for ${partner.name} (${partner.id})\n`);

  if (args.refresh) {
    console.log("[1/4] Refreshing nudges from current rules / signals…");
    const t0 = Date.now();
    await refreshNudgesForPartner(partner.id);
    console.log(`      done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } else {
    console.log("[1/4] Skipping refresh (--no-refresh)");
  }

  console.log("[2/4] Enriching nudges with strategic insights…");
  {
    const t0 = Date.now();
    await enrichNudgesWithInsights(partner.id);
    console.log(`      done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }

  const candidates = await prisma.nudge.findMany({
    where: {
      contact: { partnerId: partner.id },
      status: "OPEN",
      generatedEmail: null,
      ruleType: { notIn: ["CAMPAIGN_APPROVAL", "ARTICLE_CAMPAIGN"] },
    },
    select: { id: true, contact: { select: { name: true } } },
  });
  console.log(
    `[3/4] Pre-generating ${candidates.length} email draft(s) at concurrency ${args.concurrency}…`,
  );

  let done = 0;
  let failed = 0;
  const t0 = Date.now();
  await pMapLimit(candidates, args.concurrency, async (n) => {
    try {
      await generateAndCacheNudgeEmail(n.id);
      done++;
      process.stdout.write(`      ✓ ${n.contact.name}\n`);
    } catch (err) {
      failed++;
      process.stdout.write(
        `      ✗ ${n.contact.name}: ${(err as Error).message}\n`,
      );
    }
  });
  console.log(
    `      ${done} drafted, ${failed} failed in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`,
  );

  if (args.briefing) {
    console.log(
      `[4/4] Pre-warming morning brief response cache via ${args.baseUrl}/api/dashboard/briefing…`,
    );
    const tBrief = Date.now();
    try {
      const res = await fetch(`${args.baseUrl}/api/dashboard/briefing`, {
        headers: { Cookie: `partner_id=${partner.id}` },
      });
      const ms = Date.now() - tBrief;
      if (res.ok) {
        console.log(`      ✓ briefing cached in ${(ms / 1000).toFixed(1)}s`);
      } else {
        console.log(
          `      ✗ briefing returned ${res.status} ${res.statusText} (after ${(ms / 1000).toFixed(1)}s)`,
        );
        console.log(
          `        — make sure the dev server is running on ${args.baseUrl}`,
        );
      }
    } catch (err) {
      console.log(
        `      ✗ briefing request failed: ${(err as Error).message}`,
      );
      console.log(
        `        — make sure the dev server is running on ${args.baseUrl}`,
      );
    }
    console.log();
  } else {
    console.log("[4/4] Skipping briefing prewarm (--no-briefing)\n");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Verification script for the news ingestion pipeline.
 * Run: npx tsx scripts/verify-news-pipeline.ts
 *
 * Verifies: Tavily fetch → ExternalSignal (NEWS) → Nudge (COMPANY_NEWS)
 */
import "dotenv/config";
import {
  ingestNewsForPartner,
} from "../src/lib/services/news-ingestion-service";
import { refreshNudgesForPartner } from "../src/lib/services/nudge-engine";
import { prisma } from "../src/lib/db/prisma";
import { partnerRepo } from "../src/lib/repositories";

async function main() {
  console.log("=== CRM Nudge Platform — News Pipeline Verification ===\n");

  // 1. Get partner
  const partner = await partnerRepo.findByEmail("ava.patel@firm.com");
  if (!partner) {
    console.error("Partner ava.patel@firm.com not found. Run seed first.");
    process.exit(1);
  }
  console.log(`Partner: ${partner.name} (${partner.id})\n`);

  // 2. Check TAVILY_API_KEY
  if (!process.env.TAVILY_API_KEY) {
    console.error("TAVILY_API_KEY not set in .env");
    process.exit(1);
  }
  console.log("TAVILY_API_KEY: present\n");

  // 3. Current state before refresh
  const newsBefore = await prisma.externalSignal.count({
    where: { type: "NEWS" },
  });
  const companyNewsNudgesBefore = await prisma.nudge.count({
    where: { ruleType: "COMPANY_NEWS" },
  });
  console.log(`Before refresh: ${newsBefore} NEWS signals, ${companyNewsNudgesBefore} COMPANY_NEWS nudges\n`);

  // 4. Sample of existing NEWS signals (to see if seed vs Tavily)
  const sampleNews = await prisma.externalSignal.findMany({
    where: { type: "NEWS" },
    take: 3,
    orderBy: { createdAt: "desc" },
  });
  if (sampleNews.length > 0) {
    console.log("Sample existing NEWS signals:");
    for (const s of sampleNews) {
      console.log(`  - ${s.content?.slice(0, 80)}...`);
      console.log(`    URL: ${s.url}`);
      console.log(`    createdAt: ${s.createdAt}`);
    }
    console.log();
  }

  // 5. Run news ingestion
  console.log("Running ingestNewsForPartner (Tavily fetch)...");
  const newsCount = await ingestNewsForPartner(partner.id);
  console.log(`Ingested: ${newsCount} news signals\n`);

  // 6. State after refresh
  const newsAfter = await prisma.externalSignal.count({
    where: { type: "NEWS" },
  });
  const companyNewsNudgesAfter = await prisma.nudge.count({
    where: { ruleType: "COMPANY_NEWS" },
  });
  console.log(`After refresh: ${newsAfter} NEWS signals, ${companyNewsNudgesAfter} COMPANY_NEWS nudges\n`);

  // 7. Sample of NEWEST NEWS signals (most likely from Tavily if recent)
  const newestNews = await prisma.externalSignal.findMany({
    where: { type: "NEWS" },
    take: 5,
    orderBy: { createdAt: "desc" },
  });
  console.log("Newest NEWS signals after ingestion:");
  for (const s of newestNews) {
    console.log(`  - ${s.content?.slice(0, 100)}...`);
    console.log(`    URL: ${s.url}`);
    console.log(`    companyId: ${s.companyId} | createdAt: ${s.createdAt}`);
  }

  // 8. Sample COMPANY_NEWS nudges
  const nudges = await prisma.nudge.findMany({
    where: { ruleType: "COMPANY_NEWS" },
    take: 3,
    include: { signal: true },
  });
  console.log("\nSample COMPANY_NEWS nudges:");
  for (const n of nudges) {
    console.log(`  - ${n.reason?.slice(0, 100)}...`);
    console.log(`    signalId: ${n.signalId} | signal URL: ${n.signal?.url}`);
  }

  console.log("\n=== Verification complete ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

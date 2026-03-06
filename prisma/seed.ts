import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { partners } from "./seed-data/partners";
import { companies } from "./seed-data/companies";
import { generateContacts } from "./seed-data/contacts";
import { generateInteractions } from "./seed-data/interactions";
import { generateSignals } from "./seed-data/signals";
import { generateMeetings } from "./seed-data/meetings";
import {
  generateEventRegistrations,
  generateArticleEngagements,
  generateCampaignOutreaches,
} from "./seed-data/engagements";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...\n");

  // Clear existing data
  await prisma.campaignOutreach.deleteMany();
  await prisma.articleEngagement.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.meetingAttendee.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.nudge.deleteMany();
  await prisma.externalSignal.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.partner.deleteMany();

  // Partners
  console.log(`Creating ${partners.length} partners...`);
  for (const p of partners) {
    await prisma.partner.create({ data: p });
  }

  // Companies
  console.log(`Creating ${companies.length} companies...`);
  for (const c of companies) {
    await prisma.company.create({ data: c });
  }

  // Contacts
  const contacts = generateContacts();
  console.log(`Creating ${contacts.length} contacts...`);
  for (const c of contacts) {
    await prisma.contact.create({ data: c });
  }

  // Interactions
  const contactRefs = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    companyId: c.companyId,
    title: c.title,
  }));
  const interactions = generateInteractions(contactRefs);
  console.log(`Creating ${interactions.length} interactions...`);
  for (const batch of chunk(interactions, 50)) {
    await prisma.interaction.createMany({ data: batch });
  }

  // Update last_contacted on contacts based on most recent interaction
  console.log("Updating last_contacted timestamps...");
  for (const contact of contacts) {
    const latest = interactions
      .filter((i) => i.contactId === contact.id)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    if (latest) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastContacted: latest.date },
      });
    }
  }

  // External Signals
  const signals = generateSignals(contactRefs);
  console.log(`Creating ${signals.length} external signals...`);
  for (const batch of chunk(signals, 50)) {
    await prisma.externalSignal.createMany({ data: batch });
  }

  // Meetings
  const meetingContactRefs = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    companyId: c.companyId,
    partnerId: c.partnerId,
    title: c.title,
  }));
  const meetings = generateMeetings(meetingContactRefs);
  console.log(`Creating ${meetings.length} meetings...`);
  for (const m of meetings) {
    const { attendeeContactIds, ...meetingData } = m;
    await prisma.meeting.create({
      data: {
        ...meetingData,
        attendees: {
          create: attendeeContactIds.map((contactId) => ({
            contact: { connect: { id: contactId } },
          })),
        },
      },
    });
  }

  // Engagement data: Events, Articles, Campaigns
  const engagementContactRefs = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    companyId: c.companyId,
    partnerId: c.partnerId,
    title: c.title,
  }));

  const eventRegs = generateEventRegistrations(engagementContactRefs);
  console.log(`Creating ${eventRegs.length} event registrations...`);
  for (const batch of chunk(eventRegs, 50)) {
    await prisma.eventRegistration.createMany({ data: batch });
  }

  const articleEngs = generateArticleEngagements(engagementContactRefs);
  console.log(`Creating ${articleEngs.length} article engagements...`);
  for (const batch of chunk(articleEngs, 50)) {
    await prisma.articleEngagement.createMany({ data: batch });
  }

  const campaignOuts = generateCampaignOutreaches(engagementContactRefs);
  console.log(`Creating ${campaignOuts.length} campaign outreaches...`);
  for (const batch of chunk(campaignOuts, 50)) {
    await prisma.campaignOutreach.createMany({ data: batch });
  }

  console.log("\n✅ Seed complete!");
  console.log(`   Partners:     ${partners.length}`);
  console.log(`   Companies:    ${companies.length}`);
  console.log(`   Contacts:     ${contacts.length}`);
  console.log(`   Interactions: ${interactions.length}`);
  console.log(`   Signals:      ${signals.length}`);
  console.log(`   Meetings:     ${meetings.length}`);
  console.log(`   Events:       ${eventRegs.length}`);
  console.log(`   Articles:     ${articleEngs.length}`);
  console.log(`   Campaigns:    ${campaignOuts.length}`);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

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
import { generateSequenceData } from "./seed-data/sequences";
import { generateContentLibrary } from "./seed-data/content-library";
import { generateMockCampaigns } from "./seed-data/campaigns";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...\n");

  // Clear existing data (order matters for FK constraints)
  await prisma.campaignEngagement.deleteMany();
  await prisma.campaignRecipient.deleteMany();
  await prisma.campaignContent.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.contentItem.deleteMany();
  await prisma.cadenceStep.deleteMany();
  await prisma.outreachSequence.deleteMany();
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
    partnerId: c.partnerId,
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
    const { attendees: meetingAttendees, ...meetingData } = m;
    await prisma.meeting.create({
      data: {
        ...meetingData,
        attendees: {
          create: meetingAttendees.map((a) => ({
            contact: { connect: { id: a.contactId } },
            isRequired: a.isRequired,
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

  // Content Library
  const { articles: contentArticles, events: contentEvents } =
    generateContentLibrary();
  const allContentItems = [...contentArticles, ...contentEvents];
  console.log(`Creating ${allContentItems.length} content library items...`);
  for (const batch of chunk(allContentItems, 50)) {
    await prisma.contentItem.createMany({ data: batch });
  }

  // Mock Campaigns (all partners)
  const mockCampaignData = generateMockCampaigns(contactRefs);
  console.log(`Creating ${mockCampaignData.campaigns.length} mock campaigns...`);
  for (const c of mockCampaignData.campaigns) {
    await prisma.campaign.create({ data: c });
  }
  if (mockCampaignData.campaignContents.length > 0) {
    for (const batch of chunk(mockCampaignData.campaignContents, 50)) {
      await prisma.campaignContent.createMany({ data: batch });
    }
  }
  console.log(`Creating ${mockCampaignData.recipients.length} campaign recipients...`);
  for (const batch of chunk(mockCampaignData.recipients, 50)) {
    await prisma.campaignRecipient.createMany({ data: batch });
  }
  console.log(`Creating ${mockCampaignData.engagements.length} campaign engagements...`);
  for (const batch of chunk(mockCampaignData.engagements, 50)) {
    await prisma.campaignEngagement.createMany({ data: batch });
  }

  // Cadence engine demo data: sequences, steps, follow-up nudges
  const seqData = generateSequenceData(contactRefs);

  const allSeqInteractions = [
    ...seqData.inboundInteractions,
    ...seqData.outboundInteractions,
  ];
  if (allSeqInteractions.length > 0) {
    console.log(`Creating ${allSeqInteractions.length} cadence interactions...`);
    await prisma.interaction.createMany({ data: allSeqInteractions });
  }

  // Origin nudges must exist before sequences reference them
  const originNudges = seqData.sequenceNudges.filter(
    (n) => n.id.startsWith("nudge-origin-")
  );
  if (originNudges.length > 0) {
    console.log(`Creating ${originNudges.length} origin nudges...`);
    await prisma.nudge.createMany({ data: originNudges });
  }

  console.log(`Creating ${seqData.sequences.length} outreach sequences...`);
  for (const seq of seqData.sequences) {
    await prisma.outreachSequence.create({ data: seq });
  }

  if (seqData.cadenceSteps.length > 0) {
    console.log(`Creating ${seqData.cadenceSteps.length} cadence steps...`);
    await prisma.cadenceStep.createMany({ data: seqData.cadenceSteps });
  }

  const activeNudges = seqData.sequenceNudges.filter(
    (n) => !n.id.startsWith("nudge-origin-")
  );
  if (activeNudges.length > 0) {
    console.log(`Creating ${activeNudges.length} sequence/reply nudges...`);
    await prisma.nudge.createMany({ data: activeNudges });
  }

  console.log("\n✅ Seed complete!");
  console.log(`   Partners:     ${partners.length}`);
  console.log(`   Companies:    ${companies.length}`);
  console.log(`   Contacts:     ${contacts.length}`);
  console.log(`   Interactions: ${interactions.length + allSeqInteractions.length}`);
  console.log(`   Signals:      ${signals.length}`);
  console.log(`   Meetings:     ${meetings.length}`);
  console.log(`   Events:       ${eventRegs.length}`);
  console.log(`   Articles:     ${articleEngs.length}`);
  console.log(`   Camp. outr.:  ${campaignOuts.length}`);
  console.log(`   Content lib:  ${allContentItems.length}`);
  console.log(`   Campaigns:    ${mockCampaignData.campaigns.length}`);
  console.log(`   Sequences:    ${seqData.sequences.length}`);
  console.log(`   Steps:        ${seqData.cadenceSteps.length}`);
  console.log(`   Seq Nudges:   ${seqData.sequenceNudges.length}`);
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

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function outreachSentAt(o: { statusDate: Date; createdAt: Date }): Date {
  return o.statusDate ?? o.createdAt;
}

async function main() {
  const outreaches = await prisma.campaignOutreach.findMany({
    include: {
      contact: { select: { partnerId: true } },
    },
  });

  const groups = new Map<string, typeof outreaches>();
  for (const o of outreaches) {
    const key = `${o.contact.partnerId}::${normalizeName(o.name)}`;
    const list = groups.get(key) ?? [];
    list.push(o);
    groups.set(key, list);
  }

  let campaignCount = 0;
  let recipientCount = 0;

  for (const records of groups.values()) {
    const partnerId = records[0].contact.partnerId;
    const displayName = records[0].name.trim();

    const byContact = new Map<string, Date>();
    for (const r of records) {
      const sent = outreachSentAt(r);
      const prev = byContact.get(r.contactId);
      if (!prev || sent.getTime() > prev.getTime()) {
        byContact.set(r.contactId, sent);
      }
    }

    const sentTimes = [...byContact.values()];
    const maxSent = new Date(
      Math.max(...sentTimes.map((d) => d.getTime()))
    );

    const campaign = await prisma.campaign.create({
      data: {
        partnerId,
        name: displayName,
        source: "IMPORTED",
        importedFrom: "Legacy CampaignOutreach",
        status: "SENT",
        sentAt: maxSent,
      },
    });
    campaignCount++;

    for (const [contactId, sentAt] of byContact) {
      const recipient = await prisma.campaignRecipient.create({
        data: {
          campaignId: campaign.id,
          contactId,
          status: "SENT",
          sentAt,
        },
      });
      recipientCount++;
      await prisma.campaignEngagement.create({
        data: {
          recipientId: recipient.id,
          type: "OPENED",
        },
      });
    }
  }

  console.log(
    `Migrated ${groups.size} groups into ${campaignCount} campaigns with ${recipientCount} recipients`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

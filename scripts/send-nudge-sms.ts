/**
 * Send a nudge digest via SMS (Twilio) for a partner.
 *
 * Usage:
 *   npx tsx scripts/send-nudge-sms.ts [partner-email]
 *
 * Defaults to the first partner (Ava Patel) if no email is provided.
 *
 * Prerequisites:
 *   1. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env
 *   2. Set NUDGE_SMS_TO in .env (recipient override for testing)
 *   3. Database must be seeded (npx prisma db seed)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import twilio from "twilio";

// ── Setup ───────────────────────────────────────────────────────────

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  console.error(
    "\n❌  TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are not set in .env\n" +
      "   Get credentials at https://console.twilio.com and add them:\n\n" +
      '   TWILIO_ACCOUNT_SID="AC..."\n' +
      '   TWILIO_AUTH_TOKEN="..."\n'
  );
  process.exit(1);
}

if (!process.env.TWILIO_PHONE_NUMBER) {
  console.error(
    "\n❌  TWILIO_PHONE_NUMBER is not set in .env\n" +
      "   Add your Twilio phone number:\n\n" +
      '   TWILIO_PHONE_NUMBER="+1234567890"\n'
  );
  process.exit(1);
}

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const recipient = process.env.NUDGE_SMS_TO ?? "";
if (!recipient) {
  console.error(
    "\n❌  NUDGE_SMS_TO is not set in .env\n" +
      "   Add the phone number you want to receive nudges at:\n\n" +
      '   NUDGE_SMS_TO="+14019350993"\n'
  );
  process.exit(1);
}

const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

// ── Helpers ─────────────────────────────────────────────────────────

const PRIORITY_EMOJI: Record<string, string> = {
  URGENT: "🔴",
  HIGH: "🟠",
  MEDIUM: "🔵",
  LOW: "⚪",
};

const RULE_LABEL: Record<string, string> = {
  STALE_CONTACT: "Reconnect",
  JOB_CHANGE: "Role Change",
  COMPANY_NEWS: "Company News",
  UPCOMING_EVENT: "Event",
  MEETING_PREP: "Meeting Prep",
  EVENT_ATTENDED: "Event Follow-Up",
  EVENT_REGISTERED: "Event Outreach",
  ARTICLE_READ: "Content",
  LINKEDIN_ACTIVITY: "LinkedIn",
};

const MAX_NUDGES_PER_SMS = 5;

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const partnerEmail = process.argv[2] || "ava.patel@firm.com";

  console.log(`\n🔍  Looking up partner: ${partnerEmail}`);
  const partner = await prisma.partner.findUnique({
    where: { email: partnerEmail },
  });
  if (!partner) {
    console.error(`   Partner not found. Available partners:`);
    const all = await prisma.partner.findMany();
    all.forEach((p) => console.error(`     - ${p.email} (${p.name})`));
    process.exit(1);
  }
  console.log(`   Found: ${partner.name}`);

  console.log("\n⚡  Generating nudges...");
  const { differenceInDays } = await import("date-fns");
  const now = new Date();

  const contacts = await prisma.contact.findMany({
    where: { partnerId: partner.id },
    include: { company: true },
  });

  type NudgeCandidate = {
    contactId: string;
    signalId?: string;
    ruleType: string;
    reason: string;
    priority: string;
  };
  const candidates: NudgeCandidate[] = [];

  for (const contact of contacts) {
    const interactions = await prisma.interaction.findMany({
      where: { contactId: contact.id },
      orderBy: { date: "desc" },
    });
    const signals = await prisma.externalSignal.findMany({
      where: {
        OR: [{ contactId: contact.id }, { companyId: contact.companyId }],
      },
      orderBy: { date: "desc" },
    });
    const meetings = await prisma.meeting.findMany({
      where: {
        partnerId: partner.id,
        attendees: { some: { contactId: contact.id } },
      },
      orderBy: { startTime: "asc" },
    });

    const lastInteraction = interactions[0];
    const daysSince = lastInteraction
      ? differenceInDays(now, new Date(lastInteraction.date))
      : 999;

    if (daysSince > 90) {
      candidates.push({
        contactId: contact.id,
        ruleType: "STALE_CONTACT",
        reason: `No interaction with ${contact.name} in ${daysSince} days.`,
        priority: contact.importance === "CRITICAL" ? "URGENT" : "HIGH",
      });
    } else if (daysSince > 60) {
      candidates.push({
        contactId: contact.id,
        ruleType: "STALE_CONTACT",
        reason: `${daysSince} days since last interaction with ${contact.name}.`,
        priority:
          contact.importance === "CRITICAL" || contact.importance === "HIGH"
            ? "HIGH"
            : "MEDIUM",
      });
    } else if (
      daysSince > 30 &&
      (contact.importance === "CRITICAL" || contact.importance === "HIGH")
    ) {
      candidates.push({
        contactId: contact.id,
        ruleType: "STALE_CONTACT",
        reason: `${daysSince} days since last touchpoint with ${contact.name}.`,
        priority: "MEDIUM",
      });
    }

    const recentJobChange = signals.find(
      (s) =>
        s.type === "JOB_CHANGE" && differenceInDays(now, new Date(s.date)) < 30
    );
    if (recentJobChange) {
      candidates.push({
        contactId: contact.id,
        signalId: recentJobChange.id,
        ruleType: "JOB_CHANGE",
        reason: `${contact.name} had a role change — reconnect and congratulate.`,
        priority: "HIGH",
      });
    }

    const recentNews = signals.find(
      (s) => s.type === "NEWS" && differenceInDays(now, new Date(s.date)) < 14
    );
    if (recentNews) {
      candidates.push({
        contactId: contact.id,
        signalId: recentNews.id,
        ruleType: "COMPANY_NEWS",
        reason: `${contact.company.name} in the news — reach out to ${contact.name}.`,
        priority: "MEDIUM",
      });
    }

    const upcomingEvent = signals.find(
      (s) =>
        s.type === "EVENT" &&
        differenceInDays(new Date(s.date), now) >= 0 &&
        differenceInDays(new Date(s.date), now) < 21
    );
    if (upcomingEvent) {
      candidates.push({
        contactId: contact.id,
        signalId: upcomingEvent.id,
        ruleType: "UPCOMING_EVENT",
        reason: `Upcoming event — connect with ${contact.name} beforehand.`,
        priority: "MEDIUM",
      });
    }

    const upcomingMeeting = meetings.find((m) => {
      const daysUntil = differenceInDays(new Date(m.startTime), now);
      return daysUntil >= 0 && daysUntil <= 3;
    });
    if (upcomingMeeting) {
      candidates.push({
        contactId: contact.id,
        ruleType: "MEETING_PREP",
        reason: `"${upcomingMeeting.title}" with ${contact.name} coming up soon.`,
        priority: "HIGH",
      });
    }
  }

  console.log(`   Found ${candidates.length} nudges`);
  if (candidates.length === 0) {
    console.log("   Nothing to send. Try re-seeding the database.");
    process.exit(0);
  }

  // Sort by priority
  const order: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  candidates.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));

  // Build SMS body
  const firstName = partner.name.split(" ")[0];
  const displayed = candidates.slice(0, MAX_NUDGES_PER_SMS);
  const remaining = candidates.length - displayed.length;

  const lines: string[] = [
    `Hi ${firstName}, you have ${candidates.length} nudge${candidates.length !== 1 ? "s" : ""} today:`,
    "",
  ];

  for (const n of displayed) {
    const dot = PRIORITY_EMOJI[n.priority] ?? "⚪";
    const tag = RULE_LABEL[n.ruleType] ?? "Nudge";
    const reason = n.reason.length > 80 ? n.reason.slice(0, 77) + "..." : n.reason;
    lines.push(`${dot} ${tag}`);
    lines.push(`   ${reason}`);
  }

  if (remaining > 0) {
    lines.push("");
    lines.push(`+ ${remaining} more`);
  }

  lines.push("");
  lines.push(`Open Activate: ${appUrl}/nudges`);

  const body = lines.join("\n");

  console.log(`\n📱  Sending SMS to ${recipient}...`);
  console.log(`   From: ${fromNumber}`);
  console.log(`   Nudges: ${candidates.length}`);
  console.log(`\n--- SMS Preview ---`);
  console.log(body);
  console.log(`--- End Preview ---\n`);

  const message = await twilioClient.messages.create({
    body,
    from: fromNumber,
    to: recipient,
  });

  console.log(`✅  SMS sent successfully!`);
  console.log(`   Twilio SID: ${message.sid}`);
  console.log(`   Status: ${message.status}`);
  console.log(`   Sent to: ${recipient}\n`);
}

main()
  .catch((e) => {
    console.error("\n❌  Failed to send SMS:", e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Send a nudge digest email for a partner.
 *
 * Usage:
 *   npx tsx scripts/send-nudge-email.ts [partner-email]
 *
 * Defaults to the first partner (Ava Patel) if no email is provided.
 *
 * Prerequisites:
 *   1. Set RESEND_API_KEY in .env
 *   2. Set NUDGE_EMAIL_TO in .env (recipient override) or it sends to the partner email
 *   3. Database must be seeded (npx prisma db seed)
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Resend } from "resend";

// ── Setup ───────────────────────────────────────────────────────────

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

if (!process.env.RESEND_API_KEY) {
  console.error(
    "\n❌  RESEND_API_KEY is not set in .env\n" +
      "   Get a free key at https://resend.com and add it:\n\n" +
      '   RESEND_API_KEY="re_your_key_here"\n'
  );
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const recipient: string = process.env.NUDGE_EMAIL_TO ?? "";
if (!recipient) {
  console.error(
    "\n❌  NUDGE_EMAIL_TO is not set in .env\n" +
      "   Add the email address you want to receive nudges at:\n\n" +
      '   NUDGE_EMAIL_TO="you@example.com"\n'
  );
  process.exit(1);
}

const fromAddress =
  process.env.RESEND_FROM || "Chirp <onboarding@resend.dev>";
const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

// ── Helpers ─────────────────────────────────────────────────────────

function priorityColor(p: string) {
  return p === "URGENT"
    ? "#ef4444"
    : p === "HIGH"
      ? "#f59e0b"
      : p === "MEDIUM"
        ? "#64748b"
        : "#94a3b8";
}

function ruleIcon(r: string) {
  return r === "STALE_CONTACT"
    ? "⏰"
    : r === "JOB_CHANGE"
      ? "🎉"
      : r === "COMPANY_NEWS"
        ? "📰"
        : r === "UPCOMING_EVENT"
          ? "📅"
          : r === "MEETING_PREP"
            ? "📋"
            : "💡";
}

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

  // Generate nudges (same logic as the nudge engine)
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
        reason: `No interaction with ${contact.name} (${contact.title} at ${contact.company.name}) in ${daysSince} days. High-value relationship may be cooling.`,
        priority: contact.importance === "CRITICAL" ? "URGENT" : "HIGH",
      });
    } else if (daysSince > 60) {
      candidates.push({
        contactId: contact.id,
        ruleType: "STALE_CONTACT",
        reason: `It's been ${daysSince} days since your last interaction with ${contact.name} at ${contact.company.name}. Consider a check-in.`,
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
        reason: `${daysSince} days since last touchpoint with ${contact.name} (${contact.importance} priority). Time for a proactive outreach.`,
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
        reason: `${contact.name} had a recent role change: "${recentJobChange.content}". Great opportunity to reconnect and congratulate.`,
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
        reason: `${contact.company.name} in the news: "${recentNews.content}". Reach out to ${contact.name} with a relevant point of view.`,
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
        reason: `${upcomingEvent.content}. Opportunity to connect with ${contact.name} around this event.`,
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
        reason: `Meeting "${upcomingMeeting.title}" coming up soon with ${contact.name}. Prepare your brief and talking points.`,
        priority: "HIGH",
      });
    }
  }

  console.log(`   Found ${candidates.length} nudges`);
  if (candidates.length === 0) {
    console.log("   Nothing to send. Try re-seeding the database.");
    process.exit(0);
  }

  // Build full nudge objects for the email template
  const nudgesForEmail = [];
  for (const c of candidates) {
    const contact = await prisma.contact.findUnique({
      where: { id: c.contactId },
      include: { company: true },
    });
    const signal = c.signalId
      ? await prisma.externalSignal.findUnique({ where: { id: c.signalId } })
      : null;
    if (contact) {
      nudgesForEmail.push({
        id: `gen-${nudgesForEmail.length}`,
        contactId: c.contactId,
        signalId: c.signalId || null,
        ruleType: c.ruleType,
        reason: c.reason,
        priority: c.priority,
        status: "OPEN",
        generatedEmail: null,
        createdAt: new Date(),
        contact: { ...contact, company: contact.company },
        signal,
      });
    }
  }

  // Sort by priority
  const order: Record<string, number> = {
    URGENT: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  nudgesForEmail.sort(
    (a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3)
  );

  // Build email HTML
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const urgentCount = nudgesForEmail.filter(
    (n) => n.priority === "URGENT"
  ).length;
  const highCount = nudgesForEmail.filter((n) => n.priority === "HIGH").length;
  const mediumCount = nudgesForEmail.filter(
    (n) => n.priority === "MEDIUM" || n.priority === "LOW"
  ).length;

  const nudgeRows = nudgesForEmail
    .map((n) => {
      const pColor = priorityColor(n.priority);
      const icon = ruleIcon(n.ruleType);
      const contactUrl = `${appUrl}/contacts/${n.contact.id}`;
      return `
    <tr>
      <td style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="vertical-align: top; width: 44px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: #eff6ff; color: #2563eb; font-size: 18px; line-height: 40px; text-align: center;">
                ${icon}
              </div>
            </td>
            <td style="vertical-align: top; padding-left: 14px;">
              <div style="margin-bottom: 4px;">
                <a href="${contactUrl}" style="font-weight: 600; font-size: 15px; color: #0f172a; text-decoration: none;">
                  ${n.contact.name}
                </a>
                <span style="display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; color: white; background: ${pColor}; margin-left: 8px;">
                  ${n.priority}
                </span>
              </div>
              <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
                ${n.contact.title} at ${n.contact.company.name}
              </div>
              <div style="font-size: 14px; color: #334155; line-height: 1.5;">
                ${n.reason}
              </div>
              ${n.signal ? `<div style="margin-top: 6px; font-size: 12px; color: #94a3b8;">Signal: ${n.signal.type} — ${n.signal.content.slice(0, 120)}${n.signal.content.length > 120 ? "…" : ""}</div>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chirp — Nudge Digest</title>
</head>
<body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="background: #0f172a; border-radius: 12px 12px 0 0; padding: 32px 24px; text-align: center;">
              <div style="display: inline-block; width: 44px; height: 44px; border-radius: 10px; background: #2563eb; color: white; font-weight: 700; font-size: 22px; line-height: 44px; text-align: center; margin-bottom: 12px;">
                🐦
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                Your Nudge Digest
              </h1>
              <p style="margin: 6px 0 0; color: #94a3b8; font-size: 14px;">
                ${today}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #ffffff; padding: 24px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">
                Hi ${partner.name.split(" ")[0]}, you have <strong>${nudgesForEmail.length} open nudge${nudgesForEmail.length !== 1 ? "s" : ""}</strong> to review today.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  ${urgentCount > 0 ? `<td style="text-align: center; padding: 12px 8px; background: #fef2f2; border-radius: 8px;"><div style="font-size: 24px; font-weight: 700; color: #ef4444;">${urgentCount}</div><div style="font-size: 11px; color: #ef4444; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Urgent</div></td>` : ""}
                  <td style="text-align: center; padding: 12px 8px; background: #fffbeb; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${highCount}</div>
                    <div style="font-size: 11px; color: #f59e0b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">High</div>
                  </td>
                  <td style="text-align: center; padding: 12px 8px; background: #f1f5f9; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #64748b;">${mediumCount}</div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Medium / Low</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${nudgeRows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #ffffff; padding: 24px; text-align: center; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <a href="${appUrl}/nudges" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                View All Nudges in Chirp
              </a>
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; border-radius: 0 0 12px 12px; padding: 20px 24px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                This is an automated digest from Chirp.<br />
                All company names, contacts, and data shown are entirely fictional and for demonstration purposes only.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Send
  const subject =
    urgentCount > 0
      ? `🔴 ${urgentCount} urgent + ${nudgesForEmail.length - urgentCount} more nudges — Chirp`
      : `${nudgesForEmail.length} nudge${nudgesForEmail.length !== 1 ? "s" : ""} to review — Chirp`;

  console.log(`\n📧  Sending digest to ${recipient}...`);
  console.log(`   Subject: ${subject}`);
  console.log(`   From: ${fromAddress}`);
  console.log(`   Nudges: ${nudgesForEmail.length}`);

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: recipient,
    subject,
    html,
  });

  if (error) {
    console.error("\n❌  Failed to send:", error);
    process.exit(1);
  }

  console.log(`\n✅  Email sent successfully!`);
  console.log(`   Resend ID: ${data?.id}`);
  console.log(`   Check your inbox at ${recipient}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

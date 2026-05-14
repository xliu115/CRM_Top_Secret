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
import {
  buildSummaryFragments,
  type InsightData,
} from "../src/lib/utils/nudge-summary";

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
  process.env.RESEND_FROM || "ClientIQ <onboarding@resend.dev>";
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
    insights: InsightData[];
  };
  const candidates: NudgeCandidate[] = [];
  const MAX_NUDGES = 5;

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
      const insight: InsightData = {
        type: "STALE_CONTACT",
        reason: `No interaction in ${daysSince} days`,
        priority: contact.importance === "CRITICAL" ? "URGENT" : "HIGH",
      };
      candidates.push({
        contactId: contact.id,
        ruleType: "STALE_CONTACT",
        reason: `No interaction with ${contact.name} (${contact.title} at ${contact.company.name}) in ${daysSince} days. High-value relationship may be cooling.`,
        priority: contact.importance === "CRITICAL" ? "URGENT" : "HIGH",
        insights: [insight],
      });
    } else if (daysSince > 60) {
      const insight: InsightData = {
        type: "STALE_CONTACT",
        reason: `No interaction in ${daysSince} days`,
        priority:
          contact.importance === "CRITICAL" || contact.importance === "HIGH"
            ? "HIGH"
            : "MEDIUM",
      };

      candidates.push({
        contactId: contact.id,
        ruleType: "STALE_CONTACT",
        reason: `It's been ${daysSince} days since your last interaction with ${contact.name} at ${contact.company.name}. Consider a check-in.`,
        priority: insight.priority,
        insights: [insight],
      });
    } else if (
      daysSince > 30 &&
      (contact.importance === "CRITICAL" || contact.importance === "HIGH")
    ) {
      const insight: InsightData = {
        type: "STALE_CONTACT",
        reason: `No interaction in ${daysSince} days`,
        priority: "MEDIUM",
      };

      candidates.push({
        contactId: contact.id,
        ruleType: "STALE_CONTACT",
        reason: `${daysSince} days since last touchpoint with ${contact.name} (${contact.importance} priority). Time for a proactive outreach.`,
        priority: "MEDIUM",
        insights: [insight],
      });
    }

    const recentJobChange = signals.find(
      (s) =>
        s.type === "JOB_CHANGE" && differenceInDays(now, new Date(s.date)) < 30
    );
    if (recentJobChange) {
      const insight: InsightData = {
        type: "JOB_CHANGE",
        reason: `${contact.name} had a recent role change: "${recentJobChange.content}"`,
        priority: "HIGH",
        signalId: recentJobChange.id,
        signalContent: recentJobChange.content,
      };

      candidates.push({
        contactId: contact.id,
        signalId: recentJobChange.id,
        ruleType: "JOB_CHANGE",
        reason: `${contact.name} had a recent role change: "${recentJobChange.content}". Great opportunity to reconnect and congratulate.`,
        priority: "HIGH",
        insights: [insight],
      });
    }

    const recentNews = signals.find(
      (s) => s.type === "NEWS" && differenceInDays(now, new Date(s.date)) < 14
    );
    if (recentNews) {
      const insight: InsightData = {
        type: "COMPANY_NEWS",
        reason: `${contact.company.name} in the news: "${recentNews.content}"`,
        priority: "MEDIUM",
        signalId: recentNews.id,
        signalContent: recentNews.content,
        signalUrl: recentNews.url,
      };

      candidates.push({
        contactId: contact.id,
        signalId: recentNews.id,
        ruleType: "COMPANY_NEWS",
        reason: `${contact.company.name} in the news: "${recentNews.content}". Reach out to ${contact.name} with a relevant point of view.`,
        priority: "MEDIUM",
        insights: [insight],
      });
    }

    const upcomingEvent = signals.find(
      (s) =>
        s.type === "EVENT" &&
        differenceInDays(new Date(s.date), now) >= 0 &&
        differenceInDays(new Date(s.date), now) < 21
    );
    if (upcomingEvent) {
      const insight: InsightData = {
        type: "UPCOMING_EVENT",
        reason: upcomingEvent.content,
        priority: "MEDIUM",
        signalId: upcomingEvent.id,
        signalContent: upcomingEvent.content,
      };

      candidates.push({
        contactId: contact.id,
        signalId: upcomingEvent.id,
        ruleType: "UPCOMING_EVENT",
        reason: `${upcomingEvent.content}. Opportunity to connect with ${contact.name} around this event.`,
        priority: "MEDIUM",
        insights: [insight],
      });
    }

    const upcomingMeeting = meetings.find((m) => {
      const daysUntil = differenceInDays(new Date(m.startTime), now);
      return daysUntil >= 0 && daysUntil <= 3;
    });
    if (upcomingMeeting) {
      const insight: InsightData = {
        type: "MEETING_PREP",
        reason: `Meeting "${upcomingMeeting.title}" coming up soon`,
        priority: "HIGH",
      };

      candidates.push({
        contactId: contact.id,
        ruleType: "MEETING_PREP",
        reason: `Meeting "${upcomingMeeting.title}" coming up soon with ${contact.name}. Prepare your brief and talking points.`,
        priority: "HIGH",
        insights: [insight],
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
        metadata: null,
        createdAt: new Date(),
        contact: { ...contact, company: contact.company },
        signal,
        insights: c.insights,
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
  const displayed = nudgesForEmail.slice(0, MAX_NUDGES);
  const remaining = nudgesForEmail.length - displayed.length;

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

  function buildAiSummaryHtml(
    nudge: (typeof displayed)[number]
  ): string {
    const fragments = buildSummaryFragments(
      { ruleType: nudge.ruleType, reason: nudge.reason, contact: nudge.contact },
      nudge.insights
    );
    return fragments
      .map((f) =>
        f.bold
          ? `<strong style="color: #051C2C;">${f.text}</strong>`
          : f.text
      )
      .join("");
  }

  const RULE_LABELS: Record<string, string> = {
    STALE_CONTACT: "Reconnect",
    JOB_CHANGE: "Executive Transition",
    COMPANY_NEWS: "Company News",
    UPCOMING_EVENT: "Upcoming Event",
    MEETING_PREP: "Meeting Prep",
  };

  const RULE_CTAS: Record<string, string> = {
    STALE_CONTACT: "Draft Check-in",
    JOB_CHANGE: "Draft Congratulations",
    COMPANY_NEWS: "Draft News Email",
    UPCOMING_EVENT: "Draft Pre-Event Email",
    MEETING_PREP: "Prepare Brief",
  };

  const nudgeRows = displayed
    .map((n, i) => {
      const pColor = priorityColor(n.priority);
      const icon = ruleIcon(n.ruleType);
      const typeLabel = RULE_LABELS[n.ruleType] ?? "Nudge";
      const ctaLabel = RULE_CTAS[n.ruleType] ?? "Take Action";
      const isLast = i === displayed.length - 1 && remaining === 0;
      const borderBottom = isLast ? "" : "border-bottom: 1px solid #E0E0E0;";
      const summaryHtml = buildAiSummaryHtml(n);
      return `
    <tr>
      <td style="padding: 20px 28px; ${borderBottom}">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="vertical-align: top; width: 44px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: #eff6ff; color: #2563eb; font-size: 18px; line-height: 40px; text-align: center;">
                ${icon}
              </div>
            </td>
            <td style="vertical-align: top; padding-left: 14px;">
              <div style="margin-bottom: 4px;">
                <span style="font-weight: 600; font-size: 15px; color: #051C2C;">${n.contact.name}</span>
                <span style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; color: white; background: ${pColor}; margin-left: 8px; vertical-align: middle; text-transform: uppercase; letter-spacing: 0.3px;">${n.priority}</span>
              </div>
              <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
                ${n.contact.title} at ${n.contact.company.name} &middot; ${typeLabel}
              </div>
              <div style="background: #F5F5F5; border-radius: 4px; padding: 12px 14px; margin-bottom: 12px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #2251FF; margin-bottom: 6px;">&#10024; AI Summary</div>
                <div style="font-size: 13px; color: #2D2D2D; line-height: 1.55;">${summaryHtml}</div>
              </div>
              <a href="${appUrl}/nudges" style="display: inline-block; padding: 7px 20px; background: #2251FF; color: #ffffff; font-size: 12px; font-weight: 600; text-decoration: none; border-radius: 3px; letter-spacing: 0.2px;">${ctaLabel}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
    })
    .join("");

  const overflowRow = remaining > 0
    ? `<tr>
        <td style="padding: 20px 28px; text-align: center;">
          <a href="${appUrl}/nudges" style="font-size: 14px; color: #2251FF; text-decoration: none; font-weight: 600;">
            View ${remaining} more nudge${remaining !== 1 ? "s" : ""} &rarr;
          </a>
        </td>
      </tr>`
    : "";

  const summaryParts: string[] = [];
  if (urgentCount > 0) summaryParts.push(`<strong style="color: #dc2626;">${urgentCount} urgent</strong>`);
  if (highCount > 0) summaryParts.push(`<strong style="color: #d97706;">${highCount} high-priority</strong>`);
  const summaryText = summaryParts.length > 0 ? `, including ${summaryParts.join(" and ")}` : "";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ClientIQ — Nudge Digest</title>
</head>
<body style="margin: 0; padding: 0; background: #F5F5F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: #F5F5F5;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: #051C2C; padding: 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <div style="font-size: 14px; font-weight: 600; color: #2251FF; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">ClientIQ</div>
                    <div style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; font-family: Georgia, 'Times New Roman', serif;">
                      Your Daily Nudge Digest
                    </div>
                    <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">${today}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="background: #ffffff; padding: 24px 28px; border-bottom: 1px solid #E0E0E0;">
              <div style="font-size: 15px; color: #2D2D2D; line-height: 1.6;">
                Hi ${partner.name.split(" ")[0]}, you have <strong style="color: #051C2C;">${nudgesForEmail.length} action item${nudgesForEmail.length !== 1 ? "s" : ""}</strong> today${summaryText}.
              </div>
            </td>
          </tr>

          <!-- Nudge List -->
          <tr>
            <td style="background: #ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${nudgeRows}
                ${overflowRow}
              </table>
            </td>
          </tr>

          <!-- Footer CTA -->
          <tr>
            <td style="background: #ffffff; padding: 24px 28px; text-align: center; border-top: 1px solid #E0E0E0;">
              <a href="${appUrl}/nudges" style="display: inline-block; padding: 12px 32px; background: #051C2C; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 3px; letter-spacing: -0.1px;">
                Open ClientIQ
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                Automated digest from ClientIQ &middot;
                <a href="${appUrl}/nudges/settings" style="color: #0070AD; text-decoration: none;">Manage preferences</a>
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
      ? `${urgentCount} urgent + ${nudgesForEmail.length - urgentCount} more — ClientIQ`
      : `${nudgesForEmail.length} nudge${nudgesForEmail.length !== 1 ? "s" : ""} to review — ClientIQ`;

  console.log(`\n📧  Sending digest to ${recipient}...`);
  console.log(`   Subject: ${subject}`);
  console.log(`   From: ${fromAddress}`);
  console.log(`   Nudges: ${nudgesForEmail.length} total, ${displayed.length} in email${remaining > 0 ? ` (${remaining} overflow)` : ""}`);

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

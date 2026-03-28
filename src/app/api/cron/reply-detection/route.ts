import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { differenceInDays } from "date-fns";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const fromHeader = request.headers.get("x-cron-secret");
  if (fromHeader === secret) return true;

  const fromQuery = request.nextUrl.searchParams.get("secret");
  return fromQuery === secret;
}

/**
 * Scans for inbound emails from priority contacts that haven't been replied to
 * and creates REPLY_NEEDED nudges if they don't already exist.
 *
 * This runs alongside the nudge engine refresh — the nudge engine already checks
 * for REPLY_NEEDED in its refresh cycle, but this cron ensures detection happens
 * even between refresh cycles.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const replyWindowDays = 7;

    const unrepliedInbound = await prisma.interaction.findMany({
      where: {
        direction: "INBOUND",
        type: "EMAIL",
        repliedAt: null,
        date: {
          gte: new Date(now.getTime() - replyWindowDays * 24 * 60 * 60 * 1000),
          lte: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        contact: {
          include: { company: true },
        },
      },
    });

    const priorityContacts = unrepliedInbound.filter(
      (i) =>
        i.contact.importance === "CRITICAL" || i.contact.importance === "HIGH"
    );

    const existingReplyNudges = await prisma.nudge.findMany({
      where: {
        ruleType: "REPLY_NEEDED",
        status: "OPEN",
        contactId: { in: priorityContacts.map((i) => i.contactId) },
      },
      select: { contactId: true },
    });
    const alreadyNudged = new Set(existingReplyNudges.map((n) => n.contactId));

    const contactsNeedingNudge = new Map<
      string,
      (typeof priorityContacts)[number]
    >();
    for (const interaction of priorityContacts) {
      if (alreadyNudged.has(interaction.contactId)) continue;
      if (!contactsNeedingNudge.has(interaction.contactId)) {
        contactsNeedingNudge.set(interaction.contactId, interaction);
      }
    }

    let created = 0;
    for (const [, interaction] of contactsNeedingNudge) {
      const daysSince = differenceInDays(now, new Date(interaction.date));
      await prisma.nudge.create({
        data: {
          contactId: interaction.contactId,
          ruleType: "REPLY_NEEDED",
          reason: `${interaction.contact.name} emailed you ${daysSince} day${daysSince !== 1 ? "s" : ""} ago — draft a reply?`,
          priority:
            interaction.contact.importance === "CRITICAL" ? "URGENT" : "HIGH",
          status: "OPEN",
        },
      });
      created++;
    }

    console.log(
      `[cron/reply-detection] Found ${priorityContacts.length} unreplied inbound, created ${created} nudges`
    );

    return NextResponse.json({
      scanned: unrepliedInbound.length,
      priorityContacts: priorityContacts.length,
      nudgesCreated: created,
    });
  } catch (err) {
    console.error("[cron/reply-detection] Fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

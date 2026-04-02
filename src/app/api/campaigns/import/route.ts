import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { campaignRepo } from "@/lib/repositories";

export async function POST(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    let body: {
      name?: string;
      importedFrom?: string;
      recipients?: {
        email: string;
        status?: string;
        engagements?: { type: string; timestamp?: string }[];
      }[];
      contentItemIds?: string[];
    } = {};

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const rows = Array.isArray(body.recipients) ? body.recipients : [];
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "recipients must be a non-empty array" },
        { status: 400 }
      );
    }

    const campaign = await campaignRepo.create({
      partnerId,
      name,
      source: "IMPORTED",
    });

    if (body.importedFrom) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { importedFrom: body.importedFrom },
      });
    }

    if (Array.isArray(body.contentItemIds) && body.contentItemIds.length > 0) {
      await campaignRepo.addContent(campaign.id, body.contentItemIds);
    }

    const uniqueEmails = [...new Set(rows.map((r) => r.email.trim()))];

    const contacts = await prisma.contact.findMany({
      where: {
        partnerId,
        email: { in: uniqueEmails },
      },
    });

    const byEmail = new Map(
      contacts.map((c) => [c.email.toLowerCase(), c] as const)
    );

    for (const row of rows) {
      const emailKey = row.email.trim().toLowerCase();
      const contact = byEmail.get(emailKey);

      const recipient = await prisma.campaignRecipient.create({
        data: {
          campaignId: campaign.id,
          contactId: contact?.id ?? null,
          unmatchedEmail: contact ? null : row.email.trim(),
          status: row.status ?? "PENDING",
        },
      });

      const engagements = Array.isArray(row.engagements)
        ? row.engagements
        : [];
      for (const eng of engagements) {
        const ts = eng.timestamp
          ? new Date(eng.timestamp)
          : new Date();
        if (Number.isNaN(ts.getTime())) continue;

        await prisma.campaignEngagement.create({
          data: {
            recipientId: recipient.id,
            type: eng.type,
            timestamp: ts,
          },
        });
      }
    }

    const detail = await campaignRepo.findById(campaign.id, partnerId);
    return NextResponse.json(detail ?? campaign, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

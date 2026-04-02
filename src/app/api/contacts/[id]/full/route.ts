import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  interactionRepo,
  signalRepo,
  nudgeRepo,
  meetingRepo,
  engagementRepo,
} from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import type { ContactWithCompany } from "@/lib/repositories/interfaces/contact-repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const contactRow = await prisma.contact.findFirst({
      where: { id, partnerId },
      include: {
        company: true,
        campaignRecipients: {
          where: { campaign: { partnerId } },
          include: {
            campaign: {
              select: { id: true, name: true, status: true, sentAt: true },
            },
            engagements: true,
          },
          orderBy: { campaign: { sentAt: "desc" } },
        },
      },
    });
    if (!contactRow) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const rows = await prisma.$queryRawUnsafe<
      Array<{ disabled_nudge_types: string | null }>
    >(
      `SELECT disabled_nudge_types FROM contacts WHERE id = ? AND partner_id = ? LIMIT 1`,
      id,
      partnerId
    );
    const contact = JSON.parse(JSON.stringify(contactRow)) as ContactWithCompany & {
      campaignRecipients: typeof contactRow.campaignRecipients;
    };
    contact.disabledNudgeTypes = rows[0]?.disabled_nudge_types ?? null;

    const campaignRecipients = contact.campaignRecipients;

    const [
      interactions,
      contactSignals,
      companySignals,
      engagements,
      meetings,
      nudges,
    ] = await Promise.all([
      interactionRepo.findByContactId(id),
      signalRepo.findByContactId(id),
      signalRepo.findByCompanyId(contact.companyId),
      Promise.all([
        engagementRepo.findEventsByContactId(id),
        engagementRepo.findArticlesByContactId(id),
        engagementRepo.findCampaignsByContactId(id),
      ]),
      meetingRepo.findByContactId(id),
      nudgeRepo.findByContactId(id),
    ]);

    const signals = [
      ...new Map(
        [...contactSignals, ...companySignals].map((s) => [s.id, s])
      ).values(),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const openNudges = nudges.filter((n) => n.status === "OPEN");

    return NextResponse.json({
      contact,
      interactions,
      signals,
      engagements: {
        events: engagements[0],
        articles: engagements[1],
        campaigns: engagements[2],
      },
      meetings,
      nudges: openNudges,
      campaignRecipients,
    });
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

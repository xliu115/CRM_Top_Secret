import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  contactRepo,
  interactionRepo,
  signalRepo,
  meetingRepo,
  engagementRepo,
} from "@/lib/repositories";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const contact = await contactRepo.findById(id, partnerId);
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const [interactions, contactSignals, companySignals, engagements, meetings] =
      await Promise.all([
        interactionRepo.findByContactId(id),
        signalRepo.findByContactId(id),
        signalRepo.findByCompanyId(contact.companyId),
        Promise.all([
          engagementRepo.findEventsByContactId(id),
          engagementRepo.findArticlesByContactId(id),
          engagementRepo.findCampaignsByContactId(id),
        ]),
        meetingRepo.findByContactId(id),
      ]);

    const signals = [...contactSignals, ...companySignals].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

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

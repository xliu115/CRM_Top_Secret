import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  meetingRepo,
  interactionRepo,
  signalRepo,
  partnerRepo,
} from "@/lib/repositories";
import { generateMeetingBrief } from "@/lib/services/llm-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const meeting = await meetingRepo.findById(id, partnerId);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const partner = await partnerRepo.findById(partnerId);
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const attendeeIds = meeting.attendees.map((a) => a.contactId);

    const [interactionsByContact, signalsByContact] = await Promise.all([
      interactionRepo.findByContactIds(attendeeIds),
      signalRepo.findByContactIds(attendeeIds),
    ]);

    const attendees = meeting.attendees.map((a) => {
      const contact = a.contact;
      const interactions = interactionsByContact
        .filter((i) => i.contactId === contact.id)
        .slice(0, 3)
        .map(
          (i) =>
            `${i.type} (${i.date.toISOString().split("T")[0]}): ${i.summary}`
        );
      const signals = signalsByContact
        .filter((s) => s.contactId === contact.id)
        .slice(0, 3)
        .map((s) => `${s.type}: ${s.content}`);

      return {
        name: contact.name,
        title: contact.title,
        company: contact.company.name,
        recentInteractions: interactions,
        signals,
      };
    });

    const brief = await generateMeetingBrief({
      meetingTitle: meeting.title,
      meetingPurpose: meeting.purpose || "",
      attendees,
    });

    await meetingRepo.updateBrief(id, brief);

    return NextResponse.json({ brief });
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

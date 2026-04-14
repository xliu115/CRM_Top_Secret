import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  meetingRepo,
  interactionRepo,
  signalRepo,
  partnerRepo,
} from "@/lib/repositories";
import { generateMeetingBrief } from "@/lib/services/llm-service";
import { formatDateForLLM } from "@/lib/utils/format-date";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;
    const force = request.nextUrl.searchParams.get("force") === "true";

    const [meeting, partner] = await Promise.all([
      meetingRepo.findById(id, partnerId),
      partnerRepo.findById(partnerId),
    ]);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    if (!force && meeting.generatedBrief) {
      return NextResponse.json({ brief: meeting.generatedBrief, cached: true });
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
            `${i.type} (${formatDateForLLM(i.date)}): ${i.summary}`
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

    try {
      await meetingRepo.updateBrief(id, brief);
    } catch (persistErr) {
      console.warn("[meetings/brief] Could not persist brief, returning generated brief only:", persistErr);
    }

    return NextResponse.json({ brief });
  } catch (err) {
    console.error("[meetings/brief] Failed to generate brief:", err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

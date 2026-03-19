import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { prisma } from "@/lib/db/prisma";
import { generateMeetingBrief } from "@/lib/services/llm-service";
import { interactionRepo } from "@/lib/repositories";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const nudge = await prisma.nudge.findFirst({
      where: { id, contact: { partnerId }, ruleType: "MEETING_PREP" },
      include: {
        contact: { include: { company: true } },
      },
    });

    if (!nudge) {
      return NextResponse.json({ error: "Nudge not found" }, { status: 404 });
    }

    const titleMatch = nudge.reason.match(/Meeting "([^"]+)"/);
    const meetingTitle = titleMatch?.[1] ?? "Upcoming Meeting";

    const meeting = await prisma.meeting.findFirst({
      where: { partnerId, title: meetingTitle },
      include: {
        attendees: {
          include: {
            contact: { include: { company: true } },
          },
        },
      },
      orderBy: { startTime: "desc" },
    });

    const attendeeContacts = meeting
      ? meeting.attendees.map((a) => a.contact)
      : [nudge.contact];

    const attendees = await Promise.all(
      attendeeContacts.map(async (contact) => {
        const interactions = await interactionRepo.findByContactId(contact.id);
        const recentInteractions = interactions.slice(0, 5).map(
          (i) => `${i.type} on ${new Date(i.date).toLocaleDateString()}: ${i.summary}`
        );

        const signals = await prisma.externalSignal.findMany({
          where: {
            OR: [
              { contactId: contact.id },
              { companyId: contact.companyId },
            ],
          },
          orderBy: { date: "desc" },
          take: 5,
        });

        return {
          name: contact.name,
          title: contact.title,
          company: contact.company.name,
          recentInteractions,
          signals: signals.map((s) => `${s.type}: ${s.content.slice(0, 150)}`),
        };
      })
    );

    const brief = await generateMeetingBrief({
      meetingTitle,
      meetingPurpose: meeting?.purpose ?? `Relationship meeting with ${nudge.contact.name} at ${nudge.contact.company.name}`,
      attendees,
    });

    if (meeting) {
      try {
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { generatedBrief: brief },
        });
      } catch {
        // Cache write is best-effort
      }
    }

    return NextResponse.json({
      meetingTitle,
      meetingTime: meeting?.startTime ?? null,
      attendeeCount: attendees.length,
      brief,
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

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { prisma } from "@/lib/db/prisma";
import { generateEmail } from "@/lib/services/llm-service";
import { interactionRepo } from "@/lib/repositories";

const RULE_TYPE_CONTEXT: Record<string, string> = {
  STALE_CONTACT: "This is a check-in email to reconnect with a contact you haven't spoken to in a while.",
  JOB_CHANGE: "This is a congratulations email for a contact who recently changed roles or got promoted.",
  COMPANY_NEWS: "This is an outreach email referencing recent company news as a conversation starter.",
  UPCOMING_EVENT: "This is a pre-event email to connect before an upcoming event.",
  MEETING_PREP: "This is a pre-meeting email to confirm or prepare for an upcoming meeting.",
  EVENT_ATTENDED: "This is a follow-up email after a contact attended an event.",
  EVENT_REGISTERED: "This is an outreach email to connect before an event the contact is registered for.",
  ARTICLE_READ: "This is a follow-up email referencing content the contact recently engaged with.",
  LINKEDIN_ACTIVITY: "This is an outreach email inspired by the contact's recent LinkedIn activity.",
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const nudge = await prisma.nudge.findFirst({
      where: { id, contact: { partnerId } },
      include: {
        contact: { include: { company: true, partner: true } },
        signal: true,
      },
    });

    if (!nudge) {
      return NextResponse.json({ error: "Nudge not found" }, { status: 404 });
    }

    const interactions = await interactionRepo.findByContactId(nudge.contactId);
    const recentInteractions = interactions.slice(0, 5).map(
      (i) => `${i.type} on ${new Date(i.date).toLocaleDateString()}: ${i.summary}`
    );

    const signals: string[] = [];
    if (nudge.signal) {
      signals.push(`${nudge.signal.type}: ${nudge.signal.content}`);
    }

    const typeContext = RULE_TYPE_CONTEXT[nudge.ruleType] ?? "";
    const nudgeReason = `${typeContext}\n\nSpecific context: ${nudge.reason}`;

    const draft = await generateEmail({
      partnerName: nudge.contact.partner.name,
      contactName: nudge.contact.name,
      contactTitle: nudge.contact.title,
      companyName: nudge.contact.company.name,
      nudgeReason,
      recentInteractions,
      signals,
    });

    try {
      await prisma.nudge.update({
        where: { id },
        data: { generatedEmail: JSON.stringify(draft) },
      });
    } catch {
      // Cache write is best-effort; don't fail the request
    }

    return NextResponse.json(draft);
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

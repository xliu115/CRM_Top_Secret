import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  contactRepo,
  interactionRepo,
  signalRepo,
  nudgeRepo,
  meetingRepo,
  engagementRepo,
  sequenceRepo,
  partnerRepo,
} from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { searchWeb } from "@/lib/services/rag-service";
import {
  generateContact360,
  type Contact360Context,
} from "@/lib/services/llm-contact360";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const [contact, partner] = await Promise.all([
      contactRepo.findById(id, partnerId),
      partnerRepo.findById(partnerId),
    ]);
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const company = contact.company;

    const [
      interactionsResult,
      contactSignalsResult,
      companySignalsResult,
      engagementsResult,
      meetingsResult,
      nudgesResult,
      sequencesResult,
      firmResult,
      webBgResult,
      webNewsResult,
    ] = await Promise.allSettled([
      interactionRepo.findByContactId(id),
      signalRepo.findByContactId(id),
      signalRepo.findByCompanyId(contact.companyId),
      Promise.all([
        engagementRepo.findEventsByContactId(id),
        engagementRepo.findArticlesByContactId(id),
      ]),
      meetingRepo.findByContactId(id),
      nudgeRepo.findByContactId(id),
      sequenceRepo.findByPartnerId(partnerId, { status: "ACTIVE" }),
      prisma.contact.findMany({
        where: { name: contact.name, companyId: contact.companyId },
        include: {
          partner: true,
          interactions: { orderBy: { date: "desc" }, take: 1 },
        },
      }),
      searchWeb(
        `${contact.name} ${contact.title} ${company.name} background education career`,
        5
      ),
      searchWeb(`${contact.name} ${company.name} latest news`, 3),
    ]);

    const interactions = settled(interactionsResult, []);
    const contactSignals = settled(contactSignalsResult, []);
    const companySignals = settled(companySignalsResult, []);
    const engagements = settled(engagementsResult, [[], []]);
    const meetings = settled(meetingsResult, []);
    const nudges = settled(nudgesResult, []);
    const allSequences = settled(sequencesResult, []);
    const firmContacts = settled(firmResult, []);
    const webBg = settled(webBgResult, []);
    const webNews = settled(webNewsResult, []);

    const signals = [
      ...new Map(
        [...contactSignals, ...companySignals].map((s) => [s.id, s])
      ).values(),
    ].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const openNudges = nudges.filter((n) => n.status === "OPEN");
    const contactSequences = allSequences.filter(
      (s) => s.contactId === id
    );

    const now = new Date();
    const firmRelationships = firmContacts.map((rc) => {
      const count = rc.interactions?.length ?? 0;
      const last = rc.interactions?.[0];
      const daysSince = last
        ? Math.floor(
            (now.getTime() - new Date(last.date).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      let intensity = "Light";
      if (count >= 10 && daysSince !== null && daysSince <= 30)
        intensity = "Very High";
      else if (count >= 4 && daysSince !== null && daysSince <= 60)
        intensity = "High";
      else if (count >= 2) intensity = "Medium";

      return {
        partnerName: rc.partner?.name ?? "Unknown",
        isCurrentUser: rc.partnerId === partnerId,
        interactionCount: count,
        intensity,
        lastInteractionDate: last?.date?.toISOString() ?? null,
        contactsAtCompany: 0,
      };
    });

    const ctx: Contact360Context = {
      partnerName: partner?.name ?? undefined,
      contact: {
        name: contact.name,
        title: contact.title ?? "",
        email: contact.email ?? "",
        importance: contact.importance ?? "MEDIUM",
        notes: contact.notes,
      },
      company: {
        name: company.name,
        industry: company.industry ?? "",
        employeeCount: company.employeeCount ?? 0,
        website: company.website ?? "",
      },
      interactions: interactions.slice(0, 15).map((i) => ({
        type: i.type,
        date: new Date(i.date).toISOString(),
        summary: i.summary ?? "",
        sentiment: i.sentiment ?? "NEUTRAL",
        direction: (i as Record<string, unknown>).direction as
          | string
          | undefined,
      })),
      signals: signals.map((s) => ({
        type: s.type,
        date: new Date(s.date).toISOString(),
        content: s.content,
        url: s.url ?? null,
      })),
      meetings: meetings.map((m) => ({
        title: m.title,
        date: new Date(m.startTime).toISOString(),
        attendees: (m.attendees ?? []).map(
          (a: { contact?: { name?: string } }) => a.contact?.name ?? "Unknown"
        ),
        purpose: m.purpose ?? null,
        briefExcerpt: m.generatedBrief?.slice(0, 200) ?? null,
      })),
      nudges: openNudges.map((n) => ({
        ruleType: n.ruleType,
        reason: n.reason,
        priority: n.priority,
      })),
      sequences: contactSequences.map((s) => ({
        status: s.status,
        currentStep: s.currentStep,
        totalSteps: s.totalSteps,
        angleStrategy: s.angleStrategy ?? null,
      })),
      firmRelationships,
      webBackground: webBg
        .filter((d) => d.type !== "Web Summary")
        .map((d) => ({
          title: d.type,
          content: d.content,
          url: d.url ?? "",
        })),
      webNews: webNews
        .filter((d) => d.type !== "Web Summary")
        .map((d) => ({
          title: d.type,
          content: d.content,
          url: d.url ?? "",
        })),
      engagements: [
        ...(engagements[0] ?? []).map((e) => ({
          type: "Event",
          name: (e as Record<string, unknown>).name as string ?? "Event",
          date: new Date(
            (e as Record<string, unknown>).eventDate as string
          ).toISOString(),
        })),
        ...(engagements[1] ?? []).map((e) => ({
          type: "Article",
          name: (e as Record<string, unknown>).name as string ?? "Article",
          date: new Date(
            (e as Record<string, unknown>).createdAt as string
          ).toISOString(),
        })),
      ],
    };

    const result = await generateContact360(ctx);

    return NextResponse.json({
      contact: {
        id: contact.id,
        name: contact.name,
        title: contact.title,
        company: company.name,
        importance: contact.importance,
      },
      result,
    });
  } catch (err) {
    console.error("[contact360] Error:", err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

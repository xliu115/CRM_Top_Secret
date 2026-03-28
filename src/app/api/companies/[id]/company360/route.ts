import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { prisma } from "@/lib/db/prisma";
import { searchWeb } from "@/lib/services/rag-service";
import {
  generateCompany360,
  type Company360Context,
  type Company360ContactSummary,
  type Company360PartnerCoverage,
} from "@/lib/services/llm-company360";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const company = await prisma.company.findFirst({
      where: { id, contacts: { some: { partnerId } } },
    });
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    const [
      contactsResult,
      signalsResult,
      meetingsResult,
      sequencesResult,
      webNewsResult,
    ] = await Promise.allSettled([
      prisma.contact.findMany({
        where: { companyId: id },
        include: {
          partner: true,
          interactions: { orderBy: { date: "desc" } },
          nudges: { where: { status: "OPEN" } },
        },
      }),
      prisma.externalSignal.findMany({
        where: { companyId: id },
        orderBy: { date: "desc" },
        take: 20,
      }),
      prisma.meeting.findMany({
        where: {
          attendees: { some: { contact: { companyId: id } } },
        },
        include: { attendees: { include: { contact: true } } },
        orderBy: { startTime: "desc" },
        take: 10,
      }),
      prisma.outreachSequence.findMany({
        where: {
          status: "ACTIVE",
          contact: { companyId: id },
        },
        include: { contact: true },
      }),
      searchWeb(
        `${company.name} ${company.industry ?? ""} latest news market`,
        5
      ),
    ]);

    const allContacts = settled(contactsResult, []);
    const signals = settled(signalsResult, []);
    const meetings = settled(meetingsResult, []);
    const sequences = settled(sequencesResult, []);
    const webNews = settled(webNewsResult, []);

    const contacts: Company360ContactSummary[] = allContacts.map((c) => {
      const lastInteraction = c.interactions[0] ?? null;
      const lastSentiment = lastInteraction?.sentiment ?? null;
      return {
        name: c.name,
        title: c.title ?? "",
        importance: c.importance ?? "MEDIUM",
        interactionCount: c.interactions.length,
        lastInteractionDate: lastInteraction?.date?.toISOString() ?? null,
        sentiment: lastSentiment,
        openNudges: c.nudges?.length ?? 0,
      };
    });

    const partnerMap = new Map<
      string,
      { name: string; contacts: number; interactions: number; lastDate: Date | null }
    >();
    for (const c of allContacts) {
      const pid = c.partnerId;
      const existing = partnerMap.get(pid) ?? {
        name: c.partner?.name ?? "Unknown",
        contacts: 0,
        interactions: 0,
        lastDate: null as Date | null,
      };
      existing.contacts++;
      existing.interactions += c.interactions.length;
      const last = c.interactions[0]?.date ?? null;
      if (last && (!existing.lastDate || last > existing.lastDate)) {
        existing.lastDate = last;
      }
      partnerMap.set(pid, existing);
    }

    const partners: Company360PartnerCoverage[] = Array.from(
      partnerMap.entries()
    ).map(([pid, data]) => ({
      partnerName: data.name,
      isCurrentUser: pid === partnerId,
      contactCount: data.contacts,
      totalInteractions: data.interactions,
      lastInteractionDate: data.lastDate?.toISOString() ?? null,
    }));

    const ctx: Company360Context = {
      company: {
        name: company.name,
        industry: company.industry ?? "",
        description: company.description ?? "",
        employeeCount: company.employeeCount ?? 0,
        website: company.website ?? "",
      },
      contacts,
      partners,
      signals: signals.map((s) => ({
        type: s.type,
        date: new Date(s.date).toISOString(),
        content: s.content,
        url: s.url ?? null,
      })),
      meetings: meetings.map((m) => ({
        title: m.title,
        date: new Date(m.startTime).toISOString(),
        attendees: (m.attendees ?? []).map((a: { contact?: { name?: string } }) => a.contact?.name ?? "Unknown"),
        contactName:
          (m.attendees as { contact?: { name?: string } }[])?.[0]?.contact?.name ?? "Unknown",
      })),
      sequences: sequences.map((s) => ({
        contactName: s.contact?.name ?? "Unknown",
        status: s.status,
        currentStep: s.currentStep,
        totalSteps: s.totalSteps,
      })),
      webNews: webNews
        .filter((d) => d.type !== "Web Summary")
        .map((d) => ({
          title: d.type,
          content: d.content,
          url: d.url ?? "",
        })),
    };

    const result = await generateCompany360(ctx);

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        industry: company.industry,
      },
      result,
    });
  } catch (err) {
    console.error("[company360] Error:", err);
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

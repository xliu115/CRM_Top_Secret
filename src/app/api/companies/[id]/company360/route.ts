import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { prisma } from "@/lib/db/prisma";
import { differenceInDays } from "date-fns";
import {
  generateCompany360,
  computeIntensity,
  type Company360Context,
  type Company360ContactSummary,
  type Company360PartnerCoverage,
  type FirmCoverageData,
  type HealthMatrixEntry,
} from "@/lib/services/llm-company360";
import { getCachedCompanyBrief, refreshCompanyBrief } from "@/lib/services/llm-company-brief";

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
      companyBriefResult,
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
      getCachedCompanyBrief(id),
    ]);

    const allContacts = settled(contactsResult, []);
    const signals = settled(signalsResult, []);
    const meetings = settled(meetingsResult, []);
    const sequences = settled(sequencesResult, []);
    let companyBrief = settled(companyBriefResult, null);

    // Auto-generate Company Brief if no cached version exists
    if (!companyBrief) {
      try {
        companyBrief = await refreshCompanyBrief(
          id,
          company.name,
          company.industry ?? "",
        );
      } catch (err) {
        console.error("[company360] Auto-generate Company Brief failed:", err);
      }
    }

    const now = new Date();

    // Build contact summaries for LLM context
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

    // Build partner coverage map
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

    // Structured firm coverage
    const firmCoverage: FirmCoverageData = {
      totalPartners: partners.length,
      totalContacts: allContacts.length,
      partners,
    };

    // Structured health matrix
    const healthMatrix: HealthMatrixEntry[] = allContacts.map((c) => {
      const lastInteraction = c.interactions[0] ?? null;
      const lastDate = lastInteraction?.date ?? null;
      const daysSince = lastDate ? differenceInDays(now, new Date(lastDate)) : null;
      const { level, score } = computeIntensity(c.interactions.length, daysSince);
      return {
        name: c.name,
        title: c.title ?? "",
        importance: c.importance ?? "MEDIUM",
        interactionCount: c.interactions.length,
        lastInteractionDate: lastDate?.toISOString() ?? null,
        daysSinceLastInteraction: daysSince,
        intensity: level,
        intensityScore: score,
        sentiment: lastInteraction?.sentiment ?? null,
        openNudges: c.nudges?.length ?? 0,
        contactId: c.id,
      };
    });

    // Sort: CRITICAL first, then by staleness
    const importanceOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    healthMatrix.sort((a, b) => {
      const ia = importanceOrder[a.importance] ?? 9;
      const ib = importanceOrder[b.importance] ?? 9;
      if (ia !== ib) return ia - ib;
      const da = a.daysSinceLastInteraction ?? 9999;
      const db = b.daysSinceLastInteraction ?? 9999;
      return db - da;
    });

    // Build LLM context (overview, signals, recommendations only)
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
      webNews: [],
    };

    const result = await generateCompany360(ctx);

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        industry: company.industry,
      },
      result: {
        ...result,
        firmCoverage,
        healthMatrix,
        companyBrief,
      },
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

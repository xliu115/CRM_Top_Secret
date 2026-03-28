import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  companyRepo,
  interactionRepo,
  signalRepo,
  nudgeRepo,
  meetingRepo,
  engagementRepo,
} from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { differenceInDays } from "date-fns";

type IntensityLevel = "Very High" | "High" | "Medium" | "Light";

function computeIntensity(
  interactionCount: number,
  daysSinceLastInteraction: number | null
): { level: IntensityLevel; score: number } {
  if (daysSinceLastInteraction === null) return { level: "Light", score: 0 };
  let recencyScore = 0;
  if (daysSinceLastInteraction <= 14) recencyScore = 40;
  else if (daysSinceLastInteraction <= 30) recencyScore = 30;
  else if (daysSinceLastInteraction <= 60) recencyScore = 20;
  else if (daysSinceLastInteraction <= 90) recencyScore = 10;
  let frequencyScore = 0;
  if (interactionCount >= 10) frequencyScore = 60;
  else if (interactionCount >= 7) frequencyScore = 45;
  else if (interactionCount >= 4) frequencyScore = 30;
  else if (interactionCount >= 2) frequencyScore = 15;
  else if (interactionCount >= 1) frequencyScore = 5;
  const score = recencyScore + frequencyScore;
  let level: IntensityLevel;
  if (score >= 70) level = "Very High";
  else if (score >= 45) level = "High";
  else if (score >= 20) level = "Medium";
  else level = "Light";
  return { level, score };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const company = await companyRepo.findById(id, partnerId);
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    const myContacts = company.contacts.filter(
      (ct) => ct.partnerId === partnerId
    );
    const contactIds = myContacts.map((ct) => ct.id);

    const [
      allInteractions,
      companySignals,
      contactSignals,
      nudges,
      meetings,
      engagements,
      openNudgeCounts,
      otherPartnersAtCompany,
    ] = await Promise.all([
      interactionRepo.findByContactIds(contactIds),
      signalRepo.findByCompanyId(id),
      signalRepo.findByContactIds(contactIds),
      Promise.all(contactIds.map((cid) => nudgeRepo.findByContactId(cid))),
      Promise.all(contactIds.map((cid) => meetingRepo.findByContactId(cid))),
      Promise.all(
        contactIds.map(async (cid) => {
          const [events, articles, campaigns] = await Promise.all([
            engagementRepo.findEventsByContactId(cid),
            engagementRepo.findArticlesByContactId(cid),
            engagementRepo.findCampaignsByContactId(cid),
          ]);
          return { contactId: cid, events, articles, campaigns };
        })
      ),
      prisma.nudge.groupBy({
        by: ["contactId"],
        where: { contactId: { in: contactIds }, status: "OPEN" },
        _count: { id: true },
      }),
      prisma.contact.findMany({
        where: { companyId: id, partnerId: { not: partnerId } },
        select: { companyId: true, partner: { select: { name: true } } },
        distinct: ["companyId", "partnerId"],
      }),
    ]);

    const signals = [
      ...new Map(
        [...companySignals, ...contactSignals].map((s) => [s.id, s])
      ).values(),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const allNudges = nudges.flat().filter((n) => n.status === "OPEN");

    const meetingMap = new Map<string, (typeof meetings)[0][0]>();
    for (const contactMeetings of meetings) {
      for (const m of contactMeetings) {
        meetingMap.set(m.id, m);
      }
    }
    const allMeetings = Array.from(meetingMap.values()).sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    const allEvents = engagements.flatMap((e) => e.events);
    const allArticles = engagements.flatMap((e) => e.articles);
    const allCampaigns = engagements.flatMap((e) => e.campaigns);

    const sortedInteractions = [...allInteractions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const latestInteraction = new Map<
      string,
      { date: Date; type: string; summary: string }
    >();
    for (const i of sortedInteractions) {
      if (!latestInteraction.has(i.contactId)) {
        latestInteraction.set(i.contactId, {
          date: new Date(i.date),
          type: i.type,
          summary: i.summary,
        });
      }
    }

    const nudgeCountMap = new Map<string, number>();
    for (const n of openNudgeCounts) {
      nudgeCountMap.set(n.contactId, n._count.id);
    }

    const otherPartners = otherPartnersAtCompany.map((r) => r.partner.name);

    const now = new Date();

    const contactSummaries = myContacts.map((ct) => {
      const last = latestInteraction.get(ct.id);
      return {
        id: ct.id,
        name: ct.name,
        title: ct.title,
        email: ct.email,
        importance: ct.importance,
        lastContacted: ct.lastContacted,
        daysSinceLastInteraction: last
          ? differenceInDays(now, last.date)
          : null,
        lastInteraction: last
          ? {
              type: last.type,
              summary: last.summary,
              date: last.date.toISOString(),
            }
          : null,
        openNudgeCount: nudgeCountMap.get(ct.id) ?? 0,
        otherPartners,
      };
    });

    // Firm relationships: all contacts at this company across all partners
    const allContactsAtCompany = await prisma.contact.findMany({
      where: { companyId: id },
      include: {
        partner: { select: { id: true, name: true, email: true } },
        interactions: { orderBy: { date: "desc" } },
      },
    });

    const partnerContactCounts = await prisma.contact.groupBy({
      by: ["partnerId"],
      where: {
        companyId: id,
        partnerId: {
          in: [...new Set(allContactsAtCompany.map((c) => c.partnerId))],
        },
      },
      _count: { id: true },
    });
    const countMap = new Map(
      partnerContactCounts.map((pc) => [pc.partnerId, pc._count.id])
    );

    const firmRelationships = allContactsAtCompany.map((rc) => {
      const interactionCount = rc.interactions.length;
      const lastInteraction = rc.interactions[0] ?? null;
      const daysSince = lastInteraction
        ? Math.floor(
            (now.getTime() - new Date(lastInteraction.date).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;
      const { level, score } = computeIntensity(interactionCount, daysSince);
      return {
        partnerId: rc.partnerId,
        partnerName: rc.partner.name,
        partnerEmail: rc.partner.email,
        contactId: rc.id,
        contactName: rc.name,
        contactTitle: rc.title,
        isCurrentUser: rc.partnerId === partnerId,
        interactionCount,
        lastInteractionDate: lastInteraction?.date ?? null,
        lastInteractionType: lastInteraction?.type ?? null,
        lastInteractionSummary: lastInteraction?.summary ?? null,
        daysSinceLastInteraction: daysSince,
        intensity: level,
        intensityScore: score,
        contactsAtCompany: countMap.get(rc.partnerId) ?? 0,
      };
    });

    firmRelationships.sort((a, b) => {
      if (a.isCurrentUser && !b.isCurrentUser) return -1;
      if (!a.isCurrentUser && b.isCurrentUser) return 1;
      return b.intensityScore - a.intensityScore;
    });

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        industry: company.industry,
        description: company.description,
        employeeCount: company.employeeCount,
        website: company.website,
      },
      contacts: contactSummaries,
      interactions: sortedInteractions,
      signals,
      meetings: allMeetings,
      nudges: allNudges,
      engagements: {
        events: allEvents,
        articles: allArticles,
        campaigns: allCampaigns,
      },
      firmRelationships: {
        companyName: company.name,
        totalPartners: new Set(firmRelationships.map((r) => r.partnerId)).size,
        totalContacts: allContactsAtCompany.length,
        relationships: firmRelationships,
      },
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

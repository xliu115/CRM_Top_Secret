import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { contactRepo, interactionRepo } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { differenceInDays } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const importance = searchParams.get("importance");
    const companyFilter = searchParams.get("company");
    const titleFilter = searchParams.get("title");

    const searchQuery = q?.trim();
    let contacts = searchQuery
      ? await contactRepo.search(searchQuery, partnerId)
      : await contactRepo.findByPartnerId(partnerId);

    if (importance) {
      contacts = contacts.filter((c) => c.importance === importance.toUpperCase());
    }

    if (companyFilter) {
      const lower = companyFilter.toLowerCase();
      contacts = contacts.filter(
        (c) => c.company?.name?.toLowerCase() === lower
      );
    }

    if (titleFilter) {
      const lower = titleFilter.toLowerCase();
      contacts = contacts.filter(
        (c) => c.title?.toLowerCase().includes(lower)
      );
    }

    if (contacts.length === 0) return NextResponse.json([]);

    const contactIds = contacts.map((c) => c.id);

    const companyIds = [...new Set(contacts.map((c) => c.companyId))];

    const [allInteractions, openNudges, otherPartnersAtCompanies] = await Promise.all([
      interactionRepo.findByContactIds(contactIds),
      prisma.nudge.groupBy({
        by: ["contactId"],
        where: { contactId: { in: contactIds }, status: "OPEN" },
        _count: { id: true },
      }),
      prisma.contact.findMany({
        where: { companyId: { in: companyIds }, partnerId: { not: partnerId } },
        select: { companyId: true, partner: { select: { name: true } } },
        distinct: ["companyId", "partnerId"],
      }),
    ]);

    const latestInteraction = new Map<string, { date: Date; type: string; summary: string }>();
    for (const i of allInteractions) {
      if (!latestInteraction.has(i.contactId)) {
        latestInteraction.set(i.contactId, { date: new Date(i.date), type: i.type, summary: i.summary });
      }
    }

    const nudgeCountMap = new Map<string, number>();
    for (const n of openNudges) {
      nudgeCountMap.set(n.contactId, n._count.id);
    }

    const otherPartnersByCompany = new Map<string, string[]>();
    for (const row of otherPartnersAtCompanies) {
      const arr = otherPartnersByCompany.get(row.companyId);
      if (arr) arr.push(row.partner.name);
      else otherPartnersByCompany.set(row.companyId, [row.partner.name]);
    }

    const now = new Date();

    const enriched = contacts.map((c) => {
      const last = latestInteraction.get(c.id);
      return {
        ...c,
        companyId: c.companyId,
        daysSinceLastInteraction: last ? differenceInDays(now, last.date) : null,
        lastInteraction: last ? { type: last.type, summary: last.summary, date: last.date.toISOString() } : null,
        openNudgeCount: nudgeCountMap.get(c.id) ?? 0,
        otherPartners: otherPartnersByCompany.get(c.companyId) ?? [],
      };
    });

    return NextResponse.json(enriched);
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

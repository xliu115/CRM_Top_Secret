import { NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { companyRepo, interactionRepo, signalRepo } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { differenceInDays } from "date-fns";

export async function GET() {
  try {
    const partnerId = await requirePartnerId();

    const companies = await companyRepo.findByPartnerId(partnerId);

    if (companies.length === 0) return NextResponse.json([]);

    const partnerContactIds = companies.flatMap((c) =>
      c.contacts.filter((ct) => ct.partnerId === partnerId).map((ct) => ct.id)
    );

    const [allInteractions, openNudgeCounts, signalCounts] = await Promise.all([
      interactionRepo.findByContactIds(partnerContactIds),
      prisma.nudge.groupBy({
        by: ["contactId"],
        where: { contactId: { in: partnerContactIds }, status: "OPEN" },
        _count: { id: true },
      }),
      signalRepo.findByContactIds(partnerContactIds),
    ]);

    const latestInteractionByContact = new Map<string, Date>();
    for (const i of allInteractions) {
      const existing = latestInteractionByContact.get(i.contactId);
      const d = new Date(i.date);
      if (!existing || d > existing) {
        latestInteractionByContact.set(i.contactId, d);
      }
    }

    const nudgeCountByContact = new Map<string, number>();
    for (const n of openNudgeCounts) {
      nudgeCountByContact.set(n.contactId, n._count.id);
    }

    const signalCountByCompany = new Map<string, number>();
    for (const s of signalCounts) {
      const companyId = s.companyId ?? null;
      if (!companyId) continue;
      signalCountByCompany.set(
        companyId,
        (signalCountByCompany.get(companyId) ?? 0) + 1
      );
    }

    const now = new Date();

    const enriched = companies.map((company) => {
      const myContacts = company.contacts.filter(
        (ct) => ct.partnerId === partnerId
      );
      const contactCount = myContacts.length;

      let totalNudges = 0;
      let latestInteractionDate: Date | null = null;
      for (const ct of myContacts) {
        totalNudges += nudgeCountByContact.get(ct.id) ?? 0;
        const d = latestInteractionByContact.get(ct.id);
        if (d && (!latestInteractionDate || d > latestInteractionDate)) {
          latestInteractionDate = d;
        }
      }

      return {
        id: company.id,
        name: company.name,
        industry: company.industry,
        description: company.description,
        employeeCount: company.employeeCount,
        website: company.website,
        contactCount,
        openNudgeCount: totalNudges,
        signalCount: signalCountByCompany.get(company.id) ?? 0,
        daysSinceLastInteraction: latestInteractionDate
          ? differenceInDays(now, latestInteractionDate)
          : null,
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

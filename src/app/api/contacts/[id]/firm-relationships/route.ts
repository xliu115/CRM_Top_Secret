import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { prisma } from "@/lib/db/prisma";

type IntensityLevel = "Very High" | "High" | "Medium" | "Light";

function computeIntensity(
  interactionCount: number,
  daysSinceLastInteraction: number | null
): { level: IntensityLevel; score: number } {
  if (daysSinceLastInteraction === null) {
    return { level: "Light", score: 0 };
  }

  // Score combines recency and frequency
  // Recency: 0-14 days = 40pts, 15-30 = 30pts, 31-60 = 20pts, 61-90 = 10pts, 90+ = 0
  let recencyScore = 0;
  if (daysSinceLastInteraction <= 14) recencyScore = 40;
  else if (daysSinceLastInteraction <= 30) recencyScore = 30;
  else if (daysSinceLastInteraction <= 60) recencyScore = 20;
  else if (daysSinceLastInteraction <= 90) recencyScore = 10;

  // Frequency: 10+ = 60pts, 7-9 = 45pts, 4-6 = 30pts, 2-3 = 15pts, 1 = 5pts
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
    const currentPartnerId = await requirePartnerId();
    const { id } = await params;

    const contact = await prisma.contact.findFirst({
      where: { id, partnerId: currentPartnerId },
      include: { company: true },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Find all contacts with the same name at the same company, across all partners
    const relatedContacts = await prisma.contact.findMany({
      where: {
        name: contact.name,
        companyId: contact.companyId,
      },
      include: {
        partner: true,
        interactions: {
          orderBy: { date: "desc" },
        },
      },
    });

    const now = new Date();

    const relationships = relatedContacts.map((rc) => {
      const interactionCount = rc.interactions.length;
      const lastInteraction = rc.interactions[0] ?? null;
      const daysSinceLastInteraction = lastInteraction
        ? Math.floor(
            (now.getTime() - new Date(lastInteraction.date).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      const { level, score } = computeIntensity(
        interactionCount,
        daysSinceLastInteraction
      );

      return {
        partnerId: rc.partnerId,
        partnerName: rc.partner.name,
        partnerEmail: rc.partner.email,
        contactId: rc.id,
        isCurrentUser: rc.partnerId === currentPartnerId,
        interactionCount,
        lastInteractionDate: lastInteraction?.date ?? null,
        lastInteractionType: lastInteraction?.type ?? null,
        lastInteractionSummary: lastInteraction?.summary ?? null,
        daysSinceLastInteraction,
        intensity: level,
        intensityScore: score,
        contactsAtCompany: 0, // filled below
      };
    });

    // Count how many contacts each partner has at this company
    const partnerContactCounts = await prisma.contact.groupBy({
      by: ["partnerId"],
      where: {
        companyId: contact.companyId,
        partnerId: { in: relationships.map((r) => r.partnerId) },
      },
      _count: { id: true },
    });

    const countMap = new Map(
      partnerContactCounts.map((pc) => [pc.partnerId, pc._count.id])
    );

    for (const r of relationships) {
      r.contactsAtCompany = countMap.get(r.partnerId) ?? 0;
    }

    // Sort by intensity score descending, current user first
    relationships.sort((a, b) => {
      if (a.isCurrentUser && !b.isCurrentUser) return -1;
      if (!a.isCurrentUser && b.isCurrentUser) return 1;
      return b.intensityScore - a.intensityScore;
    });

    return NextResponse.json({
      contactName: contact.name,
      companyName: contact.company.name,
      totalPartners: relationships.length,
      relationships,
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

import { prisma } from "@/lib/db/prisma";
import type {
  ContactWithCompany,
  IContactRepository,
} from "../interfaces/contact-repository";

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function fuzzyNameScore(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  if (n === q || n.includes(q)) return 0;
  const qParts = q.split(/\s+/);
  const nParts = n.split(/\s+/);
  let totalDist = 0;
  for (const qp of qParts) {
    let best = qp.length;
    for (const np of nParts) best = Math.min(best, levenshtein(qp, np));
    totalDist += best;
  }
  return totalDist;
}

export class PrismaContactRepository implements IContactRepository {
  async findByPartnerId(partnerId: string) {
    return prisma.contact.findMany({
      where: { partnerId },
      include: { company: true },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string, partnerId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, partnerId },
      include: { company: true },
    });
    if (!contact) return null;
    const rows = await prisma.$queryRawUnsafe<Array<{ disabled_nudge_types: string | null }>>(
      `SELECT disabled_nudge_types FROM contacts WHERE id = ? AND partner_id = ? LIMIT 1`,
      id,
      partnerId
    );
    const plain = JSON.parse(JSON.stringify(contact)) as ContactWithCompany;
    plain.disabledNudgeTypes = rows[0]?.disabled_nudge_types ?? null;
    return plain;
  }

  async search(query: string, partnerId: string) {
    const exact = await prisma.contact.findMany({
      where: {
        partnerId,
        OR: [
          { name: { contains: query } },
          { email: { contains: query } },
          { title: { contains: query } },
          { company: { name: { contains: query } } },
        ],
      },
      include: { company: true },
      orderBy: { name: "asc" },
    });
    if (exact.length > 0) return exact;

    const threshold = Math.max(2, Math.floor(query.length * 0.4));
    const all = await prisma.contact.findMany({
      where: { partnerId },
      include: { company: true },
    });
    const scored = all
      .map((c) => ({ contact: c, dist: fuzzyNameScore(query, c.name) }))
      .filter((s) => s.dist <= threshold)
      .sort((a, b) => a.dist - b.dist);
    return scored.map((s) => s.contact);
  }

  async countByPartnerId(partnerId: string) {
    return prisma.contact.count({ where: { partnerId } });
  }

  async findInteractedInLastYearByPartnerId(partnerId: string, since: Date) {
    return prisma.contact.findMany({
      where: {
        partnerId,
        interactions: { some: { date: { gte: since } } },
      },
      include: { company: true },
    });
  }

  async updateStaleThreshold(id: string, partnerId: string, days: number | null) {
    const contact = await prisma.contact.findFirst({ where: { id, partnerId } });
    if (!contact) throw new Error("Contact not found");
    return prisma.contact.update({
      where: { id },
      data: { staleThresholdDays: days },
      include: { company: true },
    });
  }
}

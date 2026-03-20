import { prisma } from "@/lib/db/prisma";
import type {
  ContactWithCompany,
  IContactRepository,
} from "../interfaces/contact-repository";

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
    return prisma.contact.findMany({
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

import { prisma } from "@/lib/db/prisma";
import type { ISignalRepository } from "../interfaces/signal-repository";

export class PrismaSignalRepository implements ISignalRepository {
  async findByContactId(contactId: string) {
    return prisma.externalSignal.findMany({
      where: { contactId },
      orderBy: { date: "desc" },
    });
  }

  async findByCompanyId(companyId: string) {
    return prisma.externalSignal.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
    });
  }

  async findRecentByPartnerId(partnerId: string, limit = 20) {
    return prisma.externalSignal.findMany({
      where: {
        OR: [
          { contact: { partnerId } },
          { company: { contacts: { some: { partnerId } } } },
        ],
      },
      include: {
        contact: { include: { company: { select: { name: true } } } },
        company: true,
      },
      orderBy: { date: "desc" },
      take: limit,
    });
  }

  async findByContactIds(contactIds: string[]) {
    return prisma.externalSignal.findMany({
      where: {
        OR: [
          { contactId: { in: contactIds } },
          {
            companyId: { not: null },
            contact: { id: { in: contactIds } },
          },
        ],
      },
      orderBy: { date: "desc" },
    });
  }

  async searchByContent(query: string, partnerId: string, limit = 20) {
    return prisma.externalSignal.findMany({
      where: {
        OR: [
          {
            content: { contains: query },
            contact: { partnerId },
          },
          {
            content: { contains: query },
            company: { contacts: { some: { partnerId } } },
          },
        ],
      },
      include: {
        contact: { include: { company: { select: { name: true } } } },
        company: true,
      },
      orderBy: { date: "desc" },
      take: limit,
    });
  }
}

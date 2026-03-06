import { prisma } from "@/lib/db/prisma";
import type { IInteractionRepository } from "../interfaces/interaction-repository";

export class PrismaInteractionRepository implements IInteractionRepository {
  async findByContactId(contactId: string) {
    return prisma.interaction.findMany({
      where: { contactId },
      orderBy: { date: "desc" },
    });
  }

  async findRecentByPartnerId(partnerId: string, limit = 20) {
    return prisma.interaction.findMany({
      where: { contact: { partnerId } },
      include: {
        contact: { include: { company: { select: { name: true } } } },
      },
      orderBy: { date: "desc" },
      take: limit,
    });
  }

  async findByContactIds(contactIds: string[]) {
    return prisma.interaction.findMany({
      where: { contactId: { in: contactIds } },
      orderBy: { date: "desc" },
    });
  }

  async searchByContent(query: string, partnerId: string, limit = 20) {
    return prisma.interaction.findMany({
      where: {
        contact: { partnerId },
        OR: [
          { summary: { contains: query } },
          { nextStep: { contains: query } },
        ],
      },
      include: {
        contact: { include: { company: { select: { name: true } } } },
      },
      orderBy: { date: "desc" },
      take: limit,
    });
  }
}

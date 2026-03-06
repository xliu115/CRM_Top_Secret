import { prisma } from "@/lib/db/prisma";
import type { IContactRepository } from "../interfaces/contact-repository";

export class PrismaContactRepository implements IContactRepository {
  async findByPartnerId(partnerId: string) {
    return prisma.contact.findMany({
      where: { partnerId },
      include: { company: true },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string, partnerId: string) {
    return prisma.contact.findFirst({
      where: { id, partnerId },
      include: { company: true },
    });
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
}

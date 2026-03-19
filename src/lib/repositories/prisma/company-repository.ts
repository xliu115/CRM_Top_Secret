import { prisma } from "@/lib/db/prisma";
import type { ICompanyRepository } from "../interfaces/company-repository";

export class PrismaCompanyRepository implements ICompanyRepository {
  async findByPartnerId(partnerId: string) {
    return prisma.company.findMany({
      where: {
        contacts: { some: { partnerId } },
      },
      include: {
        contacts: {
          include: { partner: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string, partnerId: string) {
    return prisma.company.findFirst({
      where: {
        id,
        contacts: { some: { partnerId } },
      },
      include: {
        contacts: {
          include: { partner: { select: { id: true, name: true } } },
        },
      },
    });
  }
}

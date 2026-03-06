import { prisma } from "@/lib/db/prisma";
import type { IPartnerRepository } from "../interfaces/partner-repository";

export class PrismaPartnerRepository implements IPartnerRepository {
  async findById(id: string) {
    return prisma.partner.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return prisma.partner.findUnique({ where: { email } });
  }

  async findAll() {
    return prisma.partner.findMany({ orderBy: { name: "asc" } });
  }
}

import { prisma } from "@/lib/db/prisma";
import type { INudgeRepository } from "../interfaces/nudge-repository";

export class PrismaNudgeRepository implements INudgeRepository {
  async findByPartnerId(
    partnerId: string,
    filters?: { status?: string; priority?: string }
  ) {
    return prisma.nudge.findMany({
      where: {
        contact: { partnerId },
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.priority ? { priority: filters.priority } : {}),
      },
      include: {
        contact: { include: { company: true } },
        signal: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async findByContactId(contactId: string) {
    return prisma.nudge.findMany({
      where: { contactId },
      include: {
        contact: { include: { company: true } },
        signal: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async countOpenByPartnerId(partnerId: string) {
    return prisma.nudge.count({
      where: { contact: { partnerId }, status: "OPEN" },
    });
  }

  async updateStatus(id: string, status: string) {
    return prisma.nudge.update({
      where: { id },
      data: { status },
    });
  }

  async createMany(
    nudges: {
      contactId: string;
      signalId?: string;
      ruleType: string;
      reason: string;
      priority: string;
      metadata?: string;
      sequenceId?: string;
      cadenceStepId?: string;
    }[]
  ) {
    const result = await prisma.nudge.createMany({
      data: nudges.map((n) => ({
        contactId: n.contactId,
        signalId: n.signalId || null,
        ruleType: n.ruleType,
        reason: n.reason,
        priority: n.priority,
        status: "OPEN",
        metadata: n.metadata || null,
        sequenceId: n.sequenceId || null,
        cadenceStepId: n.cadenceStepId || null,
      })),
    });
    return result.count;
  }

  async deleteOpenByPartnerId(partnerId: string) {
    const result = await prisma.nudge.deleteMany({
      where: { contact: { partnerId }, status: "OPEN" },
    });
    return result.count;
  }
}

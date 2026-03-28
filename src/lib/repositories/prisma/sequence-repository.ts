import { prisma } from "@/lib/db/prisma";
import type { ISequenceRepository } from "../interfaces/sequence-repository";

const includeRelations = {
  contact: { include: { company: true } },
  steps: { orderBy: { stepNumber: "asc" as const } },
};

export class PrismaSequenceRepository implements ISequenceRepository {
  async create(data: {
    contactId: string;
    partnerId: string;
    originNudgeId: string;
    angleStrategy: string;
    totalSteps?: number;
  }) {
    return prisma.outreachSequence.create({
      data: {
        contactId: data.contactId,
        partnerId: data.partnerId,
        originNudgeId: data.originNudgeId,
        angleStrategy: data.angleStrategy,
        totalSteps: data.totalSteps ?? 4,
        status: "ACTIVE",
        currentStep: 0,
      },
    });
  }

  async findById(id: string) {
    return prisma.outreachSequence.findUnique({
      where: { id },
      include: includeRelations,
    });
  }

  async findActiveByContactId(contactId: string) {
    return prisma.outreachSequence.findFirst({
      where: { contactId, status: "ACTIVE" },
      include: includeRelations,
    });
  }

  async findByPartnerId(partnerId: string, filters?: { status?: string }) {
    return prisma.outreachSequence.findMany({
      where: {
        partnerId,
        ...(filters?.status ? { status: filters.status } : {}),
      },
      include: includeRelations,
      orderBy: { createdAt: "desc" },
    });
  }

  async findDueForAdvance(before: Date) {
    return prisma.outreachSequence.findMany({
      where: {
        status: "ACTIVE",
        nextStepAt: { lte: before },
      },
      include: includeRelations,
    });
  }

  async updateStatus(id: string, status: string, completedAt?: Date) {
    return prisma.outreachSequence.update({
      where: { id },
      data: {
        status,
        ...(completedAt ? { completedAt } : {}),
      },
    });
  }

  async updateNextStep(id: string, currentStep: number, nextStepAt: Date | null) {
    return prisma.outreachSequence.update({
      where: { id },
      data: { currentStep, nextStepAt },
    });
  }

  async createStep(data: {
    sequenceId: string;
    stepNumber: number;
    type: string;
    scheduledAt: Date;
    emailSubject?: string;
    emailBody?: string;
  }) {
    return prisma.cadenceStep.create({
      data: {
        sequenceId: data.sequenceId,
        stepNumber: data.stepNumber,
        type: data.type,
        status: "PENDING",
        scheduledAt: data.scheduledAt,
        emailSubject: data.emailSubject ?? null,
        emailBody: data.emailBody ?? null,
      },
    });
  }

  async updateStep(
    id: string,
    data: Partial<{
      status: string;
      executedAt: Date;
      emailSubject: string;
      emailBody: string;
      responseDetectedAt: Date;
    }>
  ) {
    return prisma.cadenceStep.update({ where: { id }, data });
  }

  async findStepById(id: string) {
    return prisma.cadenceStep.findUnique({
      where: { id },
      include: { sequence: true },
    });
  }

  async findCurrentStep(sequenceId: string) {
    const seq = await prisma.outreachSequence.findUnique({
      where: { id: sequenceId },
      select: { currentStep: true },
    });
    if (!seq) return null;
    return prisma.cadenceStep.findFirst({
      where: { sequenceId, stepNumber: seq.currentStep },
    });
  }
}

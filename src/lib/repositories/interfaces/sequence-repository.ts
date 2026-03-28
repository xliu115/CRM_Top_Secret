import type {
  OutreachSequence,
  CadenceStep,
  Contact,
  Company,
} from "@prisma/client";

export type SequenceWithRelations = OutreachSequence & {
  contact: Contact & { company: Company };
  steps: CadenceStep[];
};

export type StepWithSequence = CadenceStep & {
  sequence: OutreachSequence;
};

export interface ISequenceRepository {
  create(data: {
    contactId: string;
    partnerId: string;
    originNudgeId: string;
    angleStrategy: string;
    totalSteps?: number;
  }): Promise<OutreachSequence>;

  findById(id: string): Promise<SequenceWithRelations | null>;

  findActiveByContactId(contactId: string): Promise<SequenceWithRelations | null>;

  findByPartnerId(
    partnerId: string,
    filters?: { status?: string }
  ): Promise<SequenceWithRelations[]>;

  findDueForAdvance(before: Date): Promise<SequenceWithRelations[]>;

  updateStatus(id: string, status: string, completedAt?: Date): Promise<OutreachSequence>;

  updateNextStep(
    id: string,
    currentStep: number,
    nextStepAt: Date | null
  ): Promise<OutreachSequence>;

  createStep(data: {
    sequenceId: string;
    stepNumber: number;
    type: string;
    scheduledAt: Date;
    emailSubject?: string;
    emailBody?: string;
  }): Promise<CadenceStep>;

  updateStep(
    id: string,
    data: Partial<{
      status: string;
      executedAt: Date;
      emailSubject: string;
      emailBody: string;
      responseDetectedAt: Date;
    }>
  ): Promise<CadenceStep>;

  findStepById(id: string): Promise<StepWithSequence | null>;

  findCurrentStep(sequenceId: string): Promise<CadenceStep | null>;
}

import type { Nudge, Contact, ExternalSignal, Company } from "@prisma/client";

export type NudgeWithRelations = Nudge & {
  contact: Contact & { company: Company };
  signal?: ExternalSignal | null;
};

export interface INudgeRepository {
  findByPartnerId(
    partnerId: string,
    filters?: { status?: string; priority?: string }
  ): Promise<NudgeWithRelations[]>;
  findByContactId(contactId: string): Promise<NudgeWithRelations[]>;
  countOpenByPartnerId(partnerId: string): Promise<number>;
  updateStatus(id: string, status: string): Promise<Nudge>;
  createMany(
    nudges: {
      contactId: string;
      signalId?: string;
      ruleType: string;
      reason: string;
      priority: string;
    }[]
  ): Promise<number>;
  deleteOpenByPartnerId(partnerId: string): Promise<number>;
}

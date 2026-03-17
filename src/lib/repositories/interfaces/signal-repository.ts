import type { ExternalSignal, Contact, Company } from "@prisma/client";

export type SignalWithRelations = ExternalSignal & {
  contact?: (Contact & { company: { name: string } }) | null;
  company?: Company | null;
};

export interface ISignalRepository {
  findByContactId(contactId: string): Promise<ExternalSignal[]>;
  findByCompanyId(companyId: string): Promise<ExternalSignal[]>;
  findRecentByPartnerId(
    partnerId: string,
    limit?: number
  ): Promise<SignalWithRelations[]>;
  findByContactIds(contactIds: string[]): Promise<ExternalSignal[]>;
  searchByContent(
    query: string,
    partnerId: string,
    limit?: number
  ): Promise<SignalWithRelations[]>;
  createMany(
    signals: {
      companyId?: string;
      contactId?: string;
      type: string;
      date: Date;
      content: string;
      url?: string;
      confidence?: number;
    }[]
  ): Promise<number>;
  deleteByCompanyIdAndType(companyId: string, type: string): Promise<number>;
}

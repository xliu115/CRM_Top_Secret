import type { Contact, Company } from "@prisma/client";

export type ContactWithCompany = Contact & { company: Company };

export interface IContactRepository {
  findByPartnerId(partnerId: string): Promise<ContactWithCompany[]>;
  findById(id: string, partnerId: string): Promise<ContactWithCompany | null>;
  search(query: string, partnerId: string): Promise<ContactWithCompany[]>;
  countByPartnerId(partnerId: string): Promise<number>;
}

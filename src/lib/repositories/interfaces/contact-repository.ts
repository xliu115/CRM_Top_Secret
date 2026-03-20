import type { Contact, Company } from "@prisma/client";

export type ContactWithCompany = Contact & { company: Company };

export interface IContactRepository {
  findByPartnerId(partnerId: string): Promise<ContactWithCompany[]>;
  findById(id: string, partnerId: string): Promise<ContactWithCompany | null>;
  search(query: string, partnerId: string): Promise<ContactWithCompany[]>;
  countByPartnerId(partnerId: string): Promise<number>;
  /** Contacts with at least one interaction on or after `since`. */
  findInteractedInLastYearByPartnerId(
    partnerId: string,
    since: Date
  ): Promise<ContactWithCompany[]>;
  updateStaleThreshold(id: string, partnerId: string, days: number | null): Promise<ContactWithCompany>;
}

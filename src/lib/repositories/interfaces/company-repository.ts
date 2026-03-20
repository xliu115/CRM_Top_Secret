import type { Company, Contact } from "@prisma/client";

export type CompanyWithContacts = Company & {
  contacts: (Contact & { partner: { id: string; name: string } })[];
};

export interface ICompanyRepository {
  findByPartnerId(partnerId: string): Promise<CompanyWithContacts[]>;
  findById(id: string, partnerId: string): Promise<CompanyWithContacts | null>;
}

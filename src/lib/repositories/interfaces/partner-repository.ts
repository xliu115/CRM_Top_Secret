import type { Partner } from "@prisma/client";

export interface IPartnerRepository {
  findById(id: string): Promise<Partner | null>;
  findByEmail(email: string): Promise<Partner | null>;
  findAll(): Promise<Partner[]>;
}

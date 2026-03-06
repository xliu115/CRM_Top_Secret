import type { Interaction, Contact } from "@prisma/client";

export type InteractionWithContact = Interaction & {
  contact: Contact & { company: { name: string } };
};

export interface IInteractionRepository {
  findByContactId(contactId: string): Promise<Interaction[]>;
  findRecentByPartnerId(
    partnerId: string,
    limit?: number
  ): Promise<InteractionWithContact[]>;
  findByContactIds(contactIds: string[]): Promise<Interaction[]>;
  searchByContent(
    query: string,
    partnerId: string,
    limit?: number
  ): Promise<InteractionWithContact[]>;
}

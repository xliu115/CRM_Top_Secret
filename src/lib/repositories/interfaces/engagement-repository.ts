import type {
  EventRegistration,
  ArticleEngagement,
  CampaignOutreach,
} from "@prisma/client";

export interface IEngagementRepository {
  findEventsByContactId(contactId: string): Promise<EventRegistration[]>;
  findArticlesByContactId(contactId: string): Promise<ArticleEngagement[]>;
  findCampaignsByContactId(contactId: string): Promise<CampaignOutreach[]>;
  countEventsByContactId(contactId: string): Promise<number>;
  countArticlesByContactId(contactId: string): Promise<number>;
  countCampaignsByContactId(contactId: string): Promise<number>;
  findRecentEventsByPartnerId(
    partnerId: string,
    daysBack?: number
  ): Promise<(EventRegistration & { contact: { id: string; name: string; company: { name: string } } })[]>;
  findRecentArticleViewsByPartnerId(
    partnerId: string,
    daysBack?: number
  ): Promise<(ArticleEngagement & { contact: { id: string; name: string; company: { name: string } } })[]>;
}

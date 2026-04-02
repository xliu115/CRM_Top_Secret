import type {
  Campaign,
  CampaignRecipient,
  CampaignEngagement,
  ContentItem,
  CampaignContent,
} from "@prisma/client";

export type CampaignWithStats = Campaign & {
  _count: { recipients: number };
  contents: (CampaignContent & { contentItem: ContentItem })[];
  stats: { openRate: number; clickRate: number };
};

export type CampaignDetail = Campaign & {
  contents: (CampaignContent & { contentItem: ContentItem })[];
  recipients: (CampaignRecipient & {
    contact: {
      id: string;
      name: string;
      email: string;
      title: string;
      company: { name: string };
    } | null;
    engagements: CampaignEngagement[];
  })[];
};

export interface ICampaignRepository {
  findByPartnerId(
    partnerId: string,
    filters?: { status?: string; source?: string; search?: string }
  ): Promise<CampaignWithStats[]>;
  findById(id: string, partnerId: string): Promise<CampaignDetail | null>;
  create(data: {
    partnerId: string;
    name: string;
    subject?: string;
    bodyTemplate?: string;
    source?: string;
    segmentCriteria?: string;
  }): Promise<Campaign>;
  update(
    id: string,
    partnerId: string,
    data: Partial<
      Pick<
        Campaign,
        | "name"
        | "subject"
        | "bodyTemplate"
        | "status"
        | "sentAt"
        | "sendStartedAt"
        | "lastError"
        | "segmentCriteria"
      >
    >
  ): Promise<Campaign>;
  delete(id: string, partnerId: string): Promise<void>;
  addRecipients(campaignId: string, contactIds: string[]): Promise<CampaignRecipient[]>;
  removeRecipients(campaignId: string, contactIds: string[]): Promise<void>;
  updateRecipient(
    recipientId: string,
    data: Partial<
      Pick<
        CampaignRecipient,
        | "personalizedBody"
        | "status"
        | "failureReason"
        | "sentAt"
        | "rsvpToken"
        | "rsvpStatus"
        | "rsvpRespondedAt"
      >
    >
  ): Promise<CampaignRecipient>;
  addContent(campaignId: string, contentItemIds: string[]): Promise<void>;
  removeContent(campaignId: string, contentItemIds: string[]): Promise<void>;
  findRecipientByRsvpToken(
    rsvpToken: string
  ): Promise<(CampaignRecipient & { campaign: Campaign }) | null>;
  findRecipientsByCampaignId(
    campaignId: string
  ): Promise<
    (CampaignRecipient & {
      contact: {
        id: string;
        name: string;
        email: string;
        title: string;
        company: { name: string };
      } | null;
    })[]
  >;
  recordEngagement(
    recipientId: string,
    type: string,
    contentItemId?: string,
    metadata?: string
  ): Promise<CampaignEngagement>;
  getContentItemStats(
    contentItemId: string
  ): Promise<{ timesShared: number; uniqueOpens: number; totalClicks: number }>;
  findContentItems(
    filters?: { type?: string; practice?: string; search?: string },
    page?: number,
    pageSize?: number
  ): Promise<{ items: ContentItem[]; total: number }>;
}

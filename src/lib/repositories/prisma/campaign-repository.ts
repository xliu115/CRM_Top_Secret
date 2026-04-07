import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type {
  CampaignDetail,
  CampaignWithStats,
  ICampaignRepository,
} from "../interfaces/campaign-repository";

const ENGAGEMENT_OPEN = "OPENED";
const ENGAGEMENT_CLICK = "CLICKED";

export class PrismaCampaignRepository implements ICampaignRepository {
  async findByPartnerId(
    partnerId: string,
    filters?: { status?: string; source?: string; search?: string }
  ): Promise<CampaignWithStats[]> {
    const statusFilter = filters?.status ? { status: filters.status } : {};
    const sourceFilter = filters?.source ? { source: filters.source } : {};
    const searchFilter = filters?.search
      ? { name: { contains: filters.search } }
      : {};

    const where: Prisma.CampaignWhereInput = {
      OR: [
        { partnerId },
        { recipients: { some: { assignedPartnerId: partnerId } } },
      ],
      ...statusFilter,
      ...sourceFilter,
      ...searchFilter,
    };

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        _count: { select: { recipients: true } },
        contents: {
          include: { contentItem: true },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (campaigns.length === 0) return [];

    const campaignIds = campaigns.map((c) => c.id);

    const engagements = await prisma.campaignEngagement.findMany({
      where: {
        type: { in: [ENGAGEMENT_OPEN, ENGAGEMENT_CLICK] },
        recipient: { campaignId: { in: campaignIds } },
      },
      select: {
        type: true,
        recipient: { select: { campaignId: true, id: true } },
      },
    });

    const openRecipientsByCampaign = new Map<string, Set<string>>();
    const clickRecipientsByCampaign = new Map<string, Set<string>>();

    for (const e of engagements) {
      const cid = e.recipient.campaignId;
      const rid = e.recipient.id;
      if (e.type === ENGAGEMENT_OPEN) {
        let set = openRecipientsByCampaign.get(cid);
        if (!set) {
          set = new Set();
          openRecipientsByCampaign.set(cid, set);
        }
        set.add(rid);
      } else if (e.type === ENGAGEMENT_CLICK) {
        let set = clickRecipientsByCampaign.get(cid);
        if (!set) {
          set = new Set();
          clickRecipientsByCampaign.set(cid, set);
        }
        set.add(rid);
      }
    }

    return campaigns.map((c) => {
      const n = c._count.recipients;
      const openCount = openRecipientsByCampaign.get(c.id)?.size ?? 0;
      const clickCount = clickRecipientsByCampaign.get(c.id)?.size ?? 0;
      return {
        ...c,
        stats: {
          openRate: n > 0 ? openCount / n : 0,
          clickRate: n > 0 ? clickCount / n : 0,
        },
      };
    });
  }

  async findById(id: string, partnerId: string): Promise<CampaignDetail | null> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        OR: [
          { partnerId },
          { recipients: { some: { assignedPartnerId: partnerId } } },
        ],
      },
      include: {
        contents: {
          include: { contentItem: true },
          orderBy: { position: "asc" },
        },
        recipients: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                email: true,
                title: true,
                company: { select: { name: true } },
              },
            },
            assignedPartner: {
              select: { id: true, name: true },
            },
            engagements: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    return campaign as CampaignDetail | null;
  }

  async create(data: {
    partnerId: string;
    name: string;
    subject?: string;
    bodyTemplate?: string;
    signatureBlock?: string;
    source?: string;
    segmentCriteria?: string;
  }) {
    return prisma.campaign.create({
      data: {
        partnerId: data.partnerId,
        name: data.name,
        subject: data.subject,
        bodyTemplate: data.bodyTemplate,
        signatureBlock: data.signatureBlock,
        source: data.source ?? "ACTIVATE",
        segmentCriteria: data.segmentCriteria,
      },
    });
  }

  async update(
    id: string,
    partnerId: string,
    data: Parameters<ICampaignRepository["update"]>[2]
  ) {
    const existing = await prisma.campaign.findFirst({ where: { id, partnerId } });
    if (!existing) throw new Error("Campaign not found");
    return prisma.campaign.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, partnerId: string): Promise<void> {
    const existing = await prisma.campaign.findFirst({ where: { id, partnerId } });
    if (!existing) throw new Error("Campaign not found");
    await prisma.campaign.delete({ where: { id } });
  }

  async addRecipients(campaignId: string, contactIds: string[]) {
    if (contactIds.length === 0) return [];
    const existing = await prisma.campaignRecipient.findMany({
      where: { campaignId, contactId: { in: contactIds } },
      select: { contactId: true },
    });
    const existingSet = new Set(
      existing.map((e) => e.contactId).filter((id): id is string => id != null)
    );
    const toAdd = contactIds.filter((id) => !existingSet.has(id));
    if (toAdd.length > 0) {
      await prisma.campaignRecipient.createMany({
        data: toAdd.map((contactId) => ({ campaignId, contactId })),
      });
    }
    return prisma.campaignRecipient.findMany({
      where: {
        campaignId,
        contactId: { in: contactIds },
      },
    });
  }

  async removeRecipients(campaignId: string, contactIds: string[]): Promise<void> {
    if (contactIds.length === 0) return;
    await prisma.campaignRecipient.deleteMany({
      where: {
        campaignId,
        contactId: { in: contactIds },
      },
    });
  }

  async updateRecipient(
    recipientId: string,
    data: Parameters<ICampaignRepository["updateRecipient"]>[1]
  ) {
    return prisma.campaignRecipient.update({
      where: { id: recipientId },
      data,
    });
  }

  async addContent(campaignId: string, contentItemIds: string[]): Promise<void> {
    if (contentItemIds.length === 0) return;

    const existing = await prisma.campaignContent.findMany({
      where: { campaignId, contentItemId: { in: contentItemIds } },
      select: { contentItemId: true },
    });
    const existingSet = new Set(existing.map((e) => e.contentItemId));
    const toAdd = contentItemIds.filter((id) => !existingSet.has(id));
    if (toAdd.length === 0) return;

    const maxPos = await prisma.campaignContent.aggregate({
      where: { campaignId },
      _max: { position: true },
    });
    let position = (maxPos._max.position ?? -1) + 1;

    await prisma.campaignContent.createMany({
      data: toAdd.map((contentItemId) => ({
        campaignId,
        contentItemId,
        position: position++,
      })),
    });
  }

  async removeContent(campaignId: string, contentItemIds: string[]): Promise<void> {
    if (contentItemIds.length === 0) return;
    await prisma.campaignContent.deleteMany({
      where: {
        campaignId,
        contentItemId: { in: contentItemIds },
      },
    });
  }

  async findRecipientByRsvpToken(rsvpToken: string) {
    return prisma.campaignRecipient.findFirst({
      where: { rsvpToken },
      include: { campaign: true },
    });
  }

  async findRecipientsByCampaignId(campaignId: string) {
    return prisma.campaignRecipient.findMany({
      where: { campaignId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            title: true,
            company: { select: { name: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    });
  }

  async recordEngagement(
    recipientId: string,
    type: string,
    contentItemId?: string,
    metadata?: string
  ) {
    return prisma.campaignEngagement.create({
      data: {
        recipientId,
        type,
        contentItemId,
        metadata,
      },
    });
  }

  async getContentItemStats(contentItemId: string) {
    const timesShared = await prisma.campaignContent.count({
      where: { contentItemId },
    });

    const campaignRows = await prisma.campaignContent.findMany({
      where: { contentItemId },
      select: { campaignId: true },
    });
    const campaignIds = [...new Set(campaignRows.map((r) => r.campaignId))];

    let uniqueOpens = 0;
    if (campaignIds.length > 0) {
      const openGroups = await prisma.campaignEngagement.groupBy({
        by: ["recipientId"],
        where: {
          type: ENGAGEMENT_OPEN,
          recipient: { campaignId: { in: campaignIds } },
        },
        _count: { _all: true },
      });
      uniqueOpens = openGroups.length;
    }

    const totalClicks = await prisma.campaignEngagement.count({
      where: {
        contentItemId,
        type: ENGAGEMENT_CLICK,
      },
    });

    return { timesShared, uniqueOpens, totalClicks };
  }

  async findContentItems(
    filters?: { type?: string; practice?: string; search?: string },
    page = 1,
    pageSize = 20
  ) {
    const baseWhere: Prisma.ContentItemWhereInput = {
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.practice ? { practice: filters.practice } : {}),
      ...(filters?.search
        ? {
            OR: [
              { title: { contains: filters.search } },
              { description: { contains: filters.search } },
            ],
          }
        : {}),
    };

    const skip = Math.max(0, (page - 1) * pageSize);

    if (filters?.type === "EVENT") {
      return this.findEventItems(baseWhere, skip, pageSize);
    }

    const orderBy: Prisma.ContentItemOrderByWithRelationInput[] =
      filters?.type === "ARTICLE"
        ? [{ publishedAt: "desc" }, { createdAt: "desc" }]
        : [{ updatedAt: "desc" }];

    const [items, total] = await Promise.all([
      prisma.contentItem.findMany({ where: baseWhere, orderBy, skip, take: pageSize }),
      prisma.contentItem.count({ where: baseWhere }),
    ]);

    return { items, total };
  }

  private async findEventItems(
    baseWhere: Prisma.ContentItemWhereInput,
    skip: number,
    pageSize: number
  ) {
    const now = new Date();

    const upcomingWhere: Prisma.ContentItemWhereInput = {
      AND: [baseWhere, { eventDate: { gte: now } }],
    };
    const pastWhere: Prisma.ContentItemWhereInput = {
      AND: [baseWhere, { OR: [{ eventDate: { lt: now } }, { eventDate: null }] }],
    };

    const [upcomingCount, pastCount] = await Promise.all([
      prisma.contentItem.count({ where: upcomingWhere }),
      prisma.contentItem.count({ where: pastWhere }),
    ]);
    const total = upcomingCount + pastCount;

    if (skip >= upcomingCount) {
      const pastSkip = skip - upcomingCount;
      const pastItems = await prisma.contentItem.findMany({
        where: pastWhere,
        orderBy: [{ eventDate: "desc" }],
        skip: pastSkip,
        take: pageSize,
      });
      return { items: pastItems, total };
    }

    const upcomingItems = await prisma.contentItem.findMany({
      where: upcomingWhere,
      orderBy: [{ eventDate: "asc" }],
      skip,
      take: pageSize,
    });

    const remaining = pageSize - upcomingItems.length;
    if (remaining > 0) {
      const pastItems = await prisma.contentItem.findMany({
        where: pastWhere,
        orderBy: [{ eventDate: "desc" }],
        take: remaining,
      });
      return { items: [...upcomingItems, ...pastItems], total };
    }

    return { items: upcomingItems, total };
  }
}

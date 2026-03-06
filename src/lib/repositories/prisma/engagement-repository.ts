import { prisma } from "@/lib/db/prisma";
import type { IEngagementRepository } from "../interfaces/engagement-repository";

export class PrismaEngagementRepository implements IEngagementRepository {
  async findEventsByContactId(contactId: string) {
    return prisma.eventRegistration.findMany({
      where: { contactId },
      orderBy: { eventDate: "desc" },
    });
  }

  async findArticlesByContactId(contactId: string) {
    return prisma.articleEngagement.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findCampaignsByContactId(contactId: string) {
    return prisma.campaignOutreach.findMany({
      where: { contactId },
      orderBy: { statusDate: "desc" },
    });
  }

  async countEventsByContactId(contactId: string) {
    return prisma.eventRegistration.count({ where: { contactId } });
  }

  async countArticlesByContactId(contactId: string) {
    return prisma.articleEngagement.count({ where: { contactId } });
  }

  async countCampaignsByContactId(contactId: string) {
    return prisma.campaignOutreach.count({ where: { contactId } });
  }

  async findRecentEventsByPartnerId(partnerId: string, daysBack = 30) {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    return prisma.eventRegistration.findMany({
      where: {
        contact: { partnerId },
        eventDate: { gte: since },
      },
      include: {
        contact: {
          select: { id: true, name: true, company: { select: { name: true } } },
        },
      },
      orderBy: { eventDate: "desc" },
    });
  }

  async findRecentArticleViewsByPartnerId(partnerId: string, daysBack = 30) {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    return prisma.articleEngagement.findMany({
      where: {
        contact: { partnerId },
        views: { gt: 0 },
        lastViewDate: { gte: since },
      },
      include: {
        contact: {
          select: { id: true, name: true, company: { select: { name: true } } },
        },
      },
      orderBy: { lastViewDate: "desc" },
    });
  }
}

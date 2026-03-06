import { prisma } from "@/lib/db/prisma";
import type { IMeetingRepository } from "../interfaces/meeting-repository";

const attendeesInclude = {
  attendees: {
    include: {
      contact: { include: { company: true } },
    },
  },
} as const;

export class PrismaMeetingRepository implements IMeetingRepository {
  async findUpcomingByPartnerId(partnerId: string) {
    return prisma.meeting.findMany({
      where: { partnerId, startTime: { gte: new Date() } },
      include: attendeesInclude,
      orderBy: { startTime: "asc" },
    });
  }

  async findByPartnerId(partnerId: string) {
    return prisma.meeting.findMany({
      where: { partnerId },
      include: attendeesInclude,
      orderBy: { startTime: "desc" },
    });
  }

  async findById(id: string, partnerId: string) {
    return prisma.meeting.findFirst({
      where: { id, partnerId },
      include: attendeesInclude,
    });
  }

  async countUpcomingByPartnerId(partnerId: string) {
    return prisma.meeting.count({
      where: { partnerId, startTime: { gte: new Date() } },
    });
  }

  async updateBrief(id: string, brief: string) {
    return prisma.meeting.update({
      where: { id },
      data: { generatedBrief: brief },
    });
  }

  async findByContactId(contactId: string) {
    return prisma.meeting.findMany({
      where: { attendees: { some: { contactId } } },
      include: attendeesInclude,
      orderBy: { startTime: "desc" },
    });
  }
}

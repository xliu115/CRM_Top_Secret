import { prisma } from "@/lib/db/prisma";
import type { INudgeRuleConfigRepository } from "../interfaces/nudge-rule-config-repository";
import type { NudgeRuleConfig } from "@prisma/client";

const DEFAULTS: Omit<NudgeRuleConfig, "id" | "partnerId" | "createdAt" | "updatedAt"> = {
  staleContactEnabled: true,
  jobChangeEnabled: true,
  companyNewsEnabled: true,
  upcomingEventEnabled: true,
  meetingPrepEnabled: true,
  eventAttendedEnabled: true,
  eventRegisteredEnabled: true,
  articleReadEnabled: true,
  staleDaysCritical: 30,
  staleDaysHigh: 45,
  staleDaysMedium: 60,
  staleDaysLow: 90,
};

export class PrismaNudgeRuleConfigRepository implements INudgeRuleConfigRepository {
  async findByPartnerId(partnerId: string) {
    return prisma.nudgeRuleConfig.findUnique({ where: { partnerId } });
  }

  async upsert(
    partnerId: string,
    data: Partial<Omit<NudgeRuleConfig, "id" | "partnerId" | "createdAt" | "updatedAt">>
  ) {
    return prisma.nudgeRuleConfig.upsert({
      where: { partnerId },
      create: { partnerId, ...DEFAULTS, ...data },
      update: data,
    });
  }

  async resetToDefaults(partnerId: string) {
    return prisma.nudgeRuleConfig.upsert({
      where: { partnerId },
      create: { partnerId, ...DEFAULTS },
      update: DEFAULTS,
    });
  }
}

import type { NudgeRuleConfig } from "@prisma/client";

export type { NudgeRuleConfig };

export interface INudgeRuleConfigRepository {
  findByPartnerId(partnerId: string): Promise<NudgeRuleConfig | null>;
  upsert(
    partnerId: string,
    data: Partial<Omit<NudgeRuleConfig, "id" | "partnerId" | "createdAt" | "updatedAt">>
  ): Promise<NudgeRuleConfig>;
  resetToDefaults(partnerId: string): Promise<NudgeRuleConfig>;
}

export type { IPartnerRepository } from "./partner-repository";
export type { IContactRepository, ContactWithCompany } from "./contact-repository";
export type {
  ICompanyRepository,
  CompanyWithContacts,
} from "./company-repository";
export type {
  IInteractionRepository,
  InteractionWithContact,
} from "./interaction-repository";
export type {
  ISignalRepository,
  SignalWithRelations,
} from "./signal-repository";
export type { INudgeRepository, NudgeWithRelations } from "./nudge-repository";
export type {
  IMeetingRepository,
  MeetingWithAttendees,
} from "./meeting-repository";
export type { IEngagementRepository } from "./engagement-repository";
export type {
  INudgeRuleConfigRepository,
  NudgeRuleConfig,
} from "./nudge-rule-config-repository";
export type {
  ISequenceRepository,
  SequenceWithRelations,
  StepWithSequence,
} from "./sequence-repository";
export type {
  ICampaignRepository,
  CampaignWithStats,
  CampaignDetail,
} from "./campaign-repository";

import { PrismaPartnerRepository } from "./prisma/partner-repository";
import { PrismaContactRepository } from "./prisma/contact-repository";
import { PrismaInteractionRepository } from "./prisma/interaction-repository";
import { PrismaSignalRepository } from "./prisma/signal-repository";
import { PrismaNudgeRepository } from "./prisma/nudge-repository";
import { PrismaMeetingRepository } from "./prisma/meeting-repository";
import { PrismaEngagementRepository } from "./prisma/engagement-repository";

export const partnerRepo = new PrismaPartnerRepository();
export const contactRepo = new PrismaContactRepository();
export const interactionRepo = new PrismaInteractionRepository();
export const signalRepo = new PrismaSignalRepository();
export const nudgeRepo = new PrismaNudgeRepository();
export const meetingRepo = new PrismaMeetingRepository();
export const engagementRepo = new PrismaEngagementRepository();

export type {
  IPartnerRepository,
  IContactRepository,
  ContactWithCompany,
  IInteractionRepository,
  InteractionWithContact,
  ISignalRepository,
  SignalWithRelations,
  INudgeRepository,
  NudgeWithRelations,
  IMeetingRepository,
  MeetingWithAttendees,
  IEngagementRepository,
} from "./interfaces";

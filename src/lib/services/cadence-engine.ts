import { sequenceRepo, nudgeRepo, interactionRepo } from "@/lib/repositories";
import { generateFollowUpEmail } from "./llm-service";
import type { SequenceWithRelations } from "@/lib/repositories";
import { addDays } from "date-fns";

const STEP_CONFIGS = [
  { type: "INITIAL", label: "Initial outreach", delayDays: 0 },
  { type: "FOLLOW_UP_1", label: "Follow-up", delayDays: 3 },
  { type: "FOLLOW_UP_2", label: "Value-add follow-up", delayDays: 5 },
  { type: "FINAL", label: "Final check-in", delayDays: 7 },
];

export interface KickoffParams {
  contactId: string;
  partnerId: string;
  originNudgeId: string;
  angleStrategy: string;
  initialSubject?: string;
  initialBody?: string;
  /** When true, step 0 is marked as already sent (used by auto-sequence after "Send via Activate"). */
  alreadySent?: boolean;
}

export async function kickoffSequence(params: KickoffParams) {
  const existing = await sequenceRepo.findActiveByContactId(params.contactId);
  if (existing) {
    return { sequence: existing, alreadyActive: true };
  }

  const sequence = await sequenceRepo.create({
    contactId: params.contactId,
    partnerId: params.partnerId,
    originNudgeId: params.originNudgeId,
    angleStrategy: params.angleStrategy,
    totalSteps: STEP_CONFIGS.length,
  });

  const now = new Date();
  const firstStep = await sequenceRepo.createStep({
    sequenceId: sequence.id,
    stepNumber: 0,
    type: STEP_CONFIGS[0].type,
    scheduledAt: now,
    emailSubject: params.initialSubject,
    emailBody: params.initialBody,
  });

  if (params.alreadySent) {
    await sequenceRepo.updateStep(firstStep.id, {
      status: "SENT",
      executedAt: now,
    });
    const nextConfig = STEP_CONFIGS[1];
    if (nextConfig) {
      const nextAt = addDays(now, nextConfig.delayDays);
      await sequenceRepo.updateNextStep(sequence.id, 0, nextAt);
    }
  } else {
    await sequenceRepo.updateNextStep(sequence.id, 0, now);
  }

  return { sequence, step: firstStep, alreadyActive: false };
}

export async function advanceSequence(sequenceId: string) {
  const seq = await sequenceRepo.findById(sequenceId);
  if (!seq || seq.status !== "ACTIVE") return null;

  const nextStepNumber = seq.currentStep + 1;
  if (nextStepNumber >= seq.totalSteps) {
    await sequenceRepo.updateStatus(sequenceId, "COMPLETED", new Date());
    return { completed: true, sequence: seq };
  }

  const config = STEP_CONFIGS[nextStepNumber];
  if (!config) {
    await sequenceRepo.updateStatus(sequenceId, "COMPLETED", new Date());
    return { completed: true, sequence: seq };
  }

  const interactions = await interactionRepo.findByContactId(seq.contactId);
  const recentInteractions = interactions
    .slice(0, 5)
    .map(
      (i) =>
        `${i.type} on ${new Date(i.date).toLocaleDateString()}: ${i.summary}`
    );

  const previousStepBodies = seq.steps
    .filter((s) => s.emailBody)
    .map((s) => s.emailBody!);

  const emailDraft = await generateFollowUpEmail({
    partnerName: "",
    contactName: seq.contact.name,
    contactTitle: seq.contact.company.name,
    companyName: seq.contact.company.name,
    stepNumber: nextStepNumber,
    totalSteps: seq.totalSteps,
    stepType: config.type,
    angleStrategy: seq.angleStrategy,
    previousEmails: previousStepBodies,
    recentInteractions,
    daysSinceLastStep: config.delayDays,
  });

  const scheduledAt = addDays(new Date(), config.delayDays);

  const step = await sequenceRepo.createStep({
    sequenceId: seq.id,
    stepNumber: nextStepNumber,
    type: config.type,
    scheduledAt,
    emailSubject: emailDraft.subject,
    emailBody: emailDraft.body,
  });

  await sequenceRepo.updateNextStep(seq.id, nextStepNumber, scheduledAt);

  return { completed: false, step, sequence: seq };
}

export async function recordResponse(sequenceId: string) {
  const seq = await sequenceRepo.findById(sequenceId);
  if (!seq || seq.status !== "ACTIVE") return null;

  const currentStep = seq.steps.find((s) => s.stepNumber === seq.currentStep);
  if (currentStep) {
    await sequenceRepo.updateStep(currentStep.id, {
      responseDetectedAt: new Date(),
      status: "RESPONDED",
    });
  }

  await sequenceRepo.updateStatus(sequenceId, "RESPONDED", new Date());
  return { sequence: seq };
}

export async function pauseSequence(sequenceId: string) {
  return sequenceRepo.updateStatus(sequenceId, "PAUSED");
}

export async function resumeSequence(sequenceId: string) {
  const seq = await sequenceRepo.findById(sequenceId);
  if (!seq || seq.status !== "PAUSED") return null;

  const nextStepAt = addDays(new Date(), 1);
  await sequenceRepo.updateNextStep(seq.id, seq.currentStep, nextStepAt);
  await sequenceRepo.updateStatus(sequenceId, "ACTIVE");
  return seq;
}

export async function archiveSequence(sequenceId: string) {
  return sequenceRepo.updateStatus(sequenceId, "ARCHIVED");
}

export async function autoAdvanceDueSequences() {
  const now = new Date();
  const dueSequences = await sequenceRepo.findDueForAdvance(now);
  const results: { sequenceId: string; advanced: boolean; completed: boolean }[] = [];

  for (const seq of dueSequences) {
    const result = await advanceSequence(seq.id);
    if (result) {
      results.push({
        sequenceId: seq.id,
        advanced: !result.completed,
        completed: result.completed ?? false,
      });
    }
  }

  return results;
}

export function getWaitingDays(seq: SequenceWithRelations): number {
  const currentStep = seq.steps.find((s) => s.stepNumber === seq.currentStep);
  if (!currentStep?.executedAt) return 0;
  const diff = Date.now() - new Date(currentStep.executedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function buildSequenceNudgeReason(
  contactName: string,
  waitingDays: number
): string {
  if (waitingDays <= 0) {
    return `Follow up with ${contactName}`;
  }
  return `Follow up with ${contactName} — no response in ${waitingDays} day${waitingDays !== 1 ? "s" : ""}`;
}

export function buildReplyNeededReason(
  contactName: string,
  daysSinceEmail: number
): string {
  return `${contactName} emailed you ${daysSinceEmail} day${daysSinceEmail !== 1 ? "s" : ""} ago — draft a reply?`;
}

/**
 * Called when an inbound interaction is recorded for a contact.
 * If there's an active outreach sequence for that contact, auto-complete it.
 */
export async function detectResponseForContact(contactId: string) {
  const activeSeq = await sequenceRepo.findActiveByContactId(contactId);
  if (!activeSeq) return null;

  return recordResponse(activeSeq.id);
}

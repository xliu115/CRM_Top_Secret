import type { PipelineLens } from "@prisma/client";
import type { LensSlug } from "@/lib/pipeline/lens";

export type PipelineRowDTO = {
  id: string;
  partnerId: string;
  lens: LensSlug;
  stage: string;
  confirmationStatus: "DRAFT" | "CONFIRMED";
  title: string;
  workingTitle: string | null;
  companyId: string | null;
  contactId: string | null;
  nextStep: string | null;
  clientContact: string | null;
  lastTouchpoint: string | null;
  milestoneDate: string | null;
  provenance: "manual" | "system" | "voice" | "upload";
  tags: string[];
  dropOffReason: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PipelineSuggestionDTO = {
  id: string;
  partnerId: string;
  type: "NEW_ROW" | "STAGE_MOVE" | "HYGIENE";
  targetRowId: string | null;
  payload: Record<string, unknown>;
  title: string;
  subtitle: string | null;
  whyLine: string;
  rank: number;
  status: "pending" | "accepted" | "dismissed" | "snoozed";
  snoozedUntil: string | null;
  dedupeKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PipelineTabStateDTO = {
  tabKey: LensSlug;
  lastViewedAt: string | null;
  highlightCollapsedUntil: string | null;
};

export type PipelineEventDTO = {
  id: string;
  rowId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type CreatePipelineRowInput = {
  lens: PipelineLens;
  stage: string;
  title: string;
  workingTitle?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  nextStep?: string | null;
  clientContact?: string | null;
  lastTouchpoint?: string | null;
  milestoneDate?: Date | null;
  provenance: "manual" | "system" | "voice" | "upload";
  confirmationStatus?: "DRAFT" | "CONFIRMED";
  tags?: string[];
};

export type UpsertSuggestionInput = {
  type: "NEW_ROW" | "STAGE_MOVE" | "HYGIENE";
  targetRowId?: string | null;
  payload: Record<string, unknown>;
  title: string;
  subtitle?: string | null;
  whyLine: string;
  rank: number;
  dedupeKey?: string | null;
};

export interface IPipelineRepository {
  listRows(
    partnerId: string,
    lens?: LensSlug,
    opts?: { includeArchived?: boolean },
  ): Promise<PipelineRowDTO[]>;

  findRowById(
    id: string,
    partnerId: string,
  ): Promise<PipelineRowDTO | null>;

  createRow(
    partnerId: string,
    input: CreatePipelineRowInput,
  ): Promise<PipelineRowDTO>;

  updateRow(
    id: string,
    partnerId: string,
    patch: Partial<{
      title: string;
      workingTitle: string | null;
      stage: string;
      nextStep: string | null;
      clientContact: string | null;
      lastTouchpoint: string | null;
      milestoneDate: Date | null;
      companyId: string | null;
      contactId: string | null;
      tags: string[];
      dropOffReason: string | null;
    }>,
  ): Promise<PipelineRowDTO | null>;

  confirmRow(id: string, partnerId: string): Promise<PipelineRowDTO | null>;

  setStage(
    id: string,
    partnerId: string,
    newStage: string,
    options?: { skipEvent?: boolean },
  ): Promise<PipelineRowDTO | null>;

  archiveRow(
    id: string,
    partnerId: string,
    dropOffReason?: string | null,
  ): Promise<PipelineRowDTO | null>;

  listPendingSuggestions(partnerId: string): Promise<PipelineSuggestionDTO[]>;

  upsertSuggestionsByDedupeKey(
    partnerId: string,
    inputs: UpsertSuggestionInput[],
  ): Promise<void>;

  updateSuggestion(
    id: string,
    partnerId: string,
    patch: Partial<{
      status: "pending" | "accepted" | "dismissed" | "snoozed";
      snoozedUntil: Date | null;
      dismissedSnapshot: string | null;
    }>,
  ): Promise<PipelineSuggestionDTO | null>;

  getSuggestion(
    id: string,
    partnerId: string,
  ): Promise<PipelineSuggestionDTO | null>;

  listTabStates(partnerId: string): Promise<PipelineTabStateDTO[]>;

  patchTabState(
    partnerId: string,
    tabKey: LensSlug,
    patch: Partial<{
      lastViewedAt: Date | null;
      highlightCollapsedUntil: Date | null;
    }>,
  ): Promise<PipelineTabStateDTO>;

  appendEvent(
    partnerId: string,
    event: {
      rowId?: string | null;
      eventType: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<void>;

  listEventsSince(
    partnerId: string,
    lens: LensSlug,
    since: Date,
  ): Promise<PipelineEventDTO[]>;

  findLatestUndoableStageChange(
    rowId: string,
    partnerId: string,
    since: Date,
  ): Promise<{ eventId: string; restoreStage: string } | null>;

  listAttachments(
    rowId: string,
    partnerId: string,
  ): Promise<
    Array<{
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      storageKey: string;
      createdAt: string;
    }>
  >;

  createAttachment(input: {
    partnerId: string;
    rowId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  }): Promise<{ id: string }>;
}

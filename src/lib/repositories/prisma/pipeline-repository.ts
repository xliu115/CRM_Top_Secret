/**
 * Partner-scoped pipeline persistence.
 *
 * Roles (future, spec §8): when multi-user / EA exists, gate view | edit |
 * confirm | attachments here — v1 is owner-partner only via session partnerId.
 */
import type { PipelineLens } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { lensSlugToPrisma, prismaLensToSlug, type LensSlug } from "@/lib/pipeline/lens";
import type {
  CreatePipelineRowInput,
  IPipelineRepository,
  PipelineEventDTO,
  PipelineRowDTO,
  PipelineSuggestionDTO,
  PipelineTabStateDTO,
  UpsertSuggestionInput,
} from "../interfaces/pipeline-repository";

function assertPipelinePrismaModels(): void {
  const client = prisma as unknown as Record<
    string,
    { findMany?: unknown } | undefined
  >;
  const ok =
    typeof client.pipelineRow?.findMany === "function" &&
    typeof client.pipelineSuggestion?.findMany === "function" &&
    typeof client.pipelineTabState?.findMany === "function" &&
    typeof client.pipelineEvent?.findMany === "function" &&
    typeof client.pipelineAttachment?.findMany === "function";
  if (!ok) {
    throw new Error(
      "[Pipeline] Prisma Client is missing Pipeline models (e.g. prisma.pipelineRow is undefined).\n\n" +
        "This almost always means @prisma/client was generated before schema.prisma included Pipeline tables.\n\n" +
        "Fix:\n" +
        "  1. From the project root: npx prisma generate\n" +
        "  2. Restart the Next.js dev server (the Prisma singleton may be stale).\n" +
        "  3. If tables are missing: npx prisma db push\n" +
        "  4. Optional demo rows: npx prisma db seed\n",
    );
  }
}

assertPipelinePrismaModels();

function parseTags(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) && v.every((x) => typeof x === "string") ? v : [];
  } catch {
    return [];
  }
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function mapRow(r: {
  id: string;
  partnerId: string;
  lens: PipelineLens;
  stage: string;
  confirmationStatus: string;
  title: string;
  workingTitle: string | null;
  companyId: string | null;
  contactId: string | null;
  nextStep: string | null;
  clientContact: string | null;
  lastTouchpoint: string | null;
  milestoneDate: Date | null;
  provenance: string;
  tags: string;
  dropOffReason: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PipelineRowDTO {
  return {
    id: r.id,
    partnerId: r.partnerId,
    lens: prismaLensToSlug(r.lens),
    stage: r.stage,
    confirmationStatus:
      r.confirmationStatus === "CONFIRMED" ? "CONFIRMED" : "DRAFT",
    title: r.title,
    workingTitle: r.workingTitle,
    companyId: r.companyId,
    contactId: r.contactId,
    nextStep: r.nextStep,
    clientContact: r.clientContact,
    lastTouchpoint: r.lastTouchpoint,
    milestoneDate: r.milestoneDate ? r.milestoneDate.toISOString() : null,
    provenance: r.provenance as PipelineRowDTO["provenance"],
    tags: parseTags(r.tags),
    dropOffReason: r.dropOffReason,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function mapSuggestion(s: {
  id: string;
  partnerId: string;
  type: string;
  targetRowId: string | null;
  payload: string;
  title: string;
  subtitle: string | null;
  whyLine: string;
  rank: number;
  status: string;
  snoozedUntil: Date | null;
  dedupeKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PipelineSuggestionDTO {
  return {
    id: s.id,
    partnerId: s.partnerId,
    type: s.type as PipelineSuggestionDTO["type"],
    targetRowId: s.targetRowId,
    payload: parsePayload(s.payload),
    title: s.title,
    subtitle: s.subtitle,
    whyLine: s.whyLine,
    rank: s.rank,
    status: s.status as PipelineSuggestionDTO["status"],
    snoozedUntil: s.snoozedUntil ? s.snoozedUntil.toISOString() : null,
    dedupeKey: s.dedupeKey,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export class PrismaPipelineRepository implements IPipelineRepository {
  async listRows(
    partnerId: string,
    lens?: LensSlug,
    opts?: { includeArchived?: boolean },
  ): Promise<PipelineRowDTO[]> {
    const rows = await prisma.pipelineRow.findMany({
      where: {
        partnerId,
        ...(lens ? { lens: lensSlugToPrisma(lens) } : {}),
        ...(opts?.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: [{ updatedAt: "desc" }],
    });
    return rows.map(mapRow);
  }

  async findRowById(id: string, partnerId: string): Promise<PipelineRowDTO | null> {
    const r = await prisma.pipelineRow.findFirst({ where: { id, partnerId } });
    return r ? mapRow(r) : null;
  }

  async createRow(
    partnerId: string,
    input: CreatePipelineRowInput,
  ): Promise<PipelineRowDTO> {
    const confirmationStatus = input.confirmationStatus ?? "DRAFT";
    const tagsJson = JSON.stringify(input.tags ?? []);
    const r = await prisma.pipelineRow.create({
      data: {
        partnerId,
        lens: input.lens,
        stage: input.stage,
        confirmationStatus,
        title: input.title,
        workingTitle: input.workingTitle ?? null,
        companyId: input.companyId ?? null,
        contactId: input.contactId ?? null,
        nextStep: input.nextStep ?? null,
        clientContact: input.clientContact ?? null,
        lastTouchpoint: input.lastTouchpoint ?? null,
        milestoneDate: input.milestoneDate ?? null,
        provenance: input.provenance,
        tags: tagsJson,
      },
    });
    await this.appendEvent(partnerId, {
      rowId: r.id,
      eventType:
        confirmationStatus === "CONFIRMED" ? "ROW_CONFIRMED" : "ROW_CREATED",
      payload: { stage: r.stage, lens: r.lens },
    });
    return mapRow(r);
  }

  async updateRow(
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
  ): Promise<PipelineRowDTO | null> {
    const existing = await prisma.pipelineRow.findFirst({ where: { id, partnerId } });
    if (!existing) return null;
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.workingTitle !== undefined) data.workingTitle = patch.workingTitle;
    if (patch.nextStep !== undefined) data.nextStep = patch.nextStep;
    if (patch.clientContact !== undefined) data.clientContact = patch.clientContact;
    if (patch.lastTouchpoint !== undefined) data.lastTouchpoint = patch.lastTouchpoint;
    if (patch.milestoneDate !== undefined) data.milestoneDate = patch.milestoneDate;
    if (patch.companyId !== undefined) data.companyId = patch.companyId;
    if (patch.contactId !== undefined) data.contactId = patch.contactId;
    if (patch.dropOffReason !== undefined) data.dropOffReason = patch.dropOffReason;
    if (patch.tags !== undefined) data.tags = JSON.stringify(patch.tags);
    if (patch.stage !== undefined && patch.stage !== existing.stage) {
      data.stage = patch.stage;
    }
    const r = await prisma.pipelineRow.update({
      where: { id },
      data: data as Parameters<typeof prisma.pipelineRow.update>[0]["data"],
    });
    if (patch.stage !== undefined && patch.stage !== existing.stage) {
      await this.appendEvent(partnerId, {
        rowId: id,
        eventType: "STAGE_CHANGED",
        payload: {
          from: existing.stage,
          to: patch.stage,
          previousStage: existing.stage,
        },
      });
    }
    return mapRow(r);
  }

  async confirmRow(id: string, partnerId: string): Promise<PipelineRowDTO | null> {
    const existing = await prisma.pipelineRow.findFirst({ where: { id, partnerId } });
    if (!existing) return null;
    const r = await prisma.pipelineRow.update({
      where: { id },
      data: { confirmationStatus: "CONFIRMED" },
    });
    await this.appendEvent(partnerId, {
      rowId: id,
      eventType: "ROW_CONFIRMED",
      payload: {},
    });
    return mapRow(r);
  }

  async setStage(
    id: string,
    partnerId: string,
    newStage: string,
    options?: { skipEvent?: boolean },
  ): Promise<PipelineRowDTO | null> {
    const existing = await prisma.pipelineRow.findFirst({ where: { id, partnerId } });
    if (!existing || existing.stage === newStage) {
      if (!existing) return null;
      return mapRow(existing);
    }
    const r = await prisma.pipelineRow.update({
      where: { id },
      data: { stage: newStage },
    });
    if (!options?.skipEvent) {
      await this.appendEvent(partnerId, {
        rowId: id,
        eventType: "STAGE_CHANGED",
        payload: {
          from: existing.stage,
          to: newStage,
          previousStage: existing.stage,
        },
      });
    }
    return mapRow(r);
  }

  async archiveRow(
    id: string,
    partnerId: string,
    dropOffReason?: string | null,
  ): Promise<PipelineRowDTO | null> {
    const existing = await prisma.pipelineRow.findFirst({ where: { id, partnerId } });
    if (!existing) return null;
    const r = await prisma.pipelineRow.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        dropOffReason: dropOffReason ?? existing.dropOffReason,
      },
    });
    await this.appendEvent(partnerId, {
      rowId: id,
      eventType: "ROW_ARCHIVED",
      payload: { dropOffReason: dropOffReason ?? null },
    });
    return mapRow(r);
  }

  async listPendingSuggestions(partnerId: string): Promise<PipelineSuggestionDTO[]> {
    const now = new Date();
    await prisma.pipelineSuggestion.updateMany({
      where: {
        partnerId,
        status: "snoozed",
        snoozedUntil: { lte: now },
      },
      data: { status: "pending", snoozedUntil: null },
    });
    const list = await prisma.pipelineSuggestion.findMany({
      where: {
        partnerId,
        status: "pending",
      },
      orderBy: [{ rank: "desc" }, { createdAt: "asc" }],
    });
    return list.map(mapSuggestion);
  }

  async upsertSuggestionsByDedupeKey(
    partnerId: string,
    inputs: UpsertSuggestionInput[],
  ): Promise<void> {
    for (const input of inputs) {
      const payloadStr = JSON.stringify(input.payload);
      if (input.dedupeKey) {
        const existing = await prisma.pipelineSuggestion.findFirst({
          where: { partnerId, dedupeKey: input.dedupeKey },
        });
        if (existing) {
          if (existing.status === "dismissed") continue;
          await prisma.pipelineSuggestion.update({
            where: { id: existing.id },
            data: {
              title: input.title,
              subtitle: input.subtitle ?? null,
              whyLine: input.whyLine,
              rank: input.rank,
              payload: payloadStr,
              targetRowId: input.targetRowId ?? null,
              type: input.type,
            },
          });
          continue;
        }
      }
      await prisma.pipelineSuggestion.create({
        data: {
          partnerId,
          type: input.type,
          targetRowId: input.targetRowId ?? null,
          payload: payloadStr,
          title: input.title,
          subtitle: input.subtitle ?? null,
          whyLine: input.whyLine,
          rank: input.rank,
          dedupeKey: input.dedupeKey ?? null,
          status: "pending",
        },
      });
    }
  }

  async updateSuggestion(
    id: string,
    partnerId: string,
    patch: Partial<{
      status: "pending" | "accepted" | "dismissed" | "snoozed";
      snoozedUntil: Date | null;
      dismissedSnapshot: string | null;
    }>,
  ): Promise<PipelineSuggestionDTO | null> {
    const s = await prisma.pipelineSuggestion.findFirst({ where: { id, partnerId } });
    if (!s) return null;
    const updated = await prisma.pipelineSuggestion.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.snoozedUntil !== undefined
          ? { snoozedUntil: patch.snoozedUntil }
          : {}),
        ...(patch.dismissedSnapshot !== undefined
          ? { dismissedSnapshot: patch.dismissedSnapshot }
          : {}),
      },
    });
    return mapSuggestion(updated);
  }

  async getSuggestion(
    id: string,
    partnerId: string,
  ): Promise<PipelineSuggestionDTO | null> {
    const s = await prisma.pipelineSuggestion.findFirst({ where: { id, partnerId } });
    return s ? mapSuggestion(s) : null;
  }

  async listTabStates(partnerId: string): Promise<PipelineTabStateDTO[]> {
    const rows = await prisma.pipelineTabState.findMany({ where: { partnerId } });
    const byKey = new Map(rows.map((r) => [r.tabKey, r]));
    const keys: LensSlug[] = ["pipeline", "clients"];
    const out: PipelineTabStateDTO[] = [];
    for (const tabKey of keys) {
      const r = byKey.get(tabKey);
      out.push({
        tabKey,
        lastViewedAt: r?.lastViewedAt ? r.lastViewedAt.toISOString() : null,
        highlightCollapsedUntil: r?.highlightCollapsedUntil
          ? r.highlightCollapsedUntil.toISOString()
          : null,
      });
    }
    return out;
  }

  async patchTabState(
    partnerId: string,
    tabKey: LensSlug,
    patch: Partial<{
      lastViewedAt: Date | null;
      highlightCollapsedUntil: Date | null;
    }>,
  ): Promise<PipelineTabStateDTO> {
    const r = await prisma.pipelineTabState.upsert({
      where: {
        partnerId_tabKey: { partnerId, tabKey },
      },
      create: {
        partnerId,
        tabKey,
        lastViewedAt: patch.lastViewedAt ?? null,
        highlightCollapsedUntil: patch.highlightCollapsedUntil ?? null,
      },
      update: {
        ...(patch.lastViewedAt !== undefined
          ? { lastViewedAt: patch.lastViewedAt }
          : {}),
        ...(patch.highlightCollapsedUntil !== undefined
          ? { highlightCollapsedUntil: patch.highlightCollapsedUntil }
          : {}),
      },
    });
    return {
      tabKey: r.tabKey as LensSlug,
      lastViewedAt: r.lastViewedAt ? r.lastViewedAt.toISOString() : null,
      highlightCollapsedUntil: r.highlightCollapsedUntil
        ? r.highlightCollapsedUntil.toISOString()
        : null,
    };
  }

  async appendEvent(
    partnerId: string,
    event: {
      rowId?: string | null;
      eventType: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<void> {
    await prisma.pipelineEvent.create({
      data: {
        partnerId,
        rowId: event.rowId ?? null,
        eventType: event.eventType,
        payload: JSON.stringify(event.payload ?? {}),
      },
    });
  }

  async listEventsSince(
    partnerId: string,
    lens: LensSlug,
    since: Date,
  ): Promise<PipelineEventDTO[]> {
    const lensP = lensSlugToPrisma(lens);
    const events = await prisma.pipelineEvent.findMany({
      where: {
        partnerId,
        createdAt: { gt: since },
        OR: [
          { rowId: null },
          { row: { lens: lensP, partnerId } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return events.map((e) => ({
      id: e.id,
      rowId: e.rowId,
      eventType: e.eventType,
      payload: parsePayload(e.payload),
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async findLatestUndoableStageChange(
    rowId: string,
    partnerId: string,
    since: Date,
  ): Promise<{ eventId: string; restoreStage: string } | null> {
    const ev = await prisma.pipelineEvent.findFirst({
      where: {
        partnerId,
        rowId,
        eventType: "STAGE_CHANGED",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!ev) return null;
    const p = parsePayload(ev.payload);
    const restoreStage =
      typeof p.from === "string"
        ? p.from
        : typeof p.previousStage === "string"
          ? p.previousStage
          : null;
    if (!restoreStage) return null;
    return { eventId: ev.id, restoreStage };
  }

  async listAttachments(rowId: string, partnerId: string) {
    const list = await prisma.pipelineAttachment.findMany({
      where: { rowId, partnerId },
      orderBy: { createdAt: "desc" },
    });
    return list.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      storageKey: a.storageKey,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async createAttachment(input: {
    partnerId: string;
    rowId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  }) {
    const a = await prisma.pipelineAttachment.create({
      data: {
        partnerId: input.partnerId,
        rowId: input.rowId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageKey: input.storageKey,
      },
    });
    await this.appendEvent(input.partnerId, {
      rowId: input.rowId,
      eventType: "ATTACHMENT_ADDED",
      payload: { attachmentId: a.id, fileName: input.fileName },
    });
    return { id: a.id };
  }
}

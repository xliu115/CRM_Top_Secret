import { addDays, isAfter } from "date-fns";
import { defaultStageForLens } from "@/lib/pipeline/stages";
import {
  contactRepo,
  meetingRepo,
  pipelineRepo,
} from "@/lib/repositories";
import type { UpsertSuggestionInput } from "@/lib/repositories/interfaces/pipeline-repository";

const STALE_DAYS = 60;

/**
 * Rule-based suggestions (v1). No playbook strings; plain operational copy.
 * See docs/superpowers/specs/2026-05-08-pipeline-tab-design.md §3.3, §13.
 */
export async function refreshPipelineSuggestions(
  partnerId: string,
): Promise<void> {
  const [meetings, rows, contacts] = await Promise.all([
    meetingRepo.findUpcomingByPartnerId(partnerId),
    pipelineRepo.listRows(partnerId, undefined, { includeArchived: false }),
    contactRepo.findByPartnerId(partnerId),
  ]);

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const now = new Date();
  const horizon = addDays(now, 14);

  const inputs: UpsertSuggestionInput[] = [];

  for (const m of meetings) {
    const start = new Date(m.startTime);
    const inWindow = isAfter(start, now) && !isAfter(start, horizon);
    if (!inWindow) continue;
    for (const a of m.attendees) {
      const cid = a.contact.id;
      const hasRow = rows.some(
        (r) =>
          r.contactId === cid &&
          r.lens === "pipeline" &&
          !r.archivedAt,
      );
      if (hasRow) continue;
      const c = contactById.get(cid);
      const companyName = c?.company?.name ?? "Account";
      inputs.push({
        type: "NEW_ROW",
        dedupeKey: `meeting-prep-${m.id}-${cid}`,
        rank: 80 + start.getTime() / 1e12,
        title: `Add pipeline item for ${c?.name ?? "contact"}`,
        subtitle: `${companyName} · ${m.title}`,
        whyLine: `Upcoming meeting ${start.toLocaleDateString()} — capture a working title and next step.`,
        payload: {
          lens: "PIPELINE",
          stage: defaultStageForLens("pipeline"),
          title: m.title,
          contactId: cid,
          companyId: c?.companyId ?? null,
          provenance: "system",
        },
      });
    }
  }

  for (const r of rows) {
    if (r.confirmationStatus !== "CONFIRMED" || r.archivedAt) continue;
    const updated = new Date(r.updatedAt);
    const staleCut = addDays(updated, STALE_DAYS);
    if (isAfter(now, staleCut)) {
      inputs.push({
        type: "HYGIENE",
        targetRowId: r.id,
        dedupeKey: `stale-${r.id}`,
        rank: 20,
        title: `Still active? — ${r.title}`,
        subtitle: null,
        whyLine: `No updates for ${STALE_DAYS}+ days since ${updated.toLocaleDateString()}.`,
        payload: { action: "archive_or_refresh", rowId: r.id },
      });
    }
  }

  if (inputs.length > 0) {
    await pipelineRepo.upsertSuggestionsByDedupeKey(partnerId, inputs);
  }
}

export function validateStageForLens(
  lens: "pipeline" | "clients",
  stage: string,
): boolean {
  if (lens === "pipeline") {
    return (
      stage === "active_engagements" ||
      stage === "lops_in_discussion" ||
      stage === "serious_discussions"
    );
  }
  return (
    stage === "active_clients" ||
    stage === "warm_relationships" ||
    stage === "under_cultivation"
  );
}

export function parseLensFromPayload(
  raw: unknown,
): "pipeline" | "clients" | null {
  if (raw === "PIPELINE" || raw === "pipeline") return "pipeline";
  if (raw === "CLIENTS" || raw === "clients") return "clients";
  return null;
}

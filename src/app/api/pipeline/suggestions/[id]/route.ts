import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { addDays } from "date-fns";
import { lensSlugToPrisma } from "@/lib/pipeline/lens";
import { defaultStageForLens } from "@/lib/pipeline/stages";
import { pipelineRepo } from "@/lib/repositories";
import {
  parseLensFromPayload,
  validateStageForLens,
} from "@/lib/services/pipeline-suggestions-service";

type Body = {
  action?: string;
  snoozeDays?: number;
};

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await ctx.params;
    const body = (await request.json()) as Body;
    const action = body.action;

    const suggestion = await pipelineRepo.getSuggestion(id, partnerId);
    if (!suggestion) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const outcome = async (detail: Record<string, unknown>) => {
      await pipelineRepo.appendEvent(partnerId, {
        rowId: suggestion.targetRowId,
        eventType: "SUGGESTION_OUTCOME",
        payload: { suggestionId: id, action, ...detail },
      });
    };

    if (action === "dismiss") {
      let dismissedSnapshot: string | null = null;
      if (suggestion.targetRowId) {
        const row = await pipelineRepo.findRowById(
          suggestion.targetRowId,
          partnerId,
        );
        if (row) {
          dismissedSnapshot = JSON.stringify({
            rowUpdatedAt: row.updatedAt,
          });
        }
      }
      await pipelineRepo.updateSuggestion(id, partnerId, {
        status: "dismissed",
        dismissedSnapshot,
      });
      await outcome({ result: "dismissed" });
      return NextResponse.json({ ok: true });
    }

    if (action === "snooze") {
      const days = body.snoozeDays && body.snoozeDays > 0 ? body.snoozeDays : 7;
      const until = addDays(new Date(), days);
      await pipelineRepo.updateSuggestion(id, partnerId, {
        status: "snoozed",
        snoozedUntil: until,
      });
      await outcome({ result: "snoozed", until: until.toISOString() });
      return NextResponse.json({ ok: true, snoozedUntil: until.toISOString() });
    }

    if (action === "accept") {
      const p = suggestion.payload;
      if (suggestion.type === "NEW_ROW") {
        const lensSlug = parseLensFromPayload(p.lens) ?? "pipeline";
        const stageRaw = typeof p.stage === "string" ? p.stage : undefined;
        const stage =
          stageRaw && validateStageForLens(lensSlug, stageRaw)
            ? stageRaw
            : defaultStageForLens(lensSlug);
        const title =
          typeof p.title === "string" && p.title.trim().length > 0
            ? p.title.trim()
            : suggestion.title;
        const prov = p.provenance;
        const provenance =
          prov === "manual" || prov === "system" || prov === "voice" || prov === "upload"
            ? prov
            : "system";
        await pipelineRepo.createRow(partnerId, {
          lens: lensSlugToPrisma(lensSlug),
          stage,
          title,
          companyId: typeof p.companyId === "string" ? p.companyId : null,
          contactId: typeof p.contactId === "string" ? p.contactId : null,
          nextStep: typeof p.nextStep === "string" ? p.nextStep : null,
          provenance,
          confirmationStatus: "CONFIRMED",
        });
      } else if (suggestion.type === "STAGE_MOVE" && suggestion.targetRowId) {
        const toStage =
          typeof p.toStage === "string" ? p.toStage : undefined;
        const row = await pipelineRepo.findRowById(
          suggestion.targetRowId,
          partnerId,
        );
        if (!row || !toStage || !validateStageForLens(row.lens, toStage)) {
          return NextResponse.json(
            { error: "Invalid stage move" },
            { status: 400 },
          );
        }
        await pipelineRepo.setStage(suggestion.targetRowId, partnerId, toStage);
      } else if (suggestion.type === "HYGIENE" && suggestion.targetRowId) {
        await pipelineRepo.archiveRow(suggestion.targetRowId, partnerId, null);
      } else {
        return NextResponse.json({ error: "Invalid suggestion" }, { status: 400 });
      }

      await pipelineRepo.updateSuggestion(id, partnerId, { status: "accepted" });
      await outcome({ result: "accepted" });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[pipeline/suggestions PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

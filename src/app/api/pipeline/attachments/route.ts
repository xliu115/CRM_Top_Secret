import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import {
  PIPELINE_UPLOAD_MAX_BYTES,
  PIPELINE_UPLOAD_MIME_ALLOWLIST,
} from "@/lib/pipeline/constants";
import { pipelineRepo } from "@/lib/repositories";

export async function POST(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();
    const formData = await request.formData();
    const rowId = formData.get("rowId");
    const file = formData.get("file");
    if (typeof rowId !== "string" || !rowId) {
      return NextResponse.json({ error: "rowId required" }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (file.size > PIPELINE_UPLOAD_MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }
    const mime = file.type || "application/octet-stream";
    if (
      !(PIPELINE_UPLOAD_MIME_ALLOWLIST as readonly string[]).includes(mime)
    ) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const row = await pipelineRepo.findRowById(rowId, partnerId);
    if (!row) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 200);
    const relDir = path.join("uploads", "pipeline", partnerId);
    const absDir = path.join(process.cwd(), relDir);
    await mkdir(absDir, { recursive: true });
    const key = `${randomUUID()}-${safeName}`;
    const absPath = path.join(absDir, key);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(absPath, buf);

    const storageKey = path.join(relDir, key);
    const created = await pipelineRepo.createAttachment({
      partnerId,
      rowId,
      fileName: safeName,
      mimeType: mime,
      sizeBytes: buf.length,
      storageKey,
    });

    return NextResponse.json({
      id: created.id,
      fileName: safeName,
      mimeType: mime,
      sizeBytes: buf.length,
      storageKey,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[pipeline/attachments]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

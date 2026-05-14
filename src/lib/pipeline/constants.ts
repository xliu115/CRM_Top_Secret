/** Idle before client may PATCH lastViewedAt (ms). Spec §11; partner may also use explicit mark-seen. */
export const PIPELINE_LAST_VIEWED_IDLE_MS = 10 * 60 * 1000;

export const PIPELINE_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

export const PIPELINE_UPLOAD_MIME_ALLOWLIST = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export const STAGE_UNDO_WINDOW_MS = 2 * 60 * 1000;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "disabled_nudge_types" TEXT;
ALTER TABLE "contacts" ADD COLUMN "stale_threshold_days" INTEGER;

-- AlterTable
ALTER TABLE "nudges" ADD COLUMN "metadata" TEXT;

-- CreateTable
CREATE TABLE "nudge_rule_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partner_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "stale_contact_enabled" BOOLEAN NOT NULL DEFAULT true,
    "job_change_enabled" BOOLEAN NOT NULL DEFAULT true,
    "company_news_enabled" BOOLEAN NOT NULL DEFAULT true,
    "upcoming_event_enabled" BOOLEAN NOT NULL DEFAULT true,
    "meeting_prep_enabled" BOOLEAN NOT NULL DEFAULT true,
    "event_attended_enabled" BOOLEAN NOT NULL DEFAULT true,
    "event_registered_enabled" BOOLEAN NOT NULL DEFAULT true,
    "article_read_enabled" BOOLEAN NOT NULL DEFAULT true,
    "linkedin_activity_enabled" BOOLEAN NOT NULL DEFAULT true,
    "stale_days_critical" INTEGER NOT NULL DEFAULT 30,
    "stale_days_high" INTEGER NOT NULL DEFAULT 45,
    "stale_days_medium" INTEGER NOT NULL DEFAULT 60,
    "stale_days_low" INTEGER NOT NULL DEFAULT 90,
    CONSTRAINT "nudge_rule_configs_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_meeting_attendees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meeting_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "meeting_attendees_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "meeting_attendees_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_meeting_attendees" ("contact_id", "id", "meeting_id") SELECT "contact_id", "id", "meeting_id" FROM "meeting_attendees";
DROP TABLE "meeting_attendees";
ALTER TABLE "new_meeting_attendees" RENAME TO "meeting_attendees";
CREATE INDEX "meeting_attendees_contact_id_idx" ON "meeting_attendees"("contact_id");
CREATE UNIQUE INDEX "meeting_attendees_meeting_id_contact_id_key" ON "meeting_attendees"("meeting_id", "contact_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "nudge_rule_configs_partner_id_key" ON "nudge_rule_configs"("partner_id");

-- CreateIndex
CREATE INDEX "meetings_partner_id_start_time_idx" ON "meetings"("partner_id", "start_time");

-- CreateIndex
CREATE INDEX "nudges_contact_id_status_idx" ON "nudges"("contact_id", "status");

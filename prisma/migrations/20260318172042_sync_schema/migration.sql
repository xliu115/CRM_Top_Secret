-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "stale_threshold_days" INTEGER;

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
    "stale_days_critical" INTEGER NOT NULL DEFAULT 30,
    "stale_days_high" INTEGER NOT NULL DEFAULT 45,
    "stale_days_medium" INTEGER NOT NULL DEFAULT 60,
    "stale_days_low" INTEGER NOT NULL DEFAULT 90,
    CONSTRAINT "nudge_rule_configs_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "nudge_rule_configs_partner_id_key" ON "nudge_rule_configs"("partner_id");

-- CreateIndex
CREATE INDEX "meeting_attendees_contact_id_idx" ON "meeting_attendees"("contact_id");

-- CreateIndex
CREATE INDEX "meetings_partner_id_start_time_idx" ON "meetings"("partner_id", "start_time");

-- CreateIndex
CREATE INDEX "nudges_contact_id_status_idx" ON "nudges"("contact_id", "status");

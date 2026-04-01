-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "image_url" TEXT,
    "practice" TEXT,
    "published_at" DATETIME,
    "event_date" DATETIME,
    "event_location" TEXT,
    "event_type" TEXT,
    "source_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body_template" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ACTIVATE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "segment_criteria" TEXT,
    "sent_at" DATETIME,
    "send_started_at" DATETIME,
    "last_error" TEXT,
    "imported_from" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "campaigns_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_contents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "campaign_contents_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_contents_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaign_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "unmatched_email" TEXT,
    "personalized_body" TEXT,
    "rsvp_token" TEXT,
    "rsvp_status" TEXT,
    "rsvp_responded_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "failure_reason" TEXT,
    "sent_at" DATETIME,
    CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_recipients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_engagements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipient_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content_item_id" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    CONSTRAINT "campaign_engagements_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "campaign_recipients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_engagements_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "content_items_type_idx" ON "content_items"("type");

-- CreateIndex
CREATE INDEX "content_items_practice_idx" ON "content_items"("practice");

-- CreateIndex
CREATE INDEX "content_items_source_id_idx" ON "content_items"("source_id");

-- CreateIndex
CREATE INDEX "campaigns_partner_id_idx" ON "campaigns"("partner_id");

-- CreateIndex
CREATE INDEX "campaigns_partner_id_status_idx" ON "campaigns"("partner_id", "status");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaign_contents_campaign_id_idx" ON "campaign_contents"("campaign_id");

-- CreateIndex
CREATE INDEX "campaign_contents_content_item_id_idx" ON "campaign_contents"("content_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_contents_campaign_id_content_item_id_key" ON "campaign_contents"("campaign_id", "content_item_id");

-- CreateIndex
CREATE INDEX "campaign_recipients_campaign_id_idx" ON "campaign_recipients"("campaign_id");

-- CreateIndex
CREATE INDEX "campaign_recipients_contact_id_idx" ON "campaign_recipients"("contact_id");

-- CreateIndex
CREATE INDEX "campaign_recipients_campaign_id_status_idx" ON "campaign_recipients"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "campaign_recipients_rsvp_token_idx" ON "campaign_recipients"("rsvp_token");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_campaign_id_contact_id_key" ON "campaign_recipients"("campaign_id", "contact_id");

-- CreateIndex
CREATE INDEX "campaign_engagements_recipient_id_idx" ON "campaign_engagements"("recipient_id");

-- CreateIndex
CREATE INDEX "campaign_engagements_recipient_id_type_idx" ON "campaign_engagements"("recipient_id", "type");

-- CreateIndex
CREATE INDEX "campaign_engagements_content_item_id_idx" ON "campaign_engagements"("content_item_id");

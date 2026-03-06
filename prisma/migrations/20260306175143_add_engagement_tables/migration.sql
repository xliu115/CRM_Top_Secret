-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contact_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Registered',
    "event_date" DATETIME NOT NULL,
    "practice" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'In-person',
    "event_size" TEXT,
    "location" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_registrations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_engagements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contact_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "article_sent" TEXT NOT NULL DEFAULT 'Y',
    "views" INTEGER NOT NULL DEFAULT 0,
    "sent_from" TEXT,
    "last_view_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "article_engagements_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_outreaches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contact_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Sent',
    "status_date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_outreaches_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "event_registrations_contact_id_idx" ON "event_registrations"("contact_id");

-- CreateIndex
CREATE INDEX "article_engagements_contact_id_idx" ON "article_engagements"("contact_id");

-- CreateIndex
CREATE INDEX "campaign_outreaches_contact_id_idx" ON "campaign_outreaches"("contact_id");

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "employee_count" INTEGER NOT NULL,
    "website" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partner_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phone" TEXT,
    "importance" TEXT NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "last_contacted" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contacts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contact_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "summary" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "next_step" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "interactions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "external_signals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contact_id" TEXT,
    "company_id" TEXT,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.8,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_signals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "external_signals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "nudges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contact_id" TEXT NOT NULL,
    "signal_id" TEXT,
    "rule_type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "generated_email" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nudges_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "nudges_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "external_signals" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partner_id" TEXT NOT NULL,
    "start_time" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "notes" TEXT,
    "generated_brief" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meetings_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_attendees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meeting_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    CONSTRAINT "meeting_attendees_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "meeting_attendees_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "partners_email_key" ON "partners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "contacts_partner_id_idx" ON "contacts"("partner_id");

-- CreateIndex
CREATE INDEX "contacts_company_id_idx" ON "contacts"("company_id");

-- CreateIndex
CREATE INDEX "interactions_contact_id_idx" ON "interactions"("contact_id");

-- CreateIndex
CREATE INDEX "interactions_date_idx" ON "interactions"("date");

-- CreateIndex
CREATE INDEX "external_signals_contact_id_idx" ON "external_signals"("contact_id");

-- CreateIndex
CREATE INDEX "external_signals_company_id_idx" ON "external_signals"("company_id");

-- CreateIndex
CREATE INDEX "external_signals_date_idx" ON "external_signals"("date");

-- CreateIndex
CREATE INDEX "nudges_contact_id_idx" ON "nudges"("contact_id");

-- CreateIndex
CREATE INDEX "nudges_status_idx" ON "nudges"("status");

-- CreateIndex
CREATE INDEX "nudges_priority_idx" ON "nudges"("priority");

-- CreateIndex
CREATE INDEX "meetings_partner_id_idx" ON "meetings"("partner_id");

-- CreateIndex
CREATE INDEX "meetings_start_time_idx" ON "meetings"("start_time");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendees_meeting_id_contact_id_key" ON "meeting_attendees"("meeting_id", "contact_id");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_contacts" (
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
    "stale_threshold_days" INTEGER,
    "is_top" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contacts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_contacts" ("company_id", "created_at", "email", "id", "importance", "last_contacted", "name", "notes", "partner_id", "phone", "stale_threshold_days", "title") SELECT "company_id", "created_at", "email", "id", "importance", "last_contacted", "name", "notes", "partner_id", "phone", "stale_threshold_days", "title" FROM "contacts";
DROP TABLE "contacts";
ALTER TABLE "new_contacts" RENAME TO "contacts";
CREATE INDEX "contacts_partner_id_idx" ON "contacts"("partner_id");
CREATE INDEX "contacts_company_id_idx" ON "contacts"("company_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

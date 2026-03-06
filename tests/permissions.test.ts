import { describe, it, expect } from "vitest";

/**
 * Tests for partner-scoped data access (permission model).
 * These test the logic that ensures partners only see their own data.
 */

interface Contact {
  id: string;
  partnerId: string;
  name: string;
}

interface Nudge {
  id: string;
  contactId: string;
}

function filterContactsByPartner(
  contacts: Contact[],
  partnerId: string
): Contact[] {
  return contacts.filter((c) => c.partnerId === partnerId);
}

function canPartnerAccessContact(
  contact: Contact,
  partnerId: string
): boolean {
  return contact.partnerId === partnerId;
}

function filterNudgesByPartner(
  nudges: Nudge[],
  contacts: Contact[],
  partnerId: string
): Nudge[] {
  const partnerContactIds = new Set(
    contacts.filter((c) => c.partnerId === partnerId).map((c) => c.id)
  );
  return nudges.filter((n) => partnerContactIds.has(n.contactId));
}

describe("Permission / Access Control", () => {
  const contacts: Contact[] = [
    { id: "ct-001", partnerId: "p-ava", name: "Sarah Mitchell" },
    { id: "ct-002", partnerId: "p-ava", name: "David Park" },
    { id: "ct-003", partnerId: "p-jordan", name: "Thomas Grant" },
    { id: "ct-004", partnerId: "p-jordan", name: "Sophia Martinez" },
    { id: "ct-005", partnerId: "p-sam", name: "William Chen" },
  ];

  const nudges: Nudge[] = [
    { id: "n-001", contactId: "ct-001" },
    { id: "n-002", contactId: "ct-002" },
    { id: "n-003", contactId: "ct-003" },
    { id: "n-004", contactId: "ct-004" },
    { id: "n-005", contactId: "ct-005" },
  ];

  describe("Contact Scoping", () => {
    it("should only return contacts belonging to the partner", () => {
      const avaContacts = filterContactsByPartner(contacts, "p-ava");
      expect(avaContacts).toHaveLength(2);
      expect(avaContacts.map((c) => c.name)).toEqual([
        "Sarah Mitchell",
        "David Park",
      ]);
    });

    it("should return empty for unknown partner", () => {
      const result = filterContactsByPartner(contacts, "p-unknown");
      expect(result).toHaveLength(0);
    });

    it("should not leak contacts across partners", () => {
      const jordanContacts = filterContactsByPartner(contacts, "p-jordan");
      expect(jordanContacts.every((c) => c.partnerId === "p-jordan")).toBe(
        true
      );
      expect(
        jordanContacts.some((c) => c.partnerId === "p-ava")
      ).toBe(false);
    });
  });

  describe("Contact Access Check", () => {
    it("should allow access to own contact", () => {
      expect(canPartnerAccessContact(contacts[0], "p-ava")).toBe(true);
    });

    it("should deny access to another partner's contact", () => {
      expect(canPartnerAccessContact(contacts[0], "p-jordan")).toBe(false);
    });
  });

  describe("Nudge Scoping", () => {
    it("should only return nudges for partner's contacts", () => {
      const avaNudges = filterNudgesByPartner(nudges, contacts, "p-ava");
      expect(avaNudges).toHaveLength(2);
      expect(avaNudges.map((n) => n.id)).toEqual(["n-001", "n-002"]);
    });

    it("should not include nudges for other partners' contacts", () => {
      const samNudges = filterNudgesByPartner(nudges, contacts, "p-sam");
      expect(samNudges).toHaveLength(1);
      expect(samNudges[0].id).toBe("n-005");
    });

    it("should return empty for partner with no contacts", () => {
      const result = filterNudgesByPartner(nudges, contacts, "p-nobody");
      expect(result).toHaveLength(0);
    });
  });
});

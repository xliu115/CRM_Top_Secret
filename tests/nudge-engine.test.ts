import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the nudge rule logic in isolation by extracting the core decision functions

function daysSince(date: Date): number {
  return Math.floor(
    (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
}

interface Contact {
  id: string;
  name: string;
  title: string;
  importance: string;
  company: { name: string };
}

interface Interaction {
  id: string;
  date: Date;
  type: string;
  summary: string;
}

interface Signal {
  id: string;
  type: string;
  date: Date;
  content: string;
}

interface Meeting {
  id: string;
  title: string;
  startTime: Date;
}

function shouldNudgeStaleContact(
  contact: Contact,
  lastInteraction: Interaction | null
): { shouldNudge: boolean; priority: string; reason: string } | null {
  const days = lastInteraction ? daysSince(lastInteraction.date) : 999;

  if (days > 90) {
    return {
      shouldNudge: true,
      priority:
        contact.importance === "CRITICAL" ? "URGENT" : "HIGH",
      reason: `No interaction with ${contact.name} in ${days} days.`,
    };
  }
  if (days > 60) {
    return {
      shouldNudge: true,
      priority:
        contact.importance === "CRITICAL" || contact.importance === "HIGH"
          ? "HIGH"
          : "MEDIUM",
      reason: `It's been ${days} days since last interaction with ${contact.name}.`,
    };
  }
  if (
    days > 30 &&
    (contact.importance === "CRITICAL" || contact.importance === "HIGH")
  ) {
    return {
      shouldNudge: true,
      priority: "MEDIUM",
      reason: `${days} days since last touchpoint with ${contact.name}.`,
    };
  }
  return null;
}

function shouldNudgeJobChange(
  contact: Contact,
  signals: Signal[]
): { shouldNudge: boolean; signalId: string; reason: string } | null {
  const recentJobChange = signals.find(
    (s) => s.type === "JOB_CHANGE" && daysSince(s.date) < 30
  );
  if (recentJobChange) {
    return {
      shouldNudge: true,
      signalId: recentJobChange.id,
      reason: `${contact.name} had a recent role change.`,
    };
  }
  return null;
}

function shouldNudgeCompanyNews(
  contact: Contact,
  signals: Signal[]
): { shouldNudge: boolean; signalId: string } | null {
  const recentNews = signals.find(
    (s) => s.type === "NEWS" && daysSince(s.date) < 14
  );
  if (recentNews) {
    return { shouldNudge: true, signalId: recentNews.id };
  }
  return null;
}

function shouldNudgeMeetingPrep(
  contact: Contact,
  meetings: Meeting[]
): { shouldNudge: boolean; meetingTitle: string } | null {
  const now = new Date();
  const upcoming = meetings.find((m) => {
    const daysUntil = Math.floor(
      (m.startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntil >= 0 && daysUntil <= 3;
  });
  if (upcoming) {
    return { shouldNudge: true, meetingTitle: upcoming.title };
  }
  return null;
}

describe("Nudge Engine Rules", () => {
  const contact: Contact = {
    id: "ct-001",
    name: "Sarah Mitchell",
    title: "CIO",
    importance: "CRITICAL",
    company: { name: "Microsoft" },
  };

  describe("Stale Contact Rule", () => {
    it("should nudge when no interaction in 90+ days with URGENT for CRITICAL contacts", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      const result = shouldNudgeStaleContact(contact, {
        id: "int-001",
        date: oldDate,
        type: "EMAIL",
        summary: "test",
      });
      expect(result).not.toBeNull();
      expect(result!.shouldNudge).toBe(true);
      expect(result!.priority).toBe("URGENT");
    });

    it("should nudge HIGH priority for non-CRITICAL contacts at 90+ days", () => {
      const medContact = { ...contact, importance: "MEDIUM" };
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 95);
      const result = shouldNudgeStaleContact(medContact, {
        id: "int-001",
        date: oldDate,
        type: "EMAIL",
        summary: "test",
      });
      expect(result).not.toBeNull();
      expect(result!.priority).toBe("HIGH");
    });

    it("should nudge at 60+ days", () => {
      const date = new Date();
      date.setDate(date.getDate() - 65);
      const result = shouldNudgeStaleContact(contact, {
        id: "int-001",
        date,
        type: "CALL",
        summary: "test",
      });
      expect(result).not.toBeNull();
      expect(result!.shouldNudge).toBe(true);
    });

    it("should nudge HIGH/CRITICAL contacts at 30+ days", () => {
      const date = new Date();
      date.setDate(date.getDate() - 35);
      const result = shouldNudgeStaleContact(contact, {
        id: "int-001",
        date,
        type: "CALL",
        summary: "test",
      });
      expect(result).not.toBeNull();
      expect(result!.priority).toBe("MEDIUM");
    });

    it("should NOT nudge LOW importance contacts at 30 days", () => {
      const lowContact = { ...contact, importance: "LOW" };
      const date = new Date();
      date.setDate(date.getDate() - 35);
      const result = shouldNudgeStaleContact(lowContact, {
        id: "int-001",
        date,
        type: "CALL",
        summary: "test",
      });
      expect(result).toBeNull();
    });

    it("should NOT nudge for recent interactions", () => {
      const date = new Date();
      date.setDate(date.getDate() - 10);
      const result = shouldNudgeStaleContact(contact, {
        id: "int-001",
        date,
        type: "EMAIL",
        summary: "test",
      });
      expect(result).toBeNull();
    });

    it("should nudge URGENT when no interaction at all", () => {
      const result = shouldNudgeStaleContact(contact, null);
      expect(result).not.toBeNull();
      expect(result!.priority).toBe("URGENT");
    });
  });

  describe("Job Change Rule", () => {
    it("should nudge on recent job change signal", () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);
      const result = shouldNudgeJobChange(contact, [
        {
          id: "sig-001",
          type: "JOB_CHANGE",
          date: recentDate,
          content: "Promoted to SVP",
        },
      ]);
      expect(result).not.toBeNull();
      expect(result!.shouldNudge).toBe(true);
      expect(result!.signalId).toBe("sig-001");
    });

    it("should NOT nudge on old job change signal", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 45);
      const result = shouldNudgeJobChange(contact, [
        {
          id: "sig-001",
          type: "JOB_CHANGE",
          date: oldDate,
          content: "Old change",
        },
      ]);
      expect(result).toBeNull();
    });

    it("should NOT nudge when no job change signals", () => {
      const result = shouldNudgeJobChange(contact, [
        {
          id: "sig-001",
          type: "NEWS",
          date: new Date(),
          content: "Company news",
        },
      ]);
      expect(result).toBeNull();
    });
  });

  describe("Company News Rule", () => {
    it("should nudge on recent company news", () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7);
      const result = shouldNudgeCompanyNews(contact, [
        {
          id: "sig-002",
          type: "NEWS",
          date: recentDate,
          content: "Microsoft acquires startup",
        },
      ]);
      expect(result).not.toBeNull();
      expect(result!.shouldNudge).toBe(true);
    });

    it("should NOT nudge on old news", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20);
      const result = shouldNudgeCompanyNews(contact, [
        {
          id: "sig-002",
          type: "NEWS",
          date: oldDate,
          content: "Old news",
        },
      ]);
      expect(result).toBeNull();
    });
  });

  describe("Meeting Prep Rule", () => {
    it("should nudge when meeting is within 3 days", () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 2);
      const result = shouldNudgeMeetingPrep(contact, [
        { id: "mtg-001", title: "QBR with Microsoft", startTime: soon },
      ]);
      expect(result).not.toBeNull();
      expect(result!.shouldNudge).toBe(true);
      expect(result!.meetingTitle).toBe("QBR with Microsoft");
    });

    it("should NOT nudge when meeting is far away", () => {
      const farAway = new Date();
      farAway.setDate(farAway.getDate() + 15);
      const result = shouldNudgeMeetingPrep(contact, [
        { id: "mtg-001", title: "Future meeting", startTime: farAway },
      ]);
      expect(result).toBeNull();
    });

    it("should NOT nudge for past meetings", () => {
      const past = new Date();
      past.setDate(past.getDate() - 2);
      const result = shouldNudgeMeetingPrep(contact, [
        { id: "mtg-001", title: "Past meeting", startTime: past },
      ]);
      expect(result).toBeNull();
    });
  });
});

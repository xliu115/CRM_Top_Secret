import { describe, it, expect } from "vitest";
import {
  buildEmailDraftActionBar,
  buildNudgeActionActionBar,
  buildMeetingBriefActionBar,
} from "@/lib/services/mobile-action-bars";

describe("buildEmailDraftActionBar", () => {
  it("primary is Send Email, secondary is Edit, tertiary has Warmer/Shorter/Copy", () => {
    const bar = buildEmailDraftActionBar({
      contactName: "Ted Sarandos",
    });
    expect(bar.primary.label).toBe("Send Email");
    expect(bar.primary.icon).toBe("send");
    expect(bar.secondary.map((s) => s.label)).toEqual(["Edit"]);
    expect(bar.secondary[0]?.query).toBe("__edit_email__");
    expect(bar.tertiary?.map((t) => t.label)).toEqual(["Warmer", "Shorter", "Copy"]);
    expect(bar.variant).toBe("default");
  });

  it("Send Email query mentions the contact name", () => {
    const bar = buildEmailDraftActionBar({ contactName: "Ted Sarandos" });
    expect(bar.primary.query).toContain("Ted Sarandos");
  });

  it("Copy tertiary action uses the __copy_email__ sentinel", () => {
    const bar = buildEmailDraftActionBar({ contactName: "Ted Sarandos" });
    const copy = bar.tertiary?.find((t) => t.label === "Copy");
    expect(copy?.query).toBe("__copy_email__");
  });
});

describe("buildNudgeActionActionBar", () => {
  it("includes Dismiss and Snooze in tertiary", () => {
    const bar = buildNudgeActionActionBar({ contactName: "Ted Sarandos" });
    const tertiaryLabels = bar.tertiary?.map((t) => t.label) ?? [];
    expect(tertiaryLabels).toContain("Dismiss");
    expect(tertiaryLabels).toContain("Snooze");
    expect(tertiaryLabels).toContain("Warmer");
  });

  it("primary is Send Email, secondary is Edit", () => {
    const bar = buildNudgeActionActionBar({ contactName: "Ted Sarandos" });
    expect(bar.primary.label).toBe("Send Email");
    expect(bar.secondary[0]?.label).toBe("Edit");
  });
});

describe("buildMeetingBriefActionBar", () => {
  it("collapsed: primary=View full brief, secondary=Draft Email", () => {
    const bar = buildMeetingBriefActionBar({
      expanded: false,
      firstAttendeeName: "Ted Sarandos",
    });
    expect(bar.primary.label).toBe("View full brief");
    expect(bar.secondary[0]?.label).toBe("Draft Email");
  });

  it("expanded: primary=Draft Email, secondary=Hide full brief", () => {
    const bar = buildMeetingBriefActionBar({
      expanded: true,
      firstAttendeeName: "Ted Sarandos",
    });
    expect(bar.primary.label).toBe("Draft Email");
    expect(bar.secondary[0]?.label).toBe("Hide full brief");
  });

  it("Draft Email query targets the first attendee", () => {
    const bar = buildMeetingBriefActionBar({
      expanded: false,
      firstAttendeeName: "Ted Sarandos",
    });
    expect(bar.secondary[0]?.query).toContain("Ted Sarandos");
  });

  it("no firstAttendeeName: omits Draft Email secondary", () => {
    const bar = buildMeetingBriefActionBar({ expanded: false });
    expect(bar.secondary).toEqual([]);
  });

  it("collapsed: View full brief uses the __toggle_brief__ sentinel", () => {
    const bar = buildMeetingBriefActionBar({
      expanded: false,
      firstAttendeeName: "Ted Sarandos",
    });
    expect(bar.primary.query).toBe("__toggle_brief__");
  });

  it("expanded: Hide full brief uses the __toggle_brief__ sentinel", () => {
    const bar = buildMeetingBriefActionBar({
      expanded: true,
      firstAttendeeName: "Ted Sarandos",
    });
    expect(bar.secondary[0]?.query).toBe("__toggle_brief__");
  });

  it("expanded with no firstAttendeeName: primary uses generic Draft Email fallback", () => {
    const bar = buildMeetingBriefActionBar({ expanded: true });
    expect(bar.primary.label).toBe("Draft Email");
    expect(bar.primary.query).not.toContain("undefined");
    expect(bar.primary.query.length).toBeGreaterThan(0);
  });
});

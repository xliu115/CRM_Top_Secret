import { describe, it, expect } from "vitest";
import {
  extractTopOfMind,
  synthesizeBrief,
} from "@/lib/utils/meeting-brief-synthesis";
import type { StructuredBrief } from "@/lib/types/structured-brief";

function makeBrief(overrides: Partial<StructuredBrief> = {}): StructuredBrief {
  return {
    version: 1,
    meetingGoal: { statement: "", successCriteria: "" },
    primaryContactProfile: { name: "Eddy Cue", bullets: [] },
    conversationStarters: [],
    newsInsights: [],
    executiveProfile: {
      bioSummary: "",
      recentMoves: [],
    },
    relationshipHistory: {
      temperature: "WARM",
      summary: "",
      engagements: [],
    },
    attendees: [],
    ...overrides,
  };
}

describe("synthesizeBrief", () => {
  it("leads with topOfMind first sentence when it's specific", () => {
    const brief = makeBrief({
      executiveProfile: {
        bioSummary: "",
        recentMoves: [],
        topOfMind:
          "Eddy is shepherding the Apple Intelligence rollout while John Ternus' incoming CEO transition reshapes hardware-AI priorities. The board wants speed without compromising the on-device privacy story. Outside help that compresses platform delivery time would land.",
      },
      meetingGoal: {
        statement: "Review active deals and identify acceleration opportunities.",
        successCriteria: "Success = align on priorities.",
      },
    });
    const out = synthesizeBrief(brief);
    expect(out.split("\n\n")[0]).toContain("Apple Intelligence");
    expect(out.split("\n\n")[0]).toContain("Ternus");
    expect(out).not.toContain("Review active deals");
  });

  it("filters out generic goal statements when no topOfMind exists", () => {
    const brief = makeBrief({
      meetingGoal: {
        statement: "Review active deals and identify acceleration opportunities.",
        successCriteria: "Success = TBD.",
      },
    });
    const out = synthesizeBrief(brief);
    expect(out).not.toContain("Review active deals and identify acceleration opportunities");
  });

  it("filters out generic conversation starters", () => {
    const brief = makeBrief({
      meetingGoal: {
        statement: "Pressure-test Apple's hardware-led AI bet with Eddy.",
        successCriteria: "Success = one acceleration play.",
      },
      conversationStarters: [
        {
          question: "What are your top strategic priorities for the next quarter?",
          tacticalNote: "Generic.",
        },
      ],
    });
    const out = synthesizeBrief(brief);
    expect(out).not.toContain("top strategic priorities");
  });

  it("keeps a specific conversation starter that references concrete signals", () => {
    const brief = makeBrief({
      meetingGoal: {
        statement: "Pressure-test Apple's hardware-led AI bet with Eddy Cue.",
        successCriteria: "Success = TBD.",
      },
      conversationStarters: [
        {
          question:
            "With John Ternus stepping in, what's the first 90-day bet on AI hardware you most want to land?",
          tacticalNote: "Anchors on the leadership change.",
        },
      ],
    });
    const out = synthesizeBrief(brief);
    expect(out).toContain("Ternus");
  });

  it("filters out generic relationship summaries (no numbers, no named contacts)", () => {
    const brief = makeBrief({
      meetingGoal: {
        statement: "Pressure-test Apple's hardware-led AI bet with Eddy Cue.",
        successCriteria: "Success = TBD.",
      },
      relationshipHistory: {
        temperature: "WARM",
        summary: "Regular engagement suggests a strong relationship foundation.",
        engagements: [],
      },
    });
    const out = synthesizeBrief(brief);
    expect(out.toLowerCase()).not.toContain("strong relationship foundation");
  });

  it("keeps a specific relationship summary with a number and a named contact", () => {
    const brief = makeBrief({
      meetingGoal: {
        statement: "Pressure-test Apple's hardware-led AI bet with Eddy Cue.",
        successCriteria: "Success = TBD.",
      },
      relationshipHistory: {
        temperature: "WARM",
        summary:
          "4 recent touches with Eddy (most recent 2026-04-10): co-led the operations review last quarter.",
        engagements: [],
      },
    });
    const out = synthesizeBrief(brief);
    expect(out).toContain("4 recent touches");
    expect(out).toContain("Eddy");
  });

  it("uses news-insight body as supporting paragraph when distinct from the lead", () => {
    const brief = makeBrief({
      executiveProfile: {
        bioSummary: "",
        recentMoves: [],
        topOfMind: "Eddy is balancing services growth against the Apple Intelligence rollout schedule.",
      },
      newsInsights: [
        {
          headline: "TERNUS PICK SIGNALS HARDWARE-LED AI BET",
          body:
            "Apple's choice of John Ternus as next CEO points at an integrated-silicon AI strategy. McKinsey can help map the partnership-vs-build trade-offs.",
        },
      ],
    });
    const out = synthesizeBrief(brief);
    expect(out.split("\n\n").length).toBeGreaterThanOrEqual(2);
    expect(out).toContain("Ternus");
  });

  it("does not duplicate when the news body substantially overlaps the lead", () => {
    const brief = makeBrief({
      executiveProfile: {
        bioSummary: "",
        recentMoves: [],
        topOfMind:
          "Apple's choice of John Ternus as next CEO points at an integrated-silicon AI strategy.",
      },
      newsInsights: [
        {
          headline: "TERNUS PICK SIGNALS HARDWARE-LED AI BET",
          body:
            "Apple's choice of John Ternus as next CEO points at an integrated-silicon AI strategy.",
        },
      ],
    });
    const out = synthesizeBrief(brief);
    expect((out.match(/Ternus/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("falls back to a primaryContactProfile bullet when topOfMind and news are missing", () => {
    const brief = makeBrief({
      primaryContactProfile: {
        name: "Eddy Cue",
        bullets: [
          {
            label: "Services architect",
            detail:
              "Drove the App Store and Apple TV+ economics; quietly the most influential voice in Cupertino on AI partnership terms.",
          },
        ],
      },
    });
    const out = synthesizeBrief(brief);
    expect(out).toContain("Services architect");
    expect(out).toContain("App Store");
  });

  it("returns an empty-ish string gracefully when nothing concrete exists", () => {
    const brief = makeBrief();
    const out = synthesizeBrief(brief);
    expect(out).toBe("");
  });

  it("does not include markdown bold (chat block renders plain text)", () => {
    const brief = makeBrief({
      executiveProfile: {
        bioSummary: "",
        recentMoves: [],
        topOfMind:
          "Eddy Cue is shepherding the Apple Intelligence rollout while Ternus' incoming CEO transition reshapes hardware-AI priorities.",
      },
    });
    const out = synthesizeBrief(brief);
    expect(out).not.toMatch(/\*\*/);
  });
});

describe("extractTopOfMind", () => {
  it("returns the full multi-sentence paragraph with the contact name", () => {
    const brief = makeBrief({
      primaryContactProfile: { name: "Eddy Cue", bullets: [] },
      executiveProfile: {
        bioSummary: "",
        recentMoves: [],
        topOfMind:
          "Eddy is currently focused on aligning Apple's strategic priorities for the upcoming year, especially in services and health. Recent discussions indicate a strong interest in expanding partnerships and exploring synergies in data analytics. These signals suggest he is looking for actionable strategies that can enhance collaboration and support Apple's growth objectives. This meeting is likely an opportunity for him to identify how we can accelerate these initiatives together.",
      },
    });
    const tom = extractTopOfMind(brief);
    expect(tom).not.toBeNull();
    expect(tom!.subjectName).toBe("Eddy Cue");
    expect(tom!.content).toContain("Eddy is currently focused");
    expect(tom!.content).toContain("partnerships");
    expect(tom!.content).toContain("growth objectives");
  });

  it("returns null when topOfMind is missing", () => {
    const brief = makeBrief();
    expect(extractTopOfMind(brief)).toBeNull();
  });

  it("returns null when topOfMind is too short", () => {
    const brief = makeBrief({
      executiveProfile: {
        bioSummary: "",
        recentMoves: [],
        topOfMind: "Big plans.",
      },
    });
    expect(extractTopOfMind(brief)).toBeNull();
  });

  it("falls back to attendee name when primaryContactProfile is empty", () => {
    const brief = makeBrief({
      primaryContactProfile: { name: "", bullets: [] },
      attendees: [{ name: "Eddy Cue", title: "SVP Services", initials: "EC" }],
      executiveProfile: {
        bioSummary: "",
        recentMoves: [],
        topOfMind:
          "Eddy is shepherding the Apple Intelligence rollout while reshaping hardware-AI priorities across the board. He's also signaling interest in deeper services partnerships.",
      },
    });
    const tom = extractTopOfMind(brief);
    expect(tom).not.toBeNull();
    expect(tom!.subjectName).toBe("Eddy Cue");
  });

  it("rejects all-generic topOfMind paragraphs", () => {
    const brief = makeBrief({
      executiveProfile: {
        bioSummary: "",
        recentMoves: [],
        topOfMind:
          "He's thinking about strategic priorities and biggest opportunities. Looking to partner more deeply on current deals.",
      },
    });
    expect(extractTopOfMind(brief)).toBeNull();
  });

  it("truncates very long content", () => {
    const long = Array(20)
      .fill(
        "Eddy is shepherding the Apple Intelligence rollout while Ternus' incoming CEO transition reshapes hardware-AI priorities.",
      )
      .join(" ");
    const brief = makeBrief({
      executiveProfile: { bioSummary: "", recentMoves: [], topOfMind: long },
    });
    const tom = extractTopOfMind(brief);
    expect(tom).not.toBeNull();
    expect(tom!.content.length).toBeLessThanOrEqual(700);
  });
});

describe("synthesizeBrief — markdown safety", () => {
  it("contains no markdown bold", () => {
    const brief = makeBrief({
      executiveProfile: {
        bioSummary: "",
        recentMoves: [],
        topOfMind:
          "Eddy Cue is shepherding the Apple Intelligence rollout while Ternus' incoming CEO transition reshapes hardware-AI priorities.",
      },
      relationshipHistory: {
        temperature: "WARM",
        summary:
          "4 recent touches with Eddy (most recent 2026-04-10): co-led the operations review last quarter.",
        engagements: [],
      },
    });
    const out = synthesizeBrief(brief);
    expect(out).not.toMatch(/\*\*/);
  });
});

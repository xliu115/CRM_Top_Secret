/**
 * Podcast-style spoken intro for the mobile morning briefing (TTS + on-screen).
 * Uses structured briefing data so counts stay in sync with the narrative.
 */

const NUM_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

function qty(n: number): string {
  if (n >= 1 && n <= 12) return NUM_WORDS[n];
  return String(n);
}

function joinForSpeech(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}, and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export type BriefingStructuredNudge = {
  contactName: string;
  company: string;
  contactId: string;
  ruleType?: string;
};

export type BriefingStructuredMeeting = {
  title: string;
  startTime: string;
  meetingId: string;
};

export type BriefingOpeningInput = {
  structured: {
    nudges: BriefingStructuredNudge[];
    meetings: BriefingStructuredMeeting[];
    news?: { content?: string }[];
  };
};

/**
 * Builds a short, listenable rundown (no markdown). Safe to prepend to TTS.
 */
export function buildBriefingSpokenOpening(
  data: BriefingOpeningInput,
  partnerFirstName: string,
): string {
  const nudges = data.structured?.nudges ?? [];
  const meetings = data.structured?.meetings ?? [];
  const news = data.structured?.news ?? [];

  const campaigns = nudges.filter((n) => n.ruleType === "CAMPAIGN_APPROVAL").length;
  const articles = nudges.filter((n) => n.ruleType === "ARTICLE_CAMPAIGN").length;
  const followUps = nudges.filter((n) => n.ruleType === "FOLLOW_UP").length;
  const contactReach = nudges.filter(
    (n) =>
      n.ruleType !== "CAMPAIGN_APPROVAL" &&
      n.ruleType !== "ARTICLE_CAMPAIGN" &&
      n.ruleType !== "FOLLOW_UP",
  ).length;

  const meetingCount = meetings.length;
  const newsCount = Array.isArray(news) ? news.filter((x) => x?.content?.trim()).length : 0;

  const name = partnerFirstName.trim() || "there";

  const headline = `${name}, here's your morning briefing from Activate.`;

  const bits: string[] = [];

  if (contactReach > 0) {
    bits.push(
      `${qty(contactReach)} ${contactReach === 1 ? "contact" : "contacts"} to reach out to`,
    );
  }
  if (campaigns > 0) {
    bits.push(`${qty(campaigns)} ${campaigns === 1 ? "campaign" : "campaigns"} to approve`);
  }
  if (articles > 0) {
    bits.push(
      `${qty(articles)} ${articles === 1 ? "article" : "articles"} to share with your network`,
    );
  }
  if (followUps > 0) {
    bits.push(
      `${qty(followUps)} follow-up${followUps === 1 ? "" : "s"} waiting on a reply from you`,
    );
  }
  if (meetingCount > 0) {
    bits.push(
      `${qty(meetingCount)} ${meetingCount === 1 ? "meeting" : "meetings"} on your calendar`,
    );
  }
  if (newsCount > 0) {
    bits.push(
      `${qty(newsCount)} ${newsCount === 1 ? "headline" : "headlines"} on the radar worth a listen`,
    );
  }

  if (bits.length === 0) {
    return `${headline} You're all caught up on alerts — it's a lighter day. I'll still walk you through anything we prepared.`;
  }

  const rundown = joinForSpeech(bits);
  return `${headline} Quick preview before we go deeper — you have ${rundown}.`;
}

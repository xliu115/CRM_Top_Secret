import { format } from "date-fns";

/** Strip markdown syntax and collapse whitespace so signal content renders as clean plain text. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, "")       // headings at line start
    .replace(/\s*—\s*#{1,6}\s+/g, " — ") // inline headings after em-dash (scraped news)
    .replace(/\*\*([^*]+)\*\*/g, "$1")  // **bold**
    .replace(/\*([^*]+)\*/g, "$1")      // *italic*
    .replace(/__([^_]+)__/g, "$1")      // __bold__
    .replace(/_([^_]+)_/g, "$1")        // _italic_
    .replace(/~~([^~]+)~~/g, "$1")      // ~~strike~~
    .replace(/`([^`]+)`/g, "$1")        // `code`
    .replace(/^\s*[-*+]\s+/gm, "")      // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, "")      // ordered list markers
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) and ![alt](url)
    .replace(/<[^>]+>/g, "")            // HTML tags
    .replace(/https?:\/\/\S+/g, "")     // bare URLs
    .replace(/\s[-–|]\s+[A-Z][\w\s&,.']+$/gm, "") // strip source attributions (e.g. " - The Motley Fool")
    .replace(/(?:^|\s)[*\-]\s/g, " ")   // stray list markers as literal characters
    .replace(/\n+/g, " ")              // newlines → spaces
    .replace(/\s{2,}/g, " ")           // collapse whitespace
    .trim();
}

/** Clean and truncate signal text for use in AI summaries. */
function cleanSnippet(s: string, maxLen = 120): string {
  let cleaned = stripMarkdown(s);

  // Deduplicate repeated phrases (common from scraped title + subtitle)
  const half = Math.ceil(cleaned.length / 2);
  for (let len = 20; len <= half; len++) {
    const prefix = cleaned.slice(0, len);
    const secondIdx = cleaned.indexOf(prefix, 1);
    if (secondIdx > 0 && secondIdx <= len + 10) {
      cleaned = cleaned.slice(0, secondIdx).trimEnd().replace(/[.\s\-–—:,]+$/, "") + " " + cleaned.slice(secondIdx + prefix.length).trimStart();
      cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
      break;
    }
  }

  if (cleaned.length <= maxLen) return cleaned;

  // Prefer cutting at a sentence boundary
  const sentenceEnd = cleaned.slice(0, maxLen).search(/[.!?]\s/);
  if (sentenceEnd > maxLen * 0.4) {
    return cleaned.slice(0, sentenceEnd + 1);
  }

  const cut = cleaned.lastIndexOf(" ", maxLen);
  let truncated = cleaned.slice(0, cut > 0 ? cut : maxLen);
  truncated = truncated.replace(/[.,;:\-–—\s]+$/, "");
  return truncated + "\u2026";
}

function naturalizeInteractionSummary(s: string): string {
  if (!s) return s;
  return s[0].toLowerCase() + s.slice(1);
}

export type InsightData = {
  type: string;
  reason: string;
  priority: string;
  signalId?: string;
  signalContent?: string;
  signalUrl?: string | null;
  relatedPartners?: { partnerId: string; partnerName: string }[];
  personName?: string;
  lastEmailSubject?: string;
  lastEmailSnippet?: string;
  inboundSummary?: string;
  waitingDays?: number;
  lastInteraction?: {
    type: string;
    date: string;
    summary: string;
  };
};

export type NudgeForSummary = {
  ruleType: string;
  reason: string;
  metadata?: string | null;
  contact: {
    name: string;
    company: { name: string };
  };
};

export type SentenceFragment = { text: string; bold?: boolean; lineBreak?: boolean };

export type CampaignApprovalNudgeDisplay = {
  campaignName: string;
  pendingCount: number;
  deadlineLabel: string | null;
  campaignHref: string;
};

/** Parsed campaign-centric fields for CAMPAIGN_APPROVAL nudge cards (metadata + reason fallbacks). */
export function parseCampaignApprovalNudgeDisplay(nudge: {
  reason: string;
  metadata?: string | null;
}): CampaignApprovalNudgeDisplay {
  let campaignId: string | undefined;
  let pendingCount: number | undefined;
  let deadlineIso: string | null | undefined;
  try {
    const m = JSON.parse(nudge.metadata ?? "{}") as {
      campaignId?: string;
      pendingCount?: number;
      deadline?: string | null;
    };
    if (typeof m.campaignId === "string") campaignId = m.campaignId;
    if (typeof m.pendingCount === "number") pendingCount = m.pendingCount;
    deadlineIso = m.deadline ?? undefined;
  } catch {
    /* ignore */
  }

  const nameMatch = nudge.reason.match(/Campaign "([^"]+)"/);
  const campaignName = nameMatch?.[1] ?? "Campaign";

  if (pendingCount === undefined) {
    const c = nudge.reason.match(/has (\d+) contacts?/);
    pendingCount = c ? parseInt(c[1], 10) : 0;
  }

  let deadlineLabel: string | null = null;
  if (deadlineIso) {
    const d = new Date(deadlineIso);
    if (!Number.isNaN(d.getTime())) {
      deadlineLabel = `Due ${format(d, "MMM d, yyyy")}`;
    }
  }
  if (!deadlineLabel) {
    const dm = nudge.reason.match(/\(due ([^)]+)\)/);
    if (dm) deadlineLabel = `Due ${dm[1].trim()}`;
  }

  const campaignHref = campaignId ? `/campaigns/${campaignId}` : "/campaigns";

  return { campaignName, pendingCount, deadlineLabel, campaignHref };
}

export type ArticleCampaignNudgeDisplay = {
  articleTitle: string;
  contentItemId: string | null;
  matchCount: number;
  campaignHref: string;
};

export function parseArticleCampaignNudgeDisplay(nudge: {
  reason: string;
  metadata?: string | null;
}): ArticleCampaignNudgeDisplay {
  let contentItemId: string | null = null;
  let matchCount = 0;
  let articleTitle = "Article";
  try {
    const m = JSON.parse(nudge.metadata ?? "{}") as {
      contentItemId?: string;
      matchCount?: number;
      articleTitle?: string;
    };
    if (typeof m.contentItemId === "string") contentItemId = m.contentItemId;
    if (typeof m.matchCount === "number") matchCount = m.matchCount;
    if (typeof m.articleTitle === "string") articleTitle = m.articleTitle;
  } catch {
    /* ignore */
  }

  if (articleTitle === "Article") {
    const titleMatch = nudge.reason.match(/article "([^"]+)"/);
    if (titleMatch) articleTitle = titleMatch[1];
  }
  if (matchCount === 0) {
    const countMatch = nudge.reason.match(/(\d+) contacts?/);
    if (countMatch) matchCount = parseInt(countMatch[1], 10);
  }

  const campaignHref = contentItemId
    ? `/campaigns/draft?contentItemId=${contentItemId}`
    : "/campaigns";

  return { articleTitle, contentItemId, matchCount, campaignHref };
}

export const INSIGHT_TYPE_LABELS: Record<string, string> = {
  STALE_CONTACT: "Time to reconnect",
  FOLLOW_UP: "Follow-up needed",
  REPLY_NEEDED: "Awaiting reply",
  JOB_CHANGE: "Role change",
  COMPANY_NEWS: "Company news",
  UPCOMING_EVENT: "Upcoming event",
  MEETING_PREP: "Meeting prep",
  EVENT_ATTENDED: "Event follow-up",
  EVENT_REGISTERED: "Event outreach",
  ARTICLE_READ: "Content engagement",
  LINKEDIN_ACTIVITY: "LinkedIn activity",
  CAMPAIGN_APPROVAL: "Campaign ready",
  ARTICLE_CAMPAIGN: "Article campaign",
};

const TYPE_LABELS: Record<string, string> = {
  STALE_CONTACT: "reconnect",
  JOB_CHANGE: "executive transition",
  COMPANY_NEWS: "company news",
  UPCOMING_EVENT: "upcoming event",
  MEETING_PREP: "meeting prep",
  EVENT_ATTENDED: "event follow-up",
  EVENT_REGISTERED: "event outreach",
  ARTICLE_READ: "content follow-up",
  LINKEDIN_ACTIVITY: "LinkedIn activity",
  FOLLOW_UP: "follow-up",
  REPLY_NEEDED: "reply",
  CAMPAIGN_APPROVAL: "campaign approval",
  ARTICLE_CAMPAIGN: "article campaign",
};

function getLabel(ruleType: string): string {
  return TYPE_LABELS[ruleType] ?? "nudge";
}

const CTA_PRIORITY: Record<string, number> = {
  MEETING_PREP: 0,
  REPLY_NEEDED: 1,
  JOB_CHANGE: 2,
  STALE_CONTACT: 3,
  FOLLOW_UP: 4,
  CAMPAIGN_APPROVAL: 5,
  ARTICLE_CAMPAIGN: 6,
  EVENT_ATTENDED: 7,
  EVENT_REGISTERED: 8,
  UPCOMING_EVENT: 9,
  COMPANY_NEWS: 10,
  LINKEDIN_ACTIVITY: 11,
  ARTICLE_READ: 12,
};

function isOwnJobChange(insight: InsightData, contactName: string): boolean {
  return insight.personName === contactName || insight.reason.startsWith(contactName);
}

/**
 * Pick the CTA type from the insights actually rendered in the summary.
 * Falls back to the nudge's ruleType only when it was itself rendered,
 * otherwise picks the highest-priority rendered insight so the CTA is
 * always grounded in what the partner can read.
 */
function pickCtaType(renderedTypes: string[], nudgeRuleType: string): string {
  if (renderedTypes.length === 0) return nudgeRuleType;
  if (renderedTypes.includes(nudgeRuleType)) return nudgeRuleType;
  const sorted = [...renderedTypes].sort(
    (a, b) => (CTA_PRIORITY[a] ?? 99) - (CTA_PRIORITY[b] ?? 99)
  );
  return sorted[0];
}

export function extractInsightSnippet(insight: InsightData): string | null {
  const r = insight.reason;
  switch (insight.type) {
    case "STALE_CONTACT": {
      const m = r.match(/No interaction in (\d+) days/);
      return m ? `${m[1]} days` : null;
    }
    case "JOB_CHANGE": {
      if (insight.signalContent) return cleanSnippet(insight.signalContent);
      const m = r.match(/"([^"]+)"/);
      return m ? m[1] : "a recent role change";
    }
    case "COMPANY_NEWS": {
      if (insight.signalContent) return cleanSnippet(insight.signalContent);
      const m = r.match(/"([^"]+)"/);
      return m ? m[1] : "recent company news";
    }
    case "UPCOMING_EVENT": {
      if (insight.signalContent) return cleanSnippet(insight.signalContent);
      return cleanSnippet(r.replace(/\. Opportunity.*/, ""));
    }
    case "MEETING_PREP": {
      const m = r.match(/"([^"]+)"/);
      return m ? m[1] : "an upcoming meeting";
    }
    case "EVENT_ATTENDED": {
      const m = r.match(/"([^"]+)"/);
      return m ? m[1] : "a recent event";
    }
    case "EVENT_REGISTERED": {
      const m = r.match(/"([^"]+)"/);
      return m ? m[1] : "an upcoming event";
    }
    case "LINKEDIN_ACTIVITY": {
      if (insight.signalContent) return cleanSnippet(insight.signalContent);
      const m = r.match(/"([^"]+)"/);
      return m ? m[1] : "recent LinkedIn activity";
    }
    case "ARTICLE_READ": {
      const m = r.match(/"([^"]+)"/);
      const views = r.match(/\((\d+) views?\)/);
      return m ? `${m[1]}${views ? ` (${views[1]}x)` : ""}` : "your thought leadership content";
    }
    case "FOLLOW_UP":
      return insight.lastEmailSubject ? cleanSnippet(insight.lastEmailSubject) : null;
    case "REPLY_NEEDED":
      return insight.inboundSummary ? cleanSnippet(insight.inboundSummary) : null;
    case "CAMPAIGN_APPROVAL": {
      const m = insight.reason.match(/"([^"]+)"/);
      return m ? m[1] : "a campaign needing review";
    }
    case "ARTICLE_CAMPAIGN": {
      const m = insight.reason.match(/"([^"]+)"/);
      return m ? m[1] : "a new article to share";
    }
    default:
      return null;
  }
}

export function buildSummaryFragments(
  nudge: NudgeForSummary,
  insights: InsightData[]
): SentenceFragment[] {
  if (insights.length === 0) return [{ text: stripMarkdown(nudge.reason) }];

  const campaignApproval = insights.find((i) => i.type === "CAMPAIGN_APPROVAL");
  if (campaignApproval) {
    const campaignName = campaignApproval.reason.match(/"([^"]+)"/)?.[1] ?? "a campaign";
    const countMatch = campaignApproval.reason.match(/has (\d+) contacts?/);
    const count = countMatch ? parseInt(countMatch[1], 10) : 0;
    const deadlineMatch = campaignApproval.reason.match(/\(due ([^)]+)\)/);
    const deadlineStr = deadlineMatch ? ` by ${deadlineMatch[1]}` : "";

    const fragments: SentenceFragment[] = [
      { text: "Campaign " },
      { text: campaignName, bold: true },
      { text: ` has ${count} contact${count !== 1 ? "s" : ""} pending your approval${deadlineStr}.` },
      { text: "", lineBreak: true },
      { text: "Review and approve so the campaign can go out on your behalf." },
    ];
    return fragments;
  }

  const articleCampaign = insights.find((i) => i.type === "ARTICLE_CAMPAIGN");
  if (articleCampaign) {
    let articleTitle = "a new article";
    let articleDescription = "";
    let articlePractice = "";
    let matchCount = 0;
    try {
      const m = JSON.parse(nudge.metadata ?? "{}") as {
        articleTitle?: string;
        articleDescription?: string;
        articlePractice?: string;
        matchCount?: number;
      };
      if (m.articleTitle) articleTitle = m.articleTitle;
      if (m.articleDescription) articleDescription = m.articleDescription;
      if (m.articlePractice) articlePractice = m.articlePractice;
      if (typeof m.matchCount === "number") matchCount = m.matchCount;
    } catch { /* fallback to reason parsing */ }

    if (!articleDescription) {
      const titleMatch = articleCampaign.reason.match(/article "([^"]+)"/);
      if (titleMatch) articleTitle = titleMatch[1];
    }

    const fragments: SentenceFragment[] = [];
    const practiceLabel = articlePractice || "Our";
    fragments.push({ text: `${practiceLabel} Practice just published ` });
    fragments.push({ text: articleTitle, bold: true });
    fragments.push({ text: ". " });

    if (articleDescription) {
      const desc = cleanSnippet(articleDescription, 140);
      fragments.push({ text: desc });
    }

    fragments.push({ text: "", lineBreak: true });

    if (matchCount > 0) {
      fragments.push({
        text: `We\u2019ve identified ${matchCount} contact${matchCount !== 1 ? "s" : ""} who would find this relevant`,
        bold: true,
      });
      fragments.push({ text: " \u2014 review and send the pre-drafted campaign." });
    } else {
      fragments.push({ text: "Review the pre-drafted campaign and choose who to share it with." });
    }

    return fragments;
  }

  const firstName = nudge.contact.name.split(" ")[0];

  const followUp = insights.find((i) => i.type === "FOLLOW_UP");
  const replyNeeded = insights.find((i) => i.type === "REPLY_NEEDED");
  const otherInsights = insights.filter(
    (i) => i.type !== "FOLLOW_UP" && i.type !== "REPLY_NEEDED" && i.type !== "STALE_CONTACT"
  );

  if (followUp) {
    const topicLines: string[][] = [];
    const bolds = new Set<string>();
    const days = followUp.waitingDays;
    const dayLabel = days ? `${days} day${days !== 1 ? "s" : ""}` : "a few days";

    const outreachLine: string[] = [];
    if (followUp.lastEmailSubject) {
      const boldSubject = stripMarkdown(followUp.lastEmailSubject);
      bolds.add(boldSubject);
      outreachLine.push(`You sent ${firstName} an email about ${boldSubject}${days ? ` ${dayLabel} ago` : ""} and haven\u2019t heard back.`);
    } else {
      outreachLine.push(`You reached out to ${firstName} ${dayLabel} ago and haven\u2019t heard back yet.`);
    }
    if (followUp.lastEmailSnippet) {
      const snippet = cleanSnippet(followUp.lastEmailSnippet, 160);
      outreachLine.push(`Your message discussed ${snippet}.`);
    }
    topicLines.push(outreachLine);

    if (followUp.lastInteraction) {
      const li = followUp.lastInteraction;
      const interactionLabel = li.type === "CALL" ? "call" : li.type === "MEETING" ? "meeting" : "conversation";
      const summaryText = cleanSnippet(naturalizeInteractionSummary(li.summary), 160);
      topicLines.push([`Your last ${interactionLabel} covered ${summaryText}.`]);
    }

    const signalLine: string[] = [];
    appendSignalContext(signalLine, bolds, otherInsights, firstName, nudge.contact.company.name, nudge.contact.name);
    signalLine.push(`A gentle follow-up could keep the conversation moving.`);
    topicLines.push(signalLine);

    return buildFragmentsFromTopicLines(topicLines, bolds);
  }

  if (replyNeeded) {
    const topicLines: string[][] = [];
    const bolds = new Set<string>();
    const days = replyNeeded.waitingDays;
    const dayLabel = days ? `${days} day${days !== 1 ? "s" : ""}` : "recently";

    const inboundLine: string[] = [];
    if (replyNeeded.inboundSummary) {
      const boldSummary = cleanSnippet(replyNeeded.inboundSummary, 160);
      bolds.add(boldSummary);
      inboundLine.push(`${firstName} emailed you ${dayLabel} ago: ${boldSummary}.`);
    } else {
      inboundLine.push(`${firstName} sent you an email ${dayLabel} ago that\u2019s waiting for a reply.`);
    }
    topicLines.push(inboundLine);

    if (replyNeeded.lastInteraction) {
      const li = replyNeeded.lastInteraction;
      const interactionLabel = li.type === "CALL" ? "call" : li.type === "MEETING" ? "meeting" : "conversation";
      const summaryText = cleanSnippet(naturalizeInteractionSummary(li.summary), 160);
      topicLines.push([`Your last ${interactionLabel} covered ${summaryText}.`]);
    }

    const signalLine: string[] = [];
    appendSignalContext(signalLine, bolds, otherInsights, firstName, nudge.contact.company.name, nudge.contact.name);
    signalLine.push(`Responding promptly helps maintain the relationship momentum.`);
    topicLines.push(signalLine);

    return buildFragmentsFromTopicLines(topicLines, bolds);
  }

  const stale = insights.find((i) => i.type === "STALE_CONTACT");
  const jobChange = insights.find((i) => i.type === "JOB_CHANGE");
  const news = insights.find((i) => i.type === "COMPANY_NEWS");
  const event = insights.find((i) => i.type === "UPCOMING_EVENT" || i.type === "EVENT_REGISTERED");
  const attended = insights.find((i) => i.type === "EVENT_ATTENDED");
  const meeting = insights.find((i) => i.type === "MEETING_PREP");
  const linkedin = insights.find((i) => i.type === "LINKEDIN_ACTIVITY");
  const article = insights.find((i) => i.type === "ARTICLE_READ");

  const topicLines: string[][] = [];
  const bolds = new Set<string>();
  const renderedTypes: string[] = [];

  type SignalInsight = { insight: InsightData; type: string; render: () => string };
  const signalCandidates: SignalInsight[] = [];
  if (jobChange) {
    const isOwn = isOwnJobChange(jobChange, nudge.contact.name);
    signalCandidates.push({
      insight: jobChange,
      type: "JOB_CHANGE",
      render: () => {
        const snippet = extractInsightSnippet(jobChange);
        const boldText = snippet ?? "a role change";
        bolds.add(boldText);
        if (isOwn) {
          return `There\u2019s been a key executive move \u2014 ${boldText}.`;
        }
        return `There\u2019s been an executive change at ${nudge.contact.company.name} \u2014 ${boldText}.`;
      },
    });
  }
  if (news) {
    signalCandidates.push({
      insight: news,
      type: "COMPANY_NEWS",
      render: () => {
        const snippet = extractInsightSnippet(news);
        const boldText = snippet ?? "recent news";
        bolds.add(boldText);
        return `${nudge.contact.company.name} is in the news: ${boldText}.`;
      },
    });
  }
  if (linkedin) {
    signalCandidates.push({
      insight: linkedin,
      type: "LINKEDIN_ACTIVITY",
      render: () => {
        const snippet = extractInsightSnippet(linkedin);
        const boldText = snippet ?? "recent topics";
        bolds.add(boldText);
        return `${firstName} has been active on LinkedIn discussing ${boldText}.`;
      },
    });
  }
  if (article) {
    signalCandidates.push({
      insight: article,
      type: "ARTICLE_READ",
      render: () => {
        const snippet = extractInsightSnippet(article);
        const boldText = snippet ?? "your content";
        bolds.add(boldText);
        return `${firstName} recently engaged with ${boldText}.`;
      },
    });
  }

  signalCandidates.sort(
    (a, b) => (CTA_PRIORITY[a.type] ?? 99) - (CTA_PRIORITY[b.type] ?? 99)
  );

  const maxPrimarySignals = 2;
  let signalsRendered = 0;
  for (const sc of signalCandidates) {
    if (signalsRendered >= maxPrimarySignals) break;
    topicLines.push([sc.render()]);
    renderedTypes.push(sc.type);
    signalsRendered++;
  }

  if (stale) {
    const snippet = extractInsightSnippet(stale);
    if (snippet) {
      bolds.add(snippet);
      topicLines.push([`It\u2019s been ${snippet} since your last conversation.`]);
      renderedTypes.push("STALE_CONTACT");
    }
  }

  const totalSentences = topicLines.reduce((n, l) => n + l.length, 0);
  if (event && totalSentences < 3) {
    const snippet = extractInsightSnippet(event);
    const boldText = snippet ?? "an upcoming event";
    bolds.add(boldText);
    topicLines.push([`There\u2019s an upcoming event \u2014 ${boldText} \u2014 that could be a natural touchpoint.`]);
    renderedTypes.push(event.type);
  } else if (attended && totalSentences < 3) {
    const snippet = extractInsightSnippet(attended);
    const boldText = snippet ?? "a recent event";
    bolds.add(boldText);
    topicLines.push([`${firstName} recently attended ${boldText} \u2014 a great follow-up opening.`]);
    renderedTypes.push("EVENT_ATTENDED");
  } else if (meeting && totalSentences < 3) {
    const snippet = extractInsightSnippet(meeting);
    const boldText = snippet ?? "an upcoming meeting";
    bolds.add(boldText);
    topicLines.push([`You have ${boldText} coming up soon.`]);
    renderedTypes.push("MEETING_PREP");
  }

  const allSentences = topicLines.flat();
  if (allSentences.length < 2 && jobChange && !renderedTypes.includes("JOB_CHANGE")) {
    const snippet = extractInsightSnippet(jobChange);
    if (snippet) {
      bolds.add(snippet);
      if (isOwnJobChange(jobChange, nudge.contact.name)) {
        topicLines.push([`Meanwhile, there\u2019s been an executive move: ${snippet}.`]);
      } else {
        topicLines.push([`Meanwhile, there\u2019s been an executive change at ${nudge.contact.company.name}: ${snippet}.`]);
      }
      renderedTypes.push("JOB_CHANGE");
    }
  }

  const ctaType = pickCtaType(renderedTypes, nudge.ruleType);
  let label = getLabel(ctaType);
  if (ctaType === "JOB_CHANGE" && jobChange && !isOwnJobChange(jobChange, nudge.contact.name)) {
    label = "company update";
  }
  topicLines.push([`This is a good moment to reach out with a ${label} note.`]);

  return buildFragmentsFromTopicLines(topicLines, bolds);
}

function appendSignalContext(
  sentences: string[],
  bolds: Set<string>,
  signals: InsightData[],
  firstName: string,
  companyName: string,
  contactFullName?: string
): void {
  if (signals.length === 0) return;

  const jobChange = signals.find((i) => i.type === "JOB_CHANGE");
  const news = signals.find((i) => i.type === "COMPANY_NEWS");
  const linkedin = signals.find((i) => i.type === "LINKEDIN_ACTIVITY");
  const article = signals.find((i) => i.type === "ARTICLE_READ");
  const event = signals.find(
    (i) => i.type === "UPCOMING_EVENT" || i.type === "EVENT_REGISTERED" || i.type === "EVENT_ATTENDED"
  );

  if (jobChange) {
    const snippet = extractInsightSnippet(jobChange);
    const boldText = snippet ?? "a recent role change";
    bolds.add(boldText);
    const isOwn = contactFullName ? isOwnJobChange(jobChange, contactFullName) : true;
    if (isOwn) {
      sentences.push(`Meanwhile, there\u2019s been an executive move \u2014 ${boldText} \u2014 which could be a good conversation anchor.`);
    } else {
      sentences.push(`Meanwhile, there\u2019s been an executive change at ${companyName} \u2014 ${boldText} \u2014 which could be a conversation opener.`);
    }
  } else if (news) {
    const snippet = extractInsightSnippet(news);
    const boldText = snippet ?? "recent company news";
    bolds.add(boldText);
    sentences.push(`${companyName} is also in the news: ${boldText}.`);
  } else if (linkedin) {
    const snippet = extractInsightSnippet(linkedin);
    const boldText = snippet ?? "recent topics";
    bolds.add(boldText);
    sentences.push(`${firstName} has been active on LinkedIn discussing ${boldText}.`);
  } else if (article) {
    const snippet = extractInsightSnippet(article);
    const boldText = snippet ?? "your content";
    bolds.add(boldText);
    sentences.push(`${firstName} recently engaged with ${boldText}.`);
  } else if (event) {
    const snippet = extractInsightSnippet(event);
    const boldText = snippet ?? "an upcoming event";
    bolds.add(boldText);
    if (event.type === "EVENT_ATTENDED") {
      sentences.push(`${firstName} recently attended ${boldText}.`);
    } else {
      sentences.push(`There\u2019s an upcoming event \u2014 ${boldText} \u2014 worth referencing.`);
    }
  }
}

function buildFragmentsFromTopicLines(
  topicLines: string[][],
  bolds: Set<string>
): SentenceFragment[] {
  const fragments: SentenceFragment[] = [];
  const nonEmpty = topicLines.filter((l) => l.length > 0);

  for (let t = 0; t < nonEmpty.length; t++) {
    if (t > 0) {
      fragments.push({ text: "", lineBreak: true });
    }
    const lineText = nonEmpty[t].join(" ");
    const sortedBolds = [...bolds].sort((a, b) => lineText.indexOf(a) - lineText.indexOf(b));
    let cursor = 0;
    for (const bold of sortedBolds) {
      const idx = lineText.indexOf(bold, cursor);
      if (idx === -1) continue;
      if (idx > cursor) {
        fragments.push({ text: lineText.slice(cursor, idx) });
      }
      fragments.push({ text: bold, bold: true });
      cursor = idx + bold.length;
    }
    if (cursor < lineText.length) {
      fragments.push({ text: lineText.slice(cursor) });
    }
  }

  return fragments;
}




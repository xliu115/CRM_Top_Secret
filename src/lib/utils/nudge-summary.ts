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
  contact: {
    name: string;
    company: { name: string };
  };
};

export type SentenceFragment = { text: string; bold?: boolean; lineBreak?: boolean };

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
};

function getLabel(ruleType: string): string {
  return TYPE_LABELS[ruleType] ?? "nudge";
}

export function extractInsightSnippet(insight: InsightData): string | null {
  const r = insight.reason;
  switch (insight.type) {
    case "STALE_CONTACT": {
      const m = r.match(/No interaction in (\d+) days/);
      return m ? `${m[1]} days` : null;
    }
    case "JOB_CHANGE": {
      const m = r.match(/"([^"]+)"/);
      return m ? m[1] : "a recent role change";
    }
    case "COMPANY_NEWS": {
      if (insight.signalContent) return insight.signalContent;
      const m = r.match(/"([^"]+)"/);
      return m ? m[1] : "recent company news";
    }
    case "UPCOMING_EVENT": {
      return insight.signalContent ?? r.replace(/\. Opportunity.*/, "");
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
      const m = r.match(/"([^"]+)"/);
      return m ? m[1] : "recent LinkedIn activity";
    }
    case "ARTICLE_READ": {
      const m = r.match(/"([^"]+)"/);
      const views = r.match(/\((\d+) views?\)/);
      return m ? `${m[1]}${views ? ` (${views[1]}x)` : ""}` : "your thought leadership content";
    }
    case "FOLLOW_UP":
      return insight.lastEmailSubject ?? null;
    case "REPLY_NEEDED":
      return insight.inboundSummary ?? null;
    default:
      return null;
  }
}

export function buildSummaryFragments(
  nudge: NudgeForSummary,
  insights: InsightData[]
): SentenceFragment[] {
  if (insights.length === 0) return [{ text: nudge.reason }];

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
      const boldSubject = followUp.lastEmailSubject;
      bolds.add(boldSubject);
      outreachLine.push(`You sent ${firstName} an email about ${boldSubject}${days ? ` ${dayLabel} ago` : ""} and haven\u2019t heard back.`);
    } else {
      outreachLine.push(`You reached out to ${firstName} ${dayLabel} ago and haven\u2019t heard back yet.`);
    }
    if (followUp.lastEmailSnippet) {
      outreachLine.push(`Your message discussed ${followUp.lastEmailSnippet.slice(0, 160)}${followUp.lastEmailSnippet.length > 160 ? "..." : ""}.`);
    }
    topicLines.push(outreachLine);

    if (followUp.lastInteraction) {
      const li = followUp.lastInteraction;
      const interactionLabel = li.type === "CALL" ? "call" : li.type === "MEETING" ? "meeting" : "conversation";
      const summaryText = naturalizeInteractionSummary(li.summary).slice(0, 160);
      topicLines.push([`Your last ${interactionLabel} covered ${summaryText}${li.summary.length > 160 ? "..." : ""}.`]);
    }

    const signalLine: string[] = [];
    appendSignalContext(signalLine, bolds, otherInsights, firstName, nudge.contact.company.name);
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
      const boldSummary = replyNeeded.inboundSummary.slice(0, 160);
      bolds.add(boldSummary);
      inboundLine.push(`${firstName} emailed you ${dayLabel} ago: ${boldSummary}${replyNeeded.inboundSummary.length > 160 ? "..." : ""}.`);
    } else {
      inboundLine.push(`${firstName} sent you an email ${dayLabel} ago that\u2019s waiting for a reply.`);
    }
    topicLines.push(inboundLine);

    if (replyNeeded.lastInteraction) {
      const li = replyNeeded.lastInteraction;
      const interactionLabel = li.type === "CALL" ? "call" : li.type === "MEETING" ? "meeting" : "conversation";
      const summaryText = naturalizeInteractionSummary(li.summary).slice(0, 160);
      topicLines.push([`Your last ${interactionLabel} covered ${summaryText}${li.summary.length > 160 ? "..." : ""}.`]);
    }

    const signalLine: string[] = [];
    appendSignalContext(signalLine, bolds, otherInsights, firstName, nudge.contact.company.name);
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

  const primaryLine: string[] = [];
  if (article) {
    const snippet = extractInsightSnippet(article);
    const boldText = snippet ?? "your content";
    bolds.add(boldText);
    primaryLine.push(`${firstName} recently engaged with ${boldText}.`);
  } else if (linkedin) {
    const snippet = extractInsightSnippet(linkedin);
    const boldText = snippet ?? "recent topics";
    bolds.add(boldText);
    primaryLine.push(`${firstName} has been active on LinkedIn discussing ${boldText}.`);
  } else if (jobChange) {
    const snippet = extractInsightSnippet(jobChange);
    const boldText = snippet ?? "a role change";
    bolds.add(boldText);
    primaryLine.push(`There\u2019s been a key executive move \u2014 ${boldText}.`);
  } else if (news) {
    const snippet = extractInsightSnippet(news);
    const boldText = snippet ?? "recent news";
    bolds.add(boldText);
    primaryLine.push(`${nudge.contact.company.name} is in the news: ${boldText}.`);
  }

  if (stale) {
    const snippet = extractInsightSnippet(stale);
    if (snippet) {
      bolds.add(snippet);
      primaryLine.push(`It\u2019s been ${snippet} since your last conversation.`);
    }
  }
  if (primaryLine.length > 0) topicLines.push(primaryLine);

  const totalSentences = topicLines.reduce((n, l) => n + l.length, 0);
  if (event && totalSentences < 3) {
    const snippet = extractInsightSnippet(event);
    const boldText = snippet ?? "an upcoming event";
    bolds.add(boldText);
    topicLines.push([`There\u2019s an upcoming event \u2014 ${boldText} \u2014 that could be a natural touchpoint.`]);
  } else if (attended && totalSentences < 3) {
    const snippet = extractInsightSnippet(attended);
    const boldText = snippet ?? "a recent event";
    bolds.add(boldText);
    topicLines.push([`${firstName} recently attended ${boldText} \u2014 a great follow-up opening.`]);
  } else if (meeting && totalSentences < 3) {
    const snippet = extractInsightSnippet(meeting);
    const boldText = snippet ?? "an upcoming meeting";
    bolds.add(boldText);
    topicLines.push([`You have ${boldText} coming up soon.`]);
  }

  const allSentences = topicLines.flat();
  if (allSentences.length < 2 && jobChange && allSentences.every((s) => !s.includes("executive"))) {
    const snippet = extractInsightSnippet(jobChange);
    if (snippet) {
      bolds.add(snippet);
      topicLines.push([`Meanwhile, there\u2019s been an executive move: ${snippet}.`]);
    }
  }

  const label = getLabel(nudge.ruleType);
  topicLines.push([`This is a good moment to reach out with a ${label} note.`]);

  return buildFragmentsFromTopicLines(topicLines, bolds);
}

function appendSignalContext(
  sentences: string[],
  bolds: Set<string>,
  signals: InsightData[],
  firstName: string,
  companyName: string
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
    sentences.push(`Meanwhile, there\u2019s been an executive move \u2014 ${boldText} \u2014 which could be a good conversation anchor.`);
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


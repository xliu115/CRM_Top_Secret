import { format, isToday, isTomorrow } from "date-fns";
import type { StoryKind } from "@/lib/dashboard-news-classifier";
import { STORY_KIND_LABEL } from "@/lib/dashboard-news-classifier";

export type BriefingNudge = {
  contact: { name: string; company: { name: string } };
  ruleType: string;
};

export type BriefingDashboard = {
  contactCount: number;
  openNudgeCount: number;
  upcomingMeetings: unknown[];
};

export type BriefingBreakingLead = {
  catchyTitle: string;
};

export type BriefingMeetingLead = {
  title: string;
  startTime: string;
  primaryAttendeeName?: string;
  companyName?: string;
};

export type BriefingContext = {
  criticalBreakingCount: number;
  todayTomorrowMeetingCount: number;
  hasLaterWeekMeetings: boolean;
  forTodayUrgentNudgeCount: number;
  suggestedNudgeCount: number;
  /** Up to two breaking headlines (substance-first lead) */
  criticalBreakingLeads?: BriefingBreakingLead[];
  /** First URGENT/HIGH follow-up */
  topUrgentNudge?: BriefingNudge & { reason?: string | null };
  /** Imminent meetings (today/tomorrow), cap at source */
  meetingLeads?: BriefingMeetingLead[];
  /** First MEDIUM/LOW nudge when nothing urgent is highlighted above */
  suggestedStartNudge?: BriefingNudge;
};

export type BriefingPart =
  | { type: "text"; value: string }
  | { type: "strong"; value: string };

/** One visual paragraph in the briefing bubble */
export type BriefingParagraph = BriefingPart[];

function t(value: string): BriefingPart {
  return { type: "text", value };
}

function s(value: string): BriefingPart {
  return { type: "strong", value };
}

function trimBriefReason(reason: string, maxLen: number): string {
  const x = reason.trim();
  if (x.length <= maxLen) return x;
  return `${x.slice(0, maxLen - 1).trim()}…`;
}

/** Company segment from `Company — kind: snippet` (buildNewsCatchyTitle). */
function companyFromCatchyTitle(catchyTitle: string): string | null {
  const sep = " — ";
  const idx = catchyTitle.indexOf(sep);
  if (idx <= 0) return null;
  return catchyTitle.slice(0, idx).trim() || null;
}

/** Plain story text after `kind: ` (drops labels like "leadership in the news"). */
function storySnippetFromCatchyTitle(catchyTitle: string): string {
  const sep = " — ";
  const idx = catchyTitle.indexOf(sep);
  const afterSep = idx >= 0 ? catchyTitle.slice(idx + sep.length) : catchyTitle;
  const colon = afterSep.indexOf(": ");
  if (colon < 0) return afterSep.trim();
  return afterSep.slice(colon + 2).trim();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove publication-style prefixes and a redundant leading company name
 * (headline already names the company once).
 */
function polishBriefingSnippet(snippet: string, company: string | null): string {
  let x = snippet.trim();
  if (!x) return x;

  const noisePatterns = [
    /^food business news\s*[:\u2013\u2014-]\s*/i,
    /^food business news\s+/i,
    /^industry news\s*[:\u2013\u2014-]\s*/i,
    /^business news\s*[:\u2013\u2014-]\s*/i,
  ];
  for (const re of noisePatterns) {
    x = x.replace(re, "").trim();
  }

  const c = company?.trim();
  if (c) {
    x = x.replace(new RegExp(`^${escapeRegExp(c)}\\s*[:\u2013\u2014-]\\s*`, "i"), "").trim();
    x = x.replace(new RegExp(`^${escapeRegExp(c)}\\s+`, "i"), "").trim();
  }

  return x;
}

function buildBriefingUrgentParts(
  ruleType: string,
  contactName: string,
  companyName: string,
  reason: string | null
): BriefingPart[] {
  const trimmed = reason?.trim() ? trimBriefReason(reason, 140) : null;
  const withReason = (base: BriefingPart[]): BriefingPart[] => {
    if (!trimmed) return [...base, t(".")];
    return [...base, t(" "), t(trimmed), t(".")];
  };

  switch (ruleType) {
    case "MEETING_PREP":
      return withReason([
        t("You may want to follow up on last meeting action items with "),
        s(contactName),
        t(" at "),
        s(companyName),
      ]);
    case "STALE_CONTACT":
      return withReason([
        t("Worth reconnecting with "),
        s(contactName),
        t(" at "),
        s(companyName),
      ]);
    case "JOB_CHANGE":
      return withReason([
        t("Congratulate "),
        s(contactName),
        t(" at "),
        s(companyName),
        t(" on their move"),
      ]);
    case "COMPANY_NEWS":
      return withReason([
        t("Good moment to share a point of view with "),
        s(contactName),
        t(" at "),
        s(companyName),
      ]);
    case "UPCOMING_EVENT":
      return withReason([
        t("Align with "),
        s(contactName),
        t(" at "),
        s(companyName),
        t(" ahead of the upcoming event"),
      ]);
    case "EVENT_ATTENDED":
      return withReason([
        t("Follow up with "),
        s(contactName),
        t(" at "),
        s(companyName),
        t(" after the event"),
      ]);
    case "EVENT_REGISTERED":
      return withReason([
        t("Reach out to "),
        s(contactName),
        t(" at "),
        s(companyName),
        t(" before the event"),
      ]);
    case "ARTICLE_READ":
      return withReason([
        t("Pick the thread back up with "),
        s(contactName),
        t(" at "),
        s(companyName),
      ]);
    case "LINKEDIN_ACTIVITY":
      return withReason([
        s(contactName),
        t(" at "),
        s(companyName),
        t(" has been active on LinkedIn—worth a quick touchpoint"),
      ]);
    default:
      if (trimmed) {
        return [t(trimmed), t(" "), s(contactName), t(" at "), s(companyName), t(".")];
      }
      return [t("Follow up with "), s(contactName), t(" at "), s(companyName), t(".")];
  }
}

function meetingWhenPhrase(iso: string): string {
  const d = new Date(iso);
  const time = format(d, "h:mm a").replace(":00 ", " ");
  if (isToday(d)) return `today at ${time}`;
  if (isTomorrow(d)) return `tomorrow at ${time}`;
  return `${format(d, "EEE, MMM d")} at ${time}`;
}

export function buildSuggestedActionHeadline(
  ruleType: string,
  contactName: string,
  companyName: string,
  typeLabel: string
): string {
  const first = contactName.split(/\s+/)[0] ?? contactName;
  switch (ruleType) {
    case "STALE_CONTACT":
      return `Reconnect with ${first} at ${companyName}`;
    case "JOB_CHANGE":
      return `Congratulate ${first} on their move`;
    case "COMPANY_NEWS":
      return `Share a point of view with ${first} on ${companyName}`;
    case "UPCOMING_EVENT":
      return `Align with ${first} around the upcoming event`;
    case "MEETING_PREP":
      return `Prep for your conversation with ${first}`;
    case "EVENT_ATTENDED":
      return `Follow up with ${first} after the event`;
    case "EVENT_REGISTERED":
      return `Reach out to ${first} ahead of the event`;
    case "ARTICLE_READ":
      return `Pick up the thread with ${first} on that piece`;
    case "LINKEDIN_ACTIVITY":
      return `Engage with ${first} while they're active on LinkedIn`;
    default:
      return `${typeLabel} — ${first}`;
  }
}

export function priorityAssistantLabel(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "Time-sensitive";
    case "HIGH":
      return "High priority";
    case "MEDIUM":
      return "This week";
    case "LOW":
      return "When you have a moment";
    default:
      return priority;
  }
}

export function buildExecutiveBriefing(
  data: BriefingDashboard,
  ctx: BriefingContext
): BriefingParagraph[] {
  const c = data.contactCount;
  const n = data.openNudgeCount;
  const paragraphs: BriefingParagraph[] = [];

  const breaking = (ctx.criticalBreakingLeads ?? []).slice(0, 2);
  if (breaking.length > 0) {
    const more = ctx.criticalBreakingCount - breaking.length;
    const c0 = companyFromCatchyTitle(breaking[0].catchyTitle);
    const s0Raw = storySnippetFromCatchyTitle(breaking[0].catchyTitle);
    const s0 = polishBriefingSnippet(s0Raw, c0) || s0Raw.trim();
    let newsPara: BriefingPart[];
    if (breaking.length === 1) {
      newsPara = c0 ? [s(c0), t(": "), t(s0), t(".")] : [t(s0), t(".")];
    } else {
      const c1 = companyFromCatchyTitle(breaking[1].catchyTitle);
      const s1Raw = storySnippetFromCatchyTitle(breaking[1].catchyTitle);
      const s1 = polishBriefingSnippet(s1Raw, c1) || s1Raw.trim();
      if (c0 && c1 && c0 === c1) {
        newsPara = [
          t("Two updates on "),
          s(c0),
          t(": "),
          t(s0),
          t(", and "),
          t(s1),
          t("."),
        ];
      } else {
        const first: BriefingPart[] = c0
          ? [s(c0), t(": "), t(s0), t(". ")]
          : [t(s0), t(". ")];
        const second: BriefingPart[] = c1
          ? [s(c1), t(": "), t(s1), t(".")]
          : [t(s1), t(".")];
        newsPara = [...first, ...second];
      }
    }
    if (more > 0) {
      newsPara.push(
        t(" "),
        t(`Another ${more} update${more === 1 ? "" : "s"} on priority accounts recently.`)
      );
    }
    paragraphs.push(newsPara);
  }

  if (ctx.topUrgentNudge) {
    const u = ctx.topUrgentNudge;
    paragraphs.push(
      buildBriefingUrgentParts(
        u.ruleType,
        u.contact.name,
        u.contact.company.name,
        u.reason ?? null
      )
    );
  }

  const meetings = (ctx.meetingLeads ?? []).slice(0, 2);
  if (meetings.length > 0) {
    const meetingPara: BriefingPart[] = [];
    meetings.forEach((m, i) => {
      if (i > 0) meetingPara.push(t(" "));
      meetingPara.push(
        s(m.title),
        t(" is "),
        t(meetingWhenPhrase(m.startTime))
      );
      if (m.primaryAttendeeName) {
        meetingPara.push(t(" with "), s(m.primaryAttendeeName));
        if (m.companyName) meetingPara.push(t(" (" + m.companyName + ")"));
      }
      meetingPara.push(t("."));
    });
    paragraphs.push(meetingPara);
  }

  if (ctx.suggestedStartNudge && !ctx.topUrgentNudge) {
    const sn = ctx.suggestedStartNudge;
    paragraphs.push([
      t("When you have room, "),
      s(sn.contact.name),
      t(" at "),
      s(sn.contact.company.name),
      t(" is a good next touch."),
    ]);
  }

  const tail: BriefingPart[] = [];
  tail.push(
    t(
      `I'm also tracking ${c} relationship${c === 1 ? "" : "s"} and what's moving in the market.`
    )
  );

  if (n === 0) {
    tail.push(t(" Nothing else queued."));
  } else {
    if (ctx.forTodayUrgentNudgeCount > 0 && ctx.suggestedNudgeCount > 0) {
      tail.push(
        t(
          ` ${ctx.forTodayUrgentNudgeCount} time-sensitive follow-up${ctx.forTodayUrgentNudgeCount === 1 ? "" : "s"} open, plus ${ctx.suggestedNudgeCount} more when you can.`
        )
      );
    } else if (ctx.forTodayUrgentNudgeCount > 0) {
      tail.push(
        t(
          ` ${ctx.forTodayUrgentNudgeCount} open follow-up${ctx.forTodayUrgentNudgeCount === 1 ? "" : "s"} are time-sensitive.`
        )
      );
    } else if (n > 0 && ctx.forTodayUrgentNudgeCount === 0 && !ctx.suggestedStartNudge) {
      tail.push(t(` ${n} other follow-up${n === 1 ? "" : "s"} worth a glance.`));
    }
  }

  if (ctx.todayTomorrowMeetingCount === 0) {
    if (ctx.hasLaterWeekMeetings) {
      tail.push(t(" Nothing today or tomorrow; you have meetings later this week."));
    } else {
      tail.push(t(" Nothing on the calendar for the next seven days."));
    }
  }

  paragraphs.push(tail);

  return paragraphs.length > 0 ? paragraphs : [[t("You're all set.")]];
}

export function buildNewsCatchyTitle(
  storyKind: StoryKind,
  companyName: string,
  content: string
): string {
  const short = content.length > 72 ? `${content.slice(0, 70).trim()}…` : content;
  const label = STORY_KIND_LABEL[storyKind];
  return `${companyName} — ${label.toLowerCase()}: ${short}`;
}

export function formatRelativeNewsTime(date: Date, now: Date): string {
  const diffH = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Yesterday";
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

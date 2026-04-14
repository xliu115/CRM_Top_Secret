import { contactRepo, interactionRepo, signalRepo, nudgeRepo, meetingRepo, engagementRepo, nudgeRuleConfigRepo, sequenceRepo, partnerRepo } from "@/lib/repositories";
import { differenceInDays, subDays } from "date-fns";
import { formatDateForLLM } from "@/lib/utils/format-date";
import { prisma } from "@/lib/db/prisma";
import { getWaitingDays, buildSequenceNudgeReason, buildReplyNeededReason } from "./cadence-engine";
import { scoreContactsForArticle } from "./article-relevance";
import { generateStrategicInsight, ELIGIBLE_INSIGHT_TYPES } from "./llm-insight";

interface Insight {
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
}

interface NudgeCandidate {
  contactId: string;
  signalId?: string;
  ruleType: string;
  reason: string;
  priority: string;
  metadata?: string;
  sequenceId?: string;
  cadenceStepId?: string;
}

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const TYPE_RANK: Record<string, number> = {
  MEETING_PREP: 0,
  REPLY_NEEDED: 1,
  JOB_CHANGE: 2,
  STALE_CONTACT: 3,
  FOLLOW_UP: 4,
  CAMPAIGN_APPROVAL: 5,
  ARTICLE_CAMPAIGN: 6,
  LINKEDIN_ACTIVITY: 7,
  EVENT_ATTENDED: 8,
  EVENT_REGISTERED: 9,
  ARTICLE_READ: 10,
  UPCOMING_EVENT: 11,
  COMPANY_NEWS: 12,
};

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

async function getPartnerRelationsForPerson(
  personName: string,
  companyId: string,
  excludePartnerId?: string
): Promise<{ partnerId: string; partnerName: string }[]> {
  const contacts = await prisma.contact.findMany({
    where: { name: personName, companyId },
    include: { partner: { select: { id: true, name: true } } },
  });
  return contacts
    .filter((c) => c.partner.id !== excludePartnerId)
    .map((c) => ({ partnerId: c.partner.id, partnerName: c.partner.name }));
}

function pickPrimary(insights: Insight[]): { ruleType: string; priority: string; signalId?: string } {
  const sorted = [...insights].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? 9;
    const pb = PRIORITY_RANK[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    const ta = TYPE_RANK[a.type] ?? 9;
    const tb = TYPE_RANK[b.type] ?? 9;
    return ta - tb;
  });
  const top = sorted[0];
  return { ruleType: top.type, priority: top.priority, signalId: top.signalId };
}

function buildReason(contactName: string, companyName: string, insights: Insight[]): string {
  if (insights.length === 1) return insights[0].reason;

  const typeLabels: Record<string, string> = {
    REPLY_NEEDED: "unreplied inbound email",
    FOLLOW_UP: "active outreach follow-up",
    STALE_CONTACT: "overdue for a check-in",
    JOB_CHANGE: "executive transition",
    COMPANY_NEWS: "company news",
    UPCOMING_EVENT: "upcoming event",
    MEETING_PREP: "upcoming meeting",
    EVENT_ATTENDED: "event follow-up",
    EVENT_REGISTERED: "event outreach",
    ARTICLE_READ: "content engagement",
    LINKEDIN_ACTIVITY: "LinkedIn activity",
    ARTICLE_CAMPAIGN: "new article campaign",
  };

  const types = [...new Set(insights.map((i) => i.type))];
  const labels = types.map((t) => typeLabels[t] ?? t.toLowerCase()).slice(0, 4);
  const summary = labels.length <= 2
    ? labels.join(" and ")
    : labels.slice(0, -1).join(", ") + ", and " + labels[labels.length - 1];

  return `${insights.length} reasons to reach out to ${contactName} at ${companyName}: ${summary}.`;
}

/**
 * Refreshes nudges for a partner. Nudges are anchored on the partner's contacts
 * (executives) — only contacts in the partner's book generate nudges.
 */
export async function refreshNudgesForPartner(partnerId: string) {
  const contacts = await contactRepo.findByPartnerId(partnerId);
  const now = new Date();

  if (contacts.length === 0) {
    await nudgeRepo.deleteOpenByPartnerId(partnerId);
    return 0;
  }

  const config = await nudgeRuleConfigRepo.upsert(partnerId, {});

  const contactIds = contacts.map((c) => c.id);
  const companyIds = [...new Set(contacts.map((c) => c.companyId))];

  const [allInteractions, allContactSignals, allCompanySignals, allMeetings, allEvents, allArticles] =
    await Promise.all([
      interactionRepo.findByContactIds(contactIds),
      prisma.externalSignal.findMany({
        where: { contactId: { in: contactIds } },
        orderBy: { date: "desc" },
      }),
      prisma.externalSignal.findMany({
        where: { companyId: { in: companyIds } },
        orderBy: { date: "desc" },
      }),
      prisma.meeting.findMany({
        where: { attendees: { some: { contactId: { in: contactIds } } } },
        include: { attendees: { select: { contactId: true } } },
        orderBy: { startTime: "desc" },
      }),
      prisma.eventRegistration.findMany({
        where: { contactId: { in: contactIds } },
        orderBy: { eventDate: "desc" },
      }),
      prisma.articleEngagement.findMany({
        where: { contactId: { in: contactIds } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const interactionsByContact = groupBy(allInteractions, (i) => i.contactId);
  const contactSignalsByContact = groupBy(allContactSignals, (s) => s.contactId ?? "");
  const companySignalsByCompany = groupBy(allCompanySignals, (s) => s.companyId ?? "");
  const meetingsByContact = new Map<string, typeof allMeetings>();
  for (const m of allMeetings) {
    for (const a of m.attendees) {
      const arr = meetingsByContact.get(a.contactId);
      if (arr) arr.push(m);
      else meetingsByContact.set(a.contactId, [m]);
    }
  }
  const eventsByContact = groupBy(allEvents, (e) => e.contactId);
  const articlesByContact = groupBy(allArticles, (a) => a.contactId);

  const candidates: NudgeCandidate[] = [];

  for (const contact of contacts) {
    const interactions = interactionsByContact.get(contact.id) ?? [];
    const signals = contactSignalsByContact.get(contact.id) ?? [];
    const companySignals = companySignalsByCompany.get(contact.companyId) ?? [];
    const meetings = meetingsByContact.get(contact.id) ?? [];
    const seenSignalIds = new Set(signals.map((s) => s.id));
    const dedupedCompanySignals = companySignals.filter((s) => !seenSignalIds.has(s.id));
    const allSignals = [...signals, ...dedupedCompanySignals];

    const lastInteraction = interactions[0];
    const daysSince = lastInteraction
      ? differenceInDays(now, new Date(lastInteraction.date))
      : 999;

    let parsedDisabled: string[] = [];
    try {
      parsedDisabled = contact.disabledNudgeTypes ? JSON.parse(contact.disabledNudgeTypes) as string[] : [];
      if (!Array.isArray(parsedDisabled)) parsedDisabled = [];
    } catch {
      parsedDisabled = [];
    }
    const disabledTypes = new Set<string>(parsedDisabled);

    const insights: Insight[] = [];

    // --- Stale Contact ---
    if (config.staleContactEnabled && !disabledTypes.has("STALE_CONTACT")) {
      const tierThreshold: Record<string, number> = {
        CRITICAL: config.staleDaysCritical,
        HIGH: config.staleDaysHigh,
        MEDIUM: config.staleDaysMedium,
        LOW: config.staleDaysLow,
      };
      const threshold = contact.staleThresholdDays ?? tierThreshold[contact.importance] ?? config.staleDaysMedium;
      if (daysSince > threshold) {
        const priorityMap: Record<string, string> = { CRITICAL: "URGENT", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "MEDIUM" };
        insights.push({
          type: "STALE_CONTACT",
          reason: `No interaction in ${daysSince} days (threshold: ${threshold} days).`,
          priority: priorityMap[contact.importance] ?? "MEDIUM",
        });
      }
    }

    // --- Job Change ---
    if (config.jobChangeEnabled && !disabledTypes.has("JOB_CHANGE")) {
      const recentJobChanges = allSignals.filter(
        (s) => s.type === "JOB_CHANGE" && differenceInDays(now, new Date(s.date)) < 30
      );
      const ownChange = recentJobChanges.find((s) => s.contactId === contact.id);
      if (ownChange) {
        const otherPartners = await getPartnerRelationsForPerson(contact.name, contact.companyId, partnerId);
        insights.push({
          type: "JOB_CHANGE",
          reason: `${contact.name} had a recent role change: "${ownChange.content}".`,
          priority: "HIGH",
          signalId: ownChange.id,
          signalContent: ownChange.content,
          signalUrl: ownChange.url,
          relatedPartners: otherPartners.length > 0 ? otherPartners : undefined,
          personName: contact.name,
        });
      } else {
        const companyChange = recentJobChanges.find((s) => s.contactId !== contact.id);
        if (companyChange && companyChange.contactId) {
          const changedPerson = await prisma.contact.findUnique({
            where: { id: companyChange.contactId },
            select: { name: true, companyId: true, partnerId: true, partner: { select: { name: true } } },
          });
          const relatedPartners = changedPerson
            ? [{ partnerId: changedPerson.partnerId, partnerName: changedPerson.partner.name }]
            : [];
          const personName = changedPerson?.name
            ?? companyChange.content.split(/\s+(has|promoted|announced|transitioned|expanded)/)[0].trim();
          insights.push({
            type: "JOB_CHANGE",
            reason: `Executive transition at ${contact.company.name}: "${companyChange.content}".`,
            priority: contact.importance === "CRITICAL" ? "HIGH" : "MEDIUM",
            signalId: companyChange.id,
            signalContent: companyChange.content,
            signalUrl: companyChange.url,
            relatedPartners: relatedPartners.length > 0 ? relatedPartners : undefined,
            personName,
          });
        }
      }
    }

    // --- Company News (pick top 3 most recent, not all) ---
    if (config.companyNewsEnabled && !disabledTypes.has("COMPANY_NEWS")) {
      const recentNewsSignals = allSignals.filter(
        (s) => s.type === "NEWS" && differenceInDays(now, new Date(s.date)) < 14
      );
      const newsUsed = new Set<string>();
      for (const newsSignal of recentNewsSignals) {
        if (newsUsed.has(newsSignal.id)) continue;
        newsUsed.add(newsSignal.id);
        if (newsUsed.size > 3) break;
        insights.push({
          type: "COMPANY_NEWS",
          reason: `${contact.company.name} in the news: "${newsSignal.content.length > 150 ? newsSignal.content.slice(0, 150) + "…" : newsSignal.content}".`,
          priority: "MEDIUM",
          signalId: newsSignal.id,
          signalContent: newsSignal.content,
          signalUrl: newsSignal.url,
        });
      }
    }

    // --- Upcoming Event ---
    if (config.upcomingEventEnabled && !disabledTypes.has("UPCOMING_EVENT")) {
      const upcomingEvent = allSignals.find(
        (s) => s.type === "EVENT" && differenceInDays(new Date(s.date), now) >= 0 && differenceInDays(new Date(s.date), now) < 21
      );
      if (upcomingEvent) {
        insights.push({
          type: "UPCOMING_EVENT",
          reason: `${upcomingEvent.content}. Opportunity to connect around this event.`,
          priority: "MEDIUM",
          signalId: upcomingEvent.id,
          signalContent: upcomingEvent.content,
          signalUrl: upcomingEvent.url,
        });
      }
    }

    // --- Meeting Prep ---
    if (config.meetingPrepEnabled && !disabledTypes.has("MEETING_PREP")) {
      const upcomingMeeting = meetings.find((m) => {
        const daysUntil = differenceInDays(new Date(m.startTime), now);
        return daysUntil >= 0 && daysUntil <= 3;
      });
      if (upcomingMeeting) {
        insights.push({
          type: "MEETING_PREP",
          reason: `Meeting "${upcomingMeeting.title}" coming up soon. Prepare your brief and talking points.`,
          priority: "HIGH",
        });
      }
    }

    // --- Event Attended ---
    if (config.eventAttendedEnabled && !disabledTypes.has("EVENT_ATTENDED")) {
      const events = eventsByContact.get(contact.id) ?? [];
      const recentAttendedEvent = events.find(
        (e) => e.status === "Attended" && differenceInDays(now, new Date(e.eventDate)) >= 0 && differenceInDays(now, new Date(e.eventDate)) < 30
      );
      if (recentAttendedEvent) {
        insights.push({
          type: "EVENT_ATTENDED",
          reason: `Attended "${recentAttendedEvent.name}" (${recentAttendedEvent.practice}) recently. Follow up on key takeaways.`,
          priority: contact.importance === "CRITICAL" ? "HIGH" : "MEDIUM",
        });
      }
    }

    // --- Event Registered ---
    if (config.eventRegisteredEnabled && !disabledTypes.has("EVENT_REGISTERED")) {
      const events = eventsByContact.get(contact.id) ?? [];
      const recentRegisteredEvent = events.find(
        (e) => e.status === "Registered" && differenceInDays(new Date(e.eventDate), now) >= 0 && differenceInDays(new Date(e.eventDate), now) <= 14
      );
      if (recentRegisteredEvent) {
        insights.push({
          type: "EVENT_REGISTERED",
          reason: `Registered for "${recentRegisteredEvent.name}" coming up soon. Schedule a side conversation or send a pre-event note.`,
          priority: "MEDIUM",
        });
      }
    }

    // --- LinkedIn Activity (pick top 2) ---
    if (config.linkedinActivityEnabled && !disabledTypes.has("LINKEDIN_ACTIVITY")) {
      const ownLinkedinSignals = allSignals.filter(
        (s) => s.type === "LINKEDIN_ACTIVITY" && s.contactId === contact.id && differenceInDays(now, new Date(s.date)) < 14
      );
      let liCount = 0;
      for (const liSignal of ownLinkedinSignals) {
        if (liCount >= 2) break;
        liCount++;
        const snippet = liSignal.content.length > 150 ? liSignal.content.slice(0, 150) + "…" : liSignal.content;
        insights.push({
          type: "LINKEDIN_ACTIVITY",
          reason: `Active on LinkedIn: "${snippet}".`,
          priority: contact.importance === "CRITICAL" || contact.importance === "HIGH" ? "HIGH" : "MEDIUM",
          signalId: liSignal.id,
          signalContent: liSignal.content,
          signalUrl: liSignal.url,
        });
      }
    }

    // --- Article Read ---
    if (config.articleReadEnabled && !disabledTypes.has("ARTICLE_READ")) {
      const articles = articlesByContact.get(contact.id) ?? [];
      const recentArticleView = articles.find(
        (a) => a.views > 0 && a.lastViewDate && differenceInDays(now, new Date(a.lastViewDate)) < 14
      );
      if (recentArticleView) {
        insights.push({
          type: "ARTICLE_READ",
          reason: `Viewed "${recentArticleView.name}" (${recentArticleView.views} view${recentArticleView.views !== 1 ? "s" : ""}). Engaged with your thought leadership.`,
          priority: contact.importance === "CRITICAL" || contact.importance === "HIGH" ? "HIGH" : "MEDIUM",
        });
      }
    }

    // Find last non-email interaction for relationship context
    const lastNonEmailInteraction = interactions
      .filter((i) => i.type !== "EMAIL" && i.summary)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const lastInteractionCtx = lastNonEmailInteraction
      ? {
          type: lastNonEmailInteraction.type,
          date: formatDateForLLM(new Date(lastNonEmailInteraction.date)),
          summary: lastNonEmailInteraction.summary!,
        }
      : undefined;

    // --- Active Sequence Follow-Up ---
    const activeSeq = await sequenceRepo.findActiveByContactId(contact.id);
    if (activeSeq) {
      const waitDays = getWaitingDays(activeSeq);
      const currentStepObj = activeSeq.steps.find(
        (s) => s.stepNumber === activeSeq.currentStep
      );
      if (currentStepObj && currentStepObj.status !== "RESPONDED") {
        const lastSentStep = [...activeSeq.steps]
          .filter((s) => s.status === "SENT" && s.emailSubject)
          .sort((a, b) => b.stepNumber - a.stepNumber)[0];
        insights.push({
          type: "FOLLOW_UP",
          reason: buildSequenceNudgeReason(contact.name, waitDays),
          priority: "HIGH",
          lastEmailSubject: lastSentStep?.emailSubject ?? undefined,
          lastEmailSnippet: lastSentStep?.emailBody
            ? lastSentStep.emailBody.replace(/\n/g, " ").slice(0, 150)
            : undefined,
          waitingDays: waitDays,
          lastInteraction: lastInteractionCtx,
        });
      }
    }

    // --- Reply Needed (inbound email not responded to) ---
    if (!disabledTypes.has("REPLY_NEEDED")) {
      const recentInbound = interactions.filter(
        (i) =>
          i.direction === "INBOUND" &&
          i.type === "EMAIL" &&
          !i.repliedAt &&
          differenceInDays(now, new Date(i.date)) >= 1 &&
          differenceInDays(now, new Date(i.date)) <= 7
      );
      if (recentInbound.length > 0) {
        const oldest = recentInbound[recentInbound.length - 1];
        const daysSinceEmail = differenceInDays(now, new Date(oldest.date));
        insights.push({
          type: "REPLY_NEEDED",
          reason: buildReplyNeededReason(contact.name, daysSinceEmail),
          priority:
            contact.importance === "CRITICAL" || contact.importance === "HIGH"
              ? "URGENT"
              : "HIGH",
          inboundSummary: oldest.summary ?? undefined,
          waitingDays: daysSinceEmail,
          lastInteraction: lastInteractionCtx,
        });
      }
    }

    // --- Consolidate into one nudge per contact ---
    if (insights.length === 0) continue;

    const primary = pickPrimary(insights);
    const reason = buildReason(contact.name, contact.company.name, insights);

    const candidate: NudgeCandidate = {
      contactId: contact.id,
      signalId: primary.signalId,
      ruleType: primary.ruleType,
      reason,
      priority: primary.priority,
      metadata: JSON.stringify({ insights }),
    };

    if (activeSeq && primary.ruleType === "FOLLOW_UP") {
      candidate.sequenceId = activeSeq.id;
      const currentStepObj = activeSeq.steps.find(
        (s) => s.stepNumber === activeSeq.currentStep
      );
      if (currentStepObj) candidate.cadenceStepId = currentStepObj.id;
    }

    candidates.push(candidate);
  }

  // --- Article Campaign nudge (best single article per partner) ---
  if (config.articleCampaignEnabled) {
    const recentArticles = await prisma.contentItem.findMany({
      where: { type: "ARTICLE", publishedAt: { gte: subDays(now, 14) } },
      orderBy: { publishedAt: "desc" },
    });

    let bestArticleNudge: typeof candidates[number] | null = null;
    let bestScore = -1;

    for (const article of recentArticles) {
      const scored = scoreContactsForArticle({
        practice: article.practice,
        contacts: contacts.map((c) => ({
          id: c.id,
          importance: c.importance,
          lastContacted: c.lastContacted,
          company: { industry: c.company.industry ?? "" },
        })),
        articlesByContact,
        now,
      });
      if (scored.length === 0) continue;

      const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
      if (totalScore <= bestScore) continue;
      bestScore = totalScore;

      const hasCritical = scored.some((s) =>
        contacts.find((c) => c.id === s.contactId)?.importance === "CRITICAL"
      );
      const priority = hasCritical ? "HIGH" : "MEDIUM";
      const reason = `New article "${article.title}" published — ${scored.length} contact${scored.length !== 1 ? "s" : ""} matched based on industry and engagement`;

      bestArticleNudge = {
        contactId: scored[0].contactId,
        ruleType: "ARTICLE_CAMPAIGN",
        reason,
        priority,
        metadata: JSON.stringify({
          insights: [{ type: "ARTICLE_CAMPAIGN", reason, priority }],
          contentItemId: article.id,
          matchedContactIds: scored.map((s) => s.contactId),
          matchCount: scored.length,
          articleTitle: article.title,
          articleDescription: article.description ?? "",
          articlePractice: article.practice ?? "",
        }),
      };
    }

    if (bestArticleNudge) {
      candidates.push(bestArticleNudge);
    }
  }

  // --- Campaign Approval nudge (single most urgent campaign per partner) ---
  const pendingApprovalRecipients = await prisma.campaignRecipient.findMany({
    where: {
      assignedPartnerId: partnerId,
      approvalStatus: "PENDING",
    },
    include: {
      campaign: true,
      contact: { select: { id: true, name: true, companyId: true, company: { select: { name: true } } } },
    },
  });

  const byCampaign = new Map<string, typeof pendingApprovalRecipients>();
  for (const r of pendingApprovalRecipients) {
    const arr = byCampaign.get(r.campaignId);
    if (arr) arr.push(r);
    else byCampaign.set(r.campaignId, [r]);
  }

  let bestApprovalNudge: typeof candidates[number] | null = null;
  let bestApprovalUrgency = Infinity;

  for (const [campaignId, recs] of byCampaign) {
    const campaign = recs[0].campaign;
    if (campaign.status !== "PENDING_APPROVAL") continue;

    const pendingCount = recs.length;
    const deadline = recs[0].approvalDeadline;
    const daysUntilDeadline = deadline
      ? differenceInDays(new Date(deadline), now)
      : 7;

    let priority: string;
    if (daysUntilDeadline <= 0) {
      priority = "URGENT";
    } else if (daysUntilDeadline <= 2) {
      priority = "HIGH";
    } else {
      priority = "MEDIUM";
    }

    if (daysUntilDeadline >= bestApprovalUrgency) continue;
    bestApprovalUrgency = daysUntilDeadline;

    const deadlineStr = deadline
      ? ` (due ${new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
      : "";
    const reason = `Campaign "${campaign.name}" has ${pendingCount} contact${pendingCount !== 1 ? "s" : ""} pending your review${deadlineStr}.`;

    const firstContactWithId = recs.find((r) => r.contactId);
    const contactId = firstContactWithId?.contactId ?? contacts[0]?.id;
    if (!contactId) continue;

    bestApprovalNudge = {
      contactId,
      ruleType: "CAMPAIGN_APPROVAL",
      reason,
      priority,
      metadata: JSON.stringify({
        insights: [{
          type: "CAMPAIGN_APPROVAL",
          reason,
          priority,
        }],
        campaignId,
        pendingCount,
        deadline: deadline?.toISOString() ?? null,
      }),
    };
  }

  if (bestApprovalNudge) {
    candidates.push(bestApprovalNudge);
  }

  await nudgeRepo.deleteOpenByPartnerId(partnerId);
  if (candidates.length > 0) {
    await nudgeRepo.createMany(candidates);
  }

  // Fire-and-forget: enrich nudges with strategic insights in the background
  // so the refresh returns immediately and doesn't block briefing generation
  enrichNudgesWithInsights(partnerId).catch((err) =>
    console.error("[nudge-engine] Strategic insight generation failed:", err instanceof Error ? err.message : err),
  );

  return candidates.length;
}

async function enrichNudgesWithInsights(partnerId: string) {
  const createdNudges = await nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" });
  const eligible = createdNudges.filter((n) => ELIGIBLE_INSIGHT_TYPES.has(n.ruleType));
  if (eligible.length === 0) return;

  const partner = await partnerRepo.findById(partnerId);
  const partnerName = partner?.name ?? "Partner";

  // Process in batches of 3 to avoid overwhelming the LLM API
  const BATCH_SIZE = 3;
  let enriched = 0;
  let skipped = 0;
  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (nudge) => {
        try {
          const meta = JSON.parse(nudge.metadata ?? "{}");
          if (meta.strategicInsight) { skipped++; return; }
          const insight = await generateStrategicInsight(nudge, meta.insights ?? [], partnerName);
          if (insight) {
            meta.strategicInsight = insight;
            await nudgeRepo.updateMetadata(nudge.id, JSON.stringify(meta));
            enriched++;
          }
        } catch {
          // Individual insight failure should not affect other nudges
        }
      }),
    );
  }
  console.log(`[nudge-engine] Strategic insights: ${enriched} enriched, ${skipped} already had insights, ${eligible.length} eligible`);
}

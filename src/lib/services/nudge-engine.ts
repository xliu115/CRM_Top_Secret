import { contactRepo, interactionRepo, signalRepo, nudgeRepo, meetingRepo, engagementRepo, nudgeRuleConfigRepo } from "@/lib/repositories";
import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";

interface NudgeCandidate {
  contactId: string;
  signalId?: string;
  ruleType: string;
  reason: string;
  priority: string;
}

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

export async function refreshNudgesForPartner(partnerId: string) {
  const contacts = await contactRepo.findByPartnerId(partnerId);
  const now = new Date();
  const candidates: NudgeCandidate[] = [];

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

  for (const contact of contacts) {
    const interactions = interactionsByContact.get(contact.id) ?? [];
    const signals = contactSignalsByContact.get(contact.id) ?? [];
    const companySignals = companySignalsByCompany.get(contact.companyId) ?? [];
    const meetings = meetingsByContact.get(contact.id) ?? [];
    const allSignals = [...signals, ...companySignals];

    const lastInteraction = interactions[0];
    const daysSince = lastInteraction
      ? differenceInDays(now, new Date(lastInteraction.date))
      : 999;

    if (config.staleContactEnabled) {
      const tierThreshold: Record<string, number> = {
        CRITICAL: config.staleDaysCritical,
        HIGH: config.staleDaysHigh,
        MEDIUM: config.staleDaysMedium,
        LOW: config.staleDaysLow,
      };
      const threshold = contact.staleThresholdDays ?? tierThreshold[contact.importance] ?? config.staleDaysMedium;

      if (daysSince > threshold) {
        const priorityMap: Record<string, string> = {
          CRITICAL: "URGENT",
          HIGH: "HIGH",
          MEDIUM: "MEDIUM",
          LOW: "MEDIUM",
        };
        candidates.push({
          contactId: contact.id,
          ruleType: "STALE_CONTACT",
          reason: `No interaction with ${contact.name} (${contact.title} at ${contact.company.name}) in ${daysSince} days — threshold is ${threshold} days.`,
          priority: priorityMap[contact.importance] ?? "MEDIUM",
        });
      }
    }

    if (config.jobChangeEnabled) {
      const recentJobChange = allSignals.find(
        (s) =>
          s.type === "JOB_CHANGE" &&
          differenceInDays(now, new Date(s.date)) < 30
      );
      if (recentJobChange) {
        candidates.push({
          contactId: contact.id,
          signalId: recentJobChange.id,
          ruleType: "JOB_CHANGE",
          reason: `${contact.name} had a recent role change: "${recentJobChange.content}". Great opportunity to reconnect and congratulate.`,
          priority: "HIGH",
        });
      }
    }

    if (config.companyNewsEnabled) {
      const recentNewsSignals = allSignals.filter(
        (s) =>
          s.type === "NEWS" &&
          differenceInDays(now, new Date(s.date)) < 14
      );
      const newsUsed = new Set<string>();
      for (const newsSignal of recentNewsSignals) {
        if (newsUsed.has(newsSignal.id)) continue;
        newsUsed.add(newsSignal.id);
        const snippet = newsSignal.content.length > 200
          ? newsSignal.content.slice(0, 200) + "…"
          : newsSignal.content;
        candidates.push({
          contactId: contact.id,
          signalId: newsSignal.id,
          ruleType: "COMPANY_NEWS",
          reason: `${contact.company.name} in the news: "${snippet}". Reach out to ${contact.name} with a relevant point of view.`,
          priority: "MEDIUM",
        });
      }
    }

    if (config.upcomingEventEnabled) {
      const upcomingEvent = allSignals.find(
        (s) =>
          s.type === "EVENT" &&
          differenceInDays(new Date(s.date), now) >= 0 &&
          differenceInDays(new Date(s.date), now) < 21
      );
      if (upcomingEvent) {
        candidates.push({
          contactId: contact.id,
          signalId: upcomingEvent.id,
          ruleType: "UPCOMING_EVENT",
          reason: `${upcomingEvent.content}. Opportunity to connect with ${contact.name} around this event.`,
          priority: "MEDIUM",
        });
      }
    }

    if (config.meetingPrepEnabled) {
      const upcomingMeeting = meetings.find(
        (m) => {
          const daysUntil = differenceInDays(new Date(m.startTime), now);
          return daysUntil >= 0 && daysUntil <= 3;
        }
      );
      if (upcomingMeeting) {
        candidates.push({
          contactId: contact.id,
          ruleType: "MEETING_PREP",
          reason: `Meeting "${upcomingMeeting.title}" coming up soon with ${contact.name}. Prepare your brief and talking points.`,
          priority: "HIGH",
        });
      }
    }

    if (config.eventAttendedEnabled) {
      const events = eventsByContact.get(contact.id) ?? [];
      const recentAttendedEvent = events.find(
        (e) =>
          e.status === "Attended" &&
          differenceInDays(now, new Date(e.eventDate)) >= 0 &&
          differenceInDays(now, new Date(e.eventDate)) < 30
      );
      if (recentAttendedEvent) {
        candidates.push({
          contactId: contact.id,
          ruleType: "EVENT_ATTENDED",
          reason: `${contact.name} attended "${recentAttendedEvent.name}" (${recentAttendedEvent.practice}) recently. Follow up on key takeaways and explore opportunities.`,
          priority: contact.importance === "CRITICAL" ? "HIGH" : "MEDIUM",
        });
      }
    }

    if (config.eventRegisteredEnabled) {
      const events = eventsByContact.get(contact.id) ?? [];
      const recentRegisteredEvent = events.find(
        (e) =>
          e.status === "Registered" &&
          differenceInDays(new Date(e.eventDate), now) >= 0 &&
          differenceInDays(new Date(e.eventDate), now) <= 14
      );
      if (recentRegisteredEvent) {
        candidates.push({
          contactId: contact.id,
          ruleType: "EVENT_REGISTERED",
          reason: `${contact.name} is registered for "${recentRegisteredEvent.name}" coming up soon. Great opportunity to schedule a side conversation or send a pre-event note.`,
          priority: "MEDIUM",
        });
      }
    }

    if (config.articleReadEnabled) {
      const articles = articlesByContact.get(contact.id) ?? [];
      const recentArticleView = articles.find(
        (a) =>
          a.views > 0 &&
          a.lastViewDate &&
          differenceInDays(now, new Date(a.lastViewDate)) < 14
      );
      if (recentArticleView) {
        candidates.push({
          contactId: contact.id,
          ruleType: "ARTICLE_READ",
          reason: `${contact.name} recently viewed "${recentArticleView.name}" (${recentArticleView.views} view${recentArticleView.views !== 1 ? "s" : ""}). Use this as a conversation starter — they're engaged with your thought leadership.`,
          priority: contact.importance === "CRITICAL" || contact.importance === "HIGH" ? "HIGH" : "MEDIUM",
        });
      }
    }
  }

  // Clear old open nudges and create new ones
  await nudgeRepo.deleteOpenByPartnerId(partnerId);
  if (candidates.length > 0) {
    await nudgeRepo.createMany(candidates);
  }

  return candidates.length;
}

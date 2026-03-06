import { contactRepo, interactionRepo, signalRepo, nudgeRepo, meetingRepo, engagementRepo } from "@/lib/repositories";
import { differenceInDays } from "date-fns";

interface NudgeCandidate {
  contactId: string;
  signalId?: string;
  ruleType: string;
  reason: string;
  priority: string;
}

export async function refreshNudgesForPartner(partnerId: string) {
  const contacts = await contactRepo.findByPartnerId(partnerId);
  const now = new Date();
  const candidates: NudgeCandidate[] = [];

  for (const contact of contacts) {
    const interactions = await interactionRepo.findByContactId(contact.id);
    const signals = await signalRepo.findByContactId(contact.id);
    const companySignals = await signalRepo.findByCompanyId(contact.companyId);
    const meetings = await meetingRepo.findByContactId(contact.id);
    const allSignals = [...signals, ...companySignals];

    const lastInteraction = interactions[0];
    const daysSince = lastInteraction
      ? differenceInDays(now, new Date(lastInteraction.date))
      : 999;

    // Rule: Stale contact
    if (daysSince > 90) {
      candidates.push({
        contactId: contact.id,
        ruleType: "STALE_CONTACT",
        reason: `No interaction with ${contact.name} (${contact.title} at ${contact.company.name}) in ${daysSince} days. High-value relationship may be cooling.`,
        priority: contact.importance === "CRITICAL" ? "URGENT" : "HIGH",
      });
    } else if (daysSince > 60) {
      candidates.push({
        contactId: contact.id,
        ruleType: "STALE_CONTACT",
        reason: `It's been ${daysSince} days since your last interaction with ${contact.name} at ${contact.company.name}. Consider a check-in.`,
        priority: contact.importance === "CRITICAL" || contact.importance === "HIGH" ? "HIGH" : "MEDIUM",
      });
    } else if (
      daysSince > 30 &&
      (contact.importance === "CRITICAL" || contact.importance === "HIGH")
    ) {
      candidates.push({
        contactId: contact.id,
        ruleType: "STALE_CONTACT",
        reason: `${daysSince} days since last touchpoint with ${contact.name} (${contact.importance} priority). Time for a proactive outreach.`,
        priority: "MEDIUM",
      });
    }

    // Rule: Job change
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

    // Rule: Company news
    const recentNews = allSignals.find(
      (s) =>
        s.type === "NEWS" &&
        differenceInDays(now, new Date(s.date)) < 14
    );
    if (recentNews) {
      candidates.push({
        contactId: contact.id,
        signalId: recentNews.id,
        ruleType: "COMPANY_NEWS",
        reason: `${contact.company.name} in the news: "${recentNews.content}". Reach out to ${contact.name} with a relevant point of view.`,
        priority: "MEDIUM",
      });
    }

    // Rule: Upcoming event
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

    // Rule: Meeting prep
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

    // Rule: Recent event attendance — follow up with attendees
    const events = await engagementRepo.findEventsByContactId(contact.id);
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

    // Rule: Article engagement — contact read your content
    const articles = await engagementRepo.findArticlesByContactId(contact.id);
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

  // Clear old open nudges and create new ones
  await nudgeRepo.deleteOpenByPartnerId(partnerId);
  if (candidates.length > 0) {
    await nudgeRepo.createMany(candidates);
  }

  return candidates.length;
}

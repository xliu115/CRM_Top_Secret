import { partners } from "./partners";
import { companies } from "./companies";

interface ContactRef {
  id: string;
  name: string;
  companyId: string;
  partnerId: string;
  title: string;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

const meetingTitles = [
  "Quarterly Business Review with {company}",
  "Strategy Alignment: {company} Partnership",
  "{company} – Executive Check-in",
  "Technical Deep Dive: {area} with {company}",
  "{company} Contract Renewal Discussion",
  "Innovation Workshop with {company}",
  "{company} – Relationship Planning Session",
  "Deal Review: {company} Expansion",
  "{company} Onboarding Kickoff",
  "Pipeline Review with {company} Team",
];

const purposes = [
  "Review Q1 performance metrics and discuss expansion opportunities.",
  "Align on strategic priorities for the next 12 months.",
  "Executive-level relationship building and trust deepening.",
  "Deep dive into technical requirements for upcoming initiative.",
  "Negotiate terms for contract renewal and potential upsell.",
  "Collaborative workshop to explore innovation use cases.",
  "Annual relationship health check and planning.",
  "Review active deals and identify acceleration opportunities.",
  "Kick off new engagement stream with introductions.",
  "Review pipeline health and forecast for the quarter.",
];

const areas = [
  "AI/ML",
  "Cloud Migration",
  "Data Platform",
  "Digital Transformation",
  "Cybersecurity",
  "Enterprise Architecture",
];

export function generateMeetings(contacts: ContactRef[]) {
  const rand = seededRandom(789);
  const meetings: {
    id: string;
    partnerId: string;
    startTime: Date;
    title: string;
    purpose: string;
    notes: string | null;
    attendees: { contactId: string; isRequired: boolean }[];
  }[] = [];

  const now = new Date();
  let idx = 0;

  // Group contacts by partner
  const contactsByPartner: Record<string, ContactRef[]> = {};
  for (const c of contacts) {
    if (!contactsByPartner[c.partnerId]) contactsByPartner[c.partnerId] = [];
    contactsByPartner[c.partnerId].push(c);
  }

  for (const partner of partners) {
    const pContacts = contactsByPartner[partner.id] || [];
    if (pContacts.length === 0) continue;

    // Past meetings
    const pastCount = 6 + Math.floor(rand() * 8);
    for (let i = 0; i < pastCount; i++) {
      const daysAgo = 1 + Math.floor(rand() * 180);
      const hour = 9 + Math.floor(rand() * 8);
      const date = new Date(now.getTime() - daysAgo * 86400000);
      date.setHours(hour, 0, 0, 0);

      const attendeeCount = 1 + Math.floor(rand() * 3);
      const shuffled = [...pContacts].sort(() => rand() - 0.5);
      const attendees = shuffled.slice(0, Math.min(attendeeCount, shuffled.length));
      const primaryContact = attendees[0];
      const company = companies.find((c) => c.id === primaryContact.companyId)!;
      const area = areas[Math.floor(rand() * areas.length)];

      const titleTemplate =
        meetingTitles[Math.floor(rand() * meetingTitles.length)];
      const title = titleTemplate
        .replace(/{company}/g, company.name)
        .replace(/{area}/g, area);

      meetings.push({
        id: `mtg-${String(idx).padStart(3, "0")}`,
        partnerId: partner.id,
        startTime: date,
        title,
        purpose: purposes[Math.floor(rand() * purposes.length)],
        notes: `Meeting went well. Discussed ${area.toLowerCase()} initiatives. ${primaryContact.name} was engaged and receptive.`,
        attendees: attendees.map((a, ai) => ({
          contactId: a.id,
          isRequired: ai === 0 || rand() > 0.3,
        })),
      });
      idx++;
    }

    // This-week meetings (guaranteed to populate the default view)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getTime() + mondayOffset * 86400000);
    monday.setHours(0, 0, 0, 0);

    const thisWeekCount = 5 + Math.floor(rand() * 4);
    for (let i = 0; i < thisWeekCount; i++) {
      const dayOffset = Math.floor(rand() * 7);
      const hour = 8 + Math.floor(rand() * 9);
      const minute = rand() > 0.5 ? 30 : 0;
      const date = new Date(monday.getTime() + dayOffset * 86400000);
      date.setHours(hour, minute, 0, 0);

      const attendeeCount = 1 + Math.floor(rand() * 3);
      const shuffled = [...pContacts].sort(() => rand() - 0.5);
      const attendees = shuffled.slice(0, Math.min(attendeeCount, shuffled.length));
      const primaryContact = attendees[0];
      const company = companies.find((c) => c.id === primaryContact.companyId)!;
      const area = areas[Math.floor(rand() * areas.length)];

      const titleTemplate =
        meetingTitles[Math.floor(rand() * meetingTitles.length)];
      const title = titleTemplate
        .replace(/{company}/g, company.name)
        .replace(/{area}/g, area);

      const isPastMeeting = date < now;
      meetings.push({
        id: `mtg-${String(idx).padStart(3, "0")}`,
        partnerId: partner.id,
        startTime: date,
        title,
        purpose: purposes[Math.floor(rand() * purposes.length)],
        notes: isPastMeeting
          ? `Meeting went well. Discussed ${area.toLowerCase()} initiatives. ${primaryContact.name} was engaged and receptive.`
          : null,
        attendees: attendees.map((a, ai) => ({
          contactId: a.id,
          isRequired: ai === 0 || rand() > 0.3,
        })),
      });
      idx++;
    }

    // Additional upcoming meetings (next 2-30 days)
    const upcomingCount = 3 + Math.floor(rand() * 5);
    for (let i = 0; i < upcomingCount; i++) {
      const daysAhead = 1 + Math.floor(rand() * 30);
      const hour = 9 + Math.floor(rand() * 8);
      const date = new Date(now.getTime() + daysAhead * 86400000);
      date.setHours(hour, 0, 0, 0);

      const attendeeCount = 1 + Math.floor(rand() * 3);
      const shuffled = [...pContacts].sort(() => rand() - 0.5);
      const attendees = shuffled.slice(0, Math.min(attendeeCount, shuffled.length));
      const primaryContact = attendees[0];
      const company = companies.find((c) => c.id === primaryContact.companyId)!;
      const area = areas[Math.floor(rand() * areas.length)];

      const titleTemplate =
        meetingTitles[Math.floor(rand() * meetingTitles.length)];
      const title = titleTemplate
        .replace(/{company}/g, company.name)
        .replace(/{area}/g, area);

      meetings.push({
        id: `mtg-${String(idx).padStart(3, "0")}`,
        partnerId: partner.id,
        startTime: date,
        title,
        purpose: purposes[Math.floor(rand() * purposes.length)],
        notes: null,
        attendees: attendees.map((a, ai) => ({
          contactId: a.id,
          isRequired: ai === 0 || rand() > 0.3,
        })),
      });
      idx++;
    }
  }

  return meetings;
}

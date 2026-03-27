import type { StoryKind } from "@/lib/dashboard-news-classifier";
import {
  classifyStoryKind,
  qualifiesForBreakingStrip,
  signalTouchesPriorityContact,
  STORY_KIND_LABEL,
} from "@/lib/dashboard-news-classifier";
import { buildNewsCatchyTitle } from "@/lib/dashboard-assistant-copy";

export type RawSignalForDashboard = {
  id: string;
  type: string;
  date: Date;
  content: string;
  url: string | null;
  contactId: string | null;
  companyId: string | null;
  contact: {
    id: string;
    name: string;
    importance: string;
    company: { id: string; name: string } | null;
  } | null;
  company: { id: string; name: string } | null;
};

export type EnrichedClientNewsItem = {
  id: string;
  type: string;
  date: string;
  content: string;
  url: string | null;
  contact: {
    name: string;
    company?: string;
    id?: string;
  } | null;
  company: { id: string; name: string } | null;
  storyKind: StoryKind;
  storyKindLabel: string;
  priorityContactRelevant: boolean;
  catchyTitle: string;
  linkContactId: string | null;
  linkCompanyId: string | null;
};

export function enrichSignalsForDashboard(
  signals: RawSignalForDashboard[],
  priorityContacts: { id: string; companyId: string }[],
  now: Date
): {
  clientNews: EnrichedClientNewsItem[];
  criticalBreakingNews: EnrichedClientNewsItem[];
  breakingIds: Set<string>;
} {
  const priorityCompanyIds = new Set(priorityContacts.map((c) => c.companyId));
  const companyToPriorityContactId = new Map<string, string>();
  for (const c of priorityContacts) {
    if (!companyToPriorityContactId.has(c.companyId)) {
      companyToPriorityContactId.set(c.companyId, c.id);
    }
  }

  const clientNews: EnrichedClientNewsItem[] = signals.map((s) => {
    const signalDate = new Date(s.date);
    const storyKind = classifyStoryKind(s.type, s.content, signalDate);
    const priorityContactRelevant = signalTouchesPriorityContact(
      {
        contactId: s.contactId,
        companyId: s.companyId,
        contact: s.contact
          ? { id: s.contact.id, importance: s.contact.importance }
          : null,
      },
      priorityCompanyIds
    );

    const companyName =
      s.contact?.company?.name ?? s.company?.name ?? "Account";

    const linkContactId =
      s.contact?.id ?? (s.companyId ? companyToPriorityContactId.get(s.companyId) ?? null : null);
    const linkCompanyId = s.company?.id ?? s.contact?.company?.id ?? null;

    return {
      id: s.id,
      type: s.type,
      date: s.date.toISOString(),
      content: s.content,
      url: s.url,
      contact: s.contact
        ? {
            name: s.contact.name,
            company: s.contact.company?.name,
            id: s.contact.id,
          }
        : null,
      company: s.company,
      storyKind,
      storyKindLabel: STORY_KIND_LABEL[storyKind],
      priorityContactRelevant,
      catchyTitle: buildNewsCatchyTitle(storyKind, companyName, s.content),
      linkContactId,
      linkCompanyId,
    };
  });

  const criticalBreakingNews = clientNews
    .filter((item) => {
      const signalDate = new Date(item.date);
      return qualifiesForBreakingStrip({
        storyKind: item.storyKind,
        priorityContactRelevant: item.priorityContactRelevant,
        signalType: item.type,
        signalDate,
        now,
      });
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const breakingIds = new Set(criticalBreakingNews.map((x) => x.id));

  return { clientNews, criticalBreakingNews, breakingIds };
}

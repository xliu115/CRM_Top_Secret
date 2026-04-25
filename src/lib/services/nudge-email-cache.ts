import { prisma } from "@/lib/db/prisma";
import { generateEmail } from "@/lib/services/llm-service";
import { interactionRepo } from "@/lib/repositories";
import { formatDateForLLM } from "@/lib/utils/format-date";

const RULE_TYPE_CONTEXT: Record<string, string> = {
  STALE_CONTACT:
    "This is a check-in email to reconnect with a contact you haven't spoken to in a while.",
  JOB_CHANGE:
    "This is a congratulations email for a contact who recently changed roles or got promoted.",
  COMPANY_NEWS:
    "This is an outreach email referencing recent company news as a conversation starter.",
  UPCOMING_EVENT: "This is a pre-event email to connect before an upcoming event.",
  MEETING_PREP:
    "This is a pre-meeting email to confirm or prepare for an upcoming meeting.",
  EVENT_ATTENDED: "This is a follow-up email after a contact attended an event.",
  EVENT_REGISTERED:
    "This is an outreach email to connect before an event the contact is registered for.",
  ARTICLE_READ:
    "This is a follow-up email referencing content the contact recently engaged with.",
  LINKEDIN_ACTIVITY:
    "This is an outreach email inspired by the contact's recent LinkedIn activity.",
  FOLLOW_UP:
    "This is a follow-up email as part of an active outreach sequence. The contact hasn't responded to your previous outreach.",
  REPLY_NEEDED:
    "This is a reply to an inbound email from the contact that hasn't been responded to yet.",
};

export interface CachedDraft {
  subject: string;
  body: string;
}

export function readCachedDraft(generatedEmail: string | null): CachedDraft | null {
  if (!generatedEmail) return null;
  try {
    const parsed = JSON.parse(generatedEmail) as {
      subject?: unknown;
      body?: unknown;
    };
    if (
      typeof parsed.subject === "string" &&
      typeof parsed.body === "string" &&
      parsed.subject.trim() &&
      parsed.body.trim()
    ) {
      return { subject: parsed.subject, body: parsed.body };
    }
  } catch {
    // malformed — treat as cache miss
  }
  return null;
}

/**
 * Generate and persist a draft email for a nudge.
 *
 * Idempotent — if `generatedEmail` is already populated and `force` is false,
 * the cached draft is returned without an LLM call. Use `force: true` from
 * tone-change paths (warmer/shorter/rewrite) to bypass the cache.
 */
export async function generateAndCacheNudgeEmail(
  nudgeId: string,
  opts: { force?: boolean } = {},
): Promise<CachedDraft> {
  const nudge = await prisma.nudge.findUnique({
    where: { id: nudgeId },
    include: {
      contact: { include: { company: true, partner: true } },
      signal: true,
    },
  });
  if (!nudge) throw new Error(`Nudge ${nudgeId} not found`);

  if (!opts.force) {
    const cached = readCachedDraft(nudge.generatedEmail);
    if (cached) return cached;
  }

  const interactions = await interactionRepo.findByContactId(nudge.contactId);
  const recentInteractions = interactions
    .slice(0, 5)
    .map((i) => `${i.type} on ${formatDateForLLM(new Date(i.date))}: ${i.summary}`);

  const signals: string[] = [];
  if (nudge.signal) {
    signals.push(`${nudge.signal.type}: ${nudge.signal.content}`);
  }

  const typeContext = RULE_TYPE_CONTEXT[nudge.ruleType] ?? "";
  let nudgeReason = `${typeContext}\n\nSpecific context: ${nudge.reason}`;

  try {
    const meta = JSON.parse(nudge.metadata ?? "{}") as {
      strategicInsight?: { suggestedAction?: { context?: string } };
    };
    const ctx = meta.strategicInsight?.suggestedAction?.context;
    if (ctx) {
      nudgeReason = `${typeContext}\n\nStrategic context: ${ctx}`;
    }
  } catch {
    // fall through — use the original reason
  }

  const draft = await generateEmail({
    partnerName: nudge.contact.partner.name,
    contactName: nudge.contact.name,
    contactTitle: nudge.contact.title,
    companyName: nudge.contact.company.name,
    nudgeReason,
    recentInteractions,
    signals,
  });

  // Persist; cache writes are best-effort.
  try {
    await prisma.nudge.update({
      where: { id: nudgeId },
      data: { generatedEmail: JSON.stringify(draft) },
    });
  } catch (err) {
    console.warn(
      `[nudge-email-cache] write failed for nudge ${nudgeId}:`,
      err,
    );
  }

  return draft;
}

/**
 * Fire-and-forget pre-generation for the top-N nudges in a partner briefing.
 *
 * Skips nudges that already have a cached draft. Failures are logged but
 * never thrown — this is a speculative speedup, not a critical path.
 */
export function pregenerateTopNudgeEmails(
  nudgeIds: string[],
  opts: { concurrency?: number } = {},
): void {
  const concurrency = opts.concurrency ?? 2;

  void (async () => {
    const queue = [...nudgeIds];
    const workers: Promise<void>[] = [];

    const drain = async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        if (!id) break;
        try {
          await generateAndCacheNudgeEmail(id);
        } catch (err) {
          console.warn(
            `[nudge-email-cache] pregenerate failed for ${id}:`,
            err,
          );
        }
      }
    };

    for (let i = 0; i < Math.min(concurrency, nudgeIds.length); i++) {
      workers.push(drain());
    }
    await Promise.allSettled(workers);
  })();
}

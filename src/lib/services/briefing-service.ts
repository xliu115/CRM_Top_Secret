import { Resend } from "resend";
import { partnerRepo, nudgeRepo, meetingRepo, signalRepo, sequenceRepo, interactionRepo } from "@/lib/repositories";
import { refreshNudgesForPartner, enrichNudgesWithInsights } from "@/lib/services/nudge-engine";
import { ingestNewsForPartner } from "@/lib/services/news-ingestion-service";
import {
  generateNarrativeBriefing,
  type NarrativeBriefingContext,
} from "@/lib/services/llm-service";
import { generateMini360, type Contact360Context } from "@/lib/services/llm-contact360";
import { buildBriefingHtml, buildMini360Html } from "@/lib/services/email-service";
import { searchWeb } from "@/lib/services/rag-service";
import { addDays, isBefore, format, differenceInDays } from "date-fns";
import { formatDateForLLM } from "@/lib/utils/format-date";
import {
  buildTopNudgePayloads,
  mapLatestInteractionSummaryByContact,
} from "@/lib/services/briefing-nudge-payload";
import { createHmac } from "crypto";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const NUDGE_RECIPIENT = process.env.NUDGE_EMAIL_TO || "";
const FROM_ADDRESS = process.env.RESEND_FROM || "Activate <onboarding@resend.dev>";

export function generateUnsubscribeToken(partnerId: string): string {
  const secret = process.env.CRON_SECRET || "dev-secret";
  const payload = `${partnerId}:${Math.floor(Date.now() / 1000) + 30 * 86400}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const secret = process.env.CRON_SECRET || "dev-secret";
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [encoded, sig] = parts;
    const payload = Buffer.from(encoded, "base64url").toString();
    const expectedSig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);

    if (sig !== expectedSig) return null;

    const [partnerId, expiryStr] = payload.split(":");
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || expiry < Math.floor(Date.now() / 1000)) return null;

    return partnerId;
  } catch {
    return null;
  }
}

export async function sendMorningBriefing(
  partnerId: string,
  options?: { skipRefresh?: boolean }
): Promise<{
  sent: boolean;
  error?: string;
}> {
  const partner = await partnerRepo.findById(partnerId);
  if (!partner) {
    return { sent: false, error: "Partner not found" };
  }

  if (!partner.briefingEnabled) {
    return { sent: false, error: "Briefings disabled for this partner" };
  }

  if (!resend) {
    console.log("[briefing-service] RESEND_API_KEY not set — skipping");
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  const recipient = NUDGE_RECIPIENT || partner.email;
  if (!recipient) {
    return { sent: false, error: "No recipient email" };
  }

  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  try {
    if (!options?.skipRefresh) {
      const newsCount = await ingestNewsForPartner(partnerId);
      console.log(`[briefing-service] Ingested ${newsCount} news signals for ${partner.name}`);

      const nudgeCount = await refreshNudgesForPartner(partnerId);
      console.log(`[briefing-service] Refreshed ${nudgeCount} nudges for ${partner.name}`);

      await enrichNudgesWithInsights(partnerId);
      console.log(`[briefing-service] Enriched nudges with strategic insights for ${partner.name}`);
    }

    const now = new Date();
    const twoDaysFromNow = addDays(now, 2);

    const [openNudges, allUpcomingMeetings, clientNews, activeSequences] = await Promise.all([
      nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" }),
      meetingRepo.findUpcomingByPartnerId(partnerId),
      signalRepo.findRecentByPartnerId(partnerId, 10),
      sequenceRepo.findByPartnerId(partnerId, { status: "ACTIVE" }),
    ]);

    const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const typeOrder: Record<string, number> = {
      MEETING_PREP: 0, REPLY_NEEDED: 1, JOB_CHANGE: 2, STALE_CONTACT: 3,
      FOLLOW_UP: 4, CAMPAIGN_APPROVAL: 5, ARTICLE_CAMPAIGN: 6,
      LINKEDIN_ACTIVITY: 7, EVENT_ATTENDED: 8, EVENT_REGISTERED: 9,
      ARTICLE_READ: 10, UPCOMING_EVENT: 11, COMPANY_NEWS: 12,
    };
    const sortedNudges = [...openNudges].sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 4;
      const pb = priorityOrder[b.priority] ?? 4;
      if (pa !== pb) return pa - pb;
      return (typeOrder[a.ruleType] ?? 99) - (typeOrder[b.ruleType] ?? 99);
    });

    const reservedTypes = new Set(["CAMPAIGN_APPROVAL", "ARTICLE_CAMPAIGN", "FOLLOW_UP", "REPLY_NEEDED"]);
    const reserved = sortedNudges.filter((n) => reservedTypes.has(n.ruleType));
    const otherNudges = sortedNudges.filter((n) => !reservedTypes.has(n.ruleType));
    const seen = new Set<string>();
    const dedupedReserved = reserved.filter((n) => {
      if (seen.has(n.ruleType)) return false;
      seen.add(n.ruleType);
      return true;
    });
    const remainingSlots = Math.max(0, 5 - dedupedReserved.length);
    const mergedNudges = [...dedupedReserved, ...otherNudges.slice(0, remainingSlots)];

    const topNudges = mergedNudges.map((n) => {
      const daysSince = n.contact.lastContacted
        ? differenceInDays(now, new Date(n.contact.lastContacted))
        : undefined;

      return {
        contactName: n.contact.name,
        company: n.contact.company.name,
        reason: n.reason,
        priority: n.priority,
        contactId: n.contact.id,
        nudgeId: n.id,
        ruleType: n.ruleType,
        daysSince,
        metadata: n.metadata ?? undefined,
      };
    });

    const nearMeetings = allUpcomingMeetings
      .filter((m) => isBefore(new Date(m.startTime), twoDaysFromNow))
      .slice(0, 3)
      .map((m) => ({
        title: m.title,
        startTime: format(new Date(m.startTime), "EEE h:mm a"),
        attendeeNames: m.attendees.map((a) => a.contact.name),
        meetingId: m.id,
      }));

    const newsItems = clientNews.slice(0, 5).map((s) => ({
      content: s.content,
      contactName: s.contact?.name,
      company: s.contact?.company?.name ?? s.company?.name,
    }));

    const ctx: NarrativeBriefingContext = {
      partnerName: partner.name,
      nudges: topNudges,
      meetings: nearMeetings,
      clientNews: newsItems,
    };

    const briefingResult = await generateNarrativeBriefing(ctx);

    if (activeSequences.length > 0) {
      const seqSummaries = activeSequences.slice(0, 3).map((seq) => {
        const currentStep = seq.steps.find((s) => s.stepNumber === seq.currentStep);
        const waitDays = currentStep?.executedAt
          ? Math.floor((Date.now() - new Date(currentStep.executedAt).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return `**${seq.contact.name}** at **${seq.contact.company.name}** (waiting **${waitDays} day${waitDays !== 1 ? "s" : ""}**)`;
      });
      const seqLine = `You have **${activeSequences.length}** active follow-up${activeSequences.length !== 1 ? "s" : ""}: ${seqSummaries.join(", ")}.`;
      briefingResult.narrative = briefingResult.narrative + "\n\n" + seqLine;
    }

    const todayMeetings = allUpcomingMeetings
      .filter((m) => {
        const d = new Date(m.startTime);
        return d.toDateString() === now.toDateString();
      })
      .slice(0, 3)
      .map((m) => ({
        title: m.title,
        startTime: format(new Date(m.startTime), "h:mm a"),
        attendeeCount: m.attendees.length,
        meetingId: m.id,
      }));

    // Generate mini-360 for top 3 action contacts
    let mini360Html = "";
    const top3Contacts = topNudges.slice(0, 3);
    if (top3Contacts.length > 0) {
      const snippets = await Promise.allSettled(
        top3Contacts.map(async (nudge) => {
          const contactId = nudge.contactId;
          if (!contactId) return "";
          const [interactions, contactSignals, webNews] = await Promise.allSettled([
            interactionRepo.findByContactId(contactId),
            signalRepo.findByContactId(contactId),
            searchWeb(`${nudge.contactName} ${nudge.company} news`, 3),
          ]);

          const ctx: Contact360Context = {
            contact: {
              name: nudge.contactName,
              title: "",
              email: "",
              importance: nudge.priority,
              notes: null,
            },
            company: { name: nudge.company, industry: "", employeeCount: 0, website: "" },
            interactions: (interactions.status === "fulfilled" ? interactions.value : [])
              .slice(0, 5)
              .map((i) => ({
                type: i.type,
                date: formatDateForLLM(new Date(i.date)),
                summary: i.summary ?? "",
                sentiment: i.sentiment ?? "NEUTRAL",
              })),
            signals: (contactSignals.status === "fulfilled" ? contactSignals.value : [])
              .slice(0, 3)
              .map((s) => ({
                type: s.type,
                date: formatDateForLLM(new Date(s.date)),
                content: s.content,
                url: s.url ?? null,
              })),
            meetings: [],
            nudges: [
              {
                ruleType: nudge.ruleType ?? "UNKNOWN",
                reason: nudge.reason,
                priority: nudge.priority,
              },
            ],
            sequences: [],
            firmRelationships: [],
            webBackground: [],
            webNews: (webNews.status === "fulfilled" ? webNews.value : [])
              .filter((d) => d.type !== "Web Summary")
              .map((d) => ({ title: d.type, content: d.content, url: d.url ?? "" })),
            engagements: [],
          };

          const result = await generateMini360(ctx);
          const contactUrl = `${appUrl}/contacts/${contactId}`;
          return buildMini360Html(result.sections, nudge.contactName, contactUrl);
        })
      );

      const successfulSnippets = snippets
        .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
        .map((r) => r.value);

      if (successfulSnippets.length > 0) {
        mini360Html = successfulSnippets.join("");
      }
    }

    const unsubscribeToken = generateUnsubscribeToken(partnerId);
    const unsubscribeUrl = `${appUrl}/api/briefing/unsubscribe?token=${unsubscribeToken}`;

    const html = buildBriefingHtml(
      {
        partnerName: partner.name,
        narrative: briefingResult.narrative,
        topActions: briefingResult.topActions,
        todayMeetings: todayMeetings.length > 0 ? todayMeetings : undefined,
        unsubscribeUrl,
        mini360Html: mini360Html || undefined,
      },
      appUrl
    );

    const firstName = partner.name.split(" ")[0];
    const subject = topNudges.length > 0
      ? `${firstName}, your top move today — Activate`
      : `Your morning briefing — Activate`;

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipient,
      subject,
      html,
    });

    if (error) {
      console.error("[briefing-service] Resend error:", error);
      return { sent: false, error: error.message };
    }

    console.log(`[briefing-service] Morning briefing sent to ${recipient} for ${partner.name}`);
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[briefing-service] Failed for ${partner.name}:`, msg);
    return { sent: false, error: msg };
  }
}

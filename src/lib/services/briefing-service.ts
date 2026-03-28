import { Resend } from "resend";
import { partnerRepo, nudgeRepo, meetingRepo, signalRepo, sequenceRepo } from "@/lib/repositories";
import { refreshNudgesForPartner } from "@/lib/services/nudge-engine";
import { ingestNewsForPartner } from "@/lib/services/news-ingestion-service";
import {
  generateNarrativeBriefing,
  type NarrativeBriefingContext,
} from "@/lib/services/llm-service";
import { buildBriefingHtml } from "@/lib/services/email-service";
import { addDays, isBefore, format, differenceInDays } from "date-fns";
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

export async function sendMorningBriefing(partnerId: string): Promise<{
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
    const newsCount = await ingestNewsForPartner(partnerId);
    console.log(`[briefing-service] Ingested ${newsCount} news signals for ${partner.name}`);

    const nudgeCount = await refreshNudgesForPartner(partnerId);
    console.log(`[briefing-service] Refreshed ${nudgeCount} nudges for ${partner.name}`);

    const now = new Date();
    const twoDaysFromNow = addDays(now, 2);

    const [openNudges, allUpcomingMeetings, clientNews, activeSequences] = await Promise.all([
      nudgeRepo.findByPartnerId(partnerId, { status: "OPEN" }),
      meetingRepo.findUpcomingByPartnerId(partnerId),
      signalRepo.findRecentByPartnerId(partnerId, 10),
      sequenceRepo.findByPartnerId(partnerId, { status: "ACTIVE" }),
    ]);

    const topNudges = openNudges.slice(0, 5).map((n) => {
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

    const unsubscribeToken = generateUnsubscribeToken(partnerId);
    const unsubscribeUrl = `${appUrl}/api/briefing/unsubscribe?token=${unsubscribeToken}`;

    const html = buildBriefingHtml(
      {
        partnerName: partner.name,
        narrative: briefingResult.narrative,
        topActions: briefingResult.topActions,
        todayMeetings: todayMeetings.length > 0 ? todayMeetings : undefined,
        unsubscribeUrl,
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

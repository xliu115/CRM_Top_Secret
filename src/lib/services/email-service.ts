import { Resend } from "resend";
import type { NudgeWithRelations } from "@/lib/repositories";
import {
  buildSummaryFragments,
  type InsightData,
} from "@/lib/utils/nudge-summary";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const NUDGE_RECIPIENT = process.env.NUDGE_EMAIL_TO || "";
const FROM_ADDRESS = process.env.RESEND_FROM || "ClientIQ <onboarding@resend.dev>";

const MAX_NUDGES_PER_EMAIL = 5;

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MDS = {
  deepBlue: "#051C2C",
  blue: "#0070AD",
  electricBlue: "#2251FF",
  text: "#2D2D2D",
  textLight: "#64748b",
  bgLight: "#F5F5F5",
  white: "#FFFFFF",
  border: "#E0E0E0",
  urgent: "#dc2626",
  high: "#d97706",
} as const;

function priorityStyle(priority: string): { color: string; bg: string; label: string } {
  switch (priority) {
    case "URGENT": return { color: MDS.urgent, bg: "#fef2f2", label: "Urgent" };
    case "HIGH": return { color: MDS.high, bg: "#fffbeb", label: "High" };
    default: return { color: MDS.textLight, bg: MDS.bgLight, label: priority.charAt(0) + priority.slice(1).toLowerCase() };
  }
}

function ruleTypeLabel(ruleType: string): string {
  const labels: Record<string, string> = {
    STALE_CONTACT: "Reconnect",
    JOB_CHANGE: "Executive Transition",
    COMPANY_NEWS: "Company News",
    UPCOMING_EVENT: "Upcoming Event",
    MEETING_PREP: "Meeting Prep",
    EVENT_ATTENDED: "Event Follow-Up",
    EVENT_REGISTERED: "Event Outreach",
    ARTICLE_READ: "Content Follow-Up",
    LINKEDIN_ACTIVITY: "LinkedIn Activity",
    ARTICLE_CAMPAIGN: "Article Campaign",
  };
  return labels[ruleType] ?? "Nudge";
}

function ruleTypeCta(ruleType: string): string {
  const ctas: Record<string, string> = {
    STALE_CONTACT: "Draft Check-in",
    JOB_CHANGE: "Draft Congratulations",
    COMPANY_NEWS: "Draft News Email",
    UPCOMING_EVENT: "Draft Pre-Event Email",
    MEETING_PREP: "Prepare Brief",
    EVENT_ATTENDED: "Draft Follow-Up",
    EVENT_REGISTERED: "Draft Outreach",
    ARTICLE_READ: "Draft Content Email",
    LINKEDIN_ACTIVITY: "Draft LinkedIn Email",
  };
  return ctas[ruleType] ?? "Take Action";
}

function parseInsights(nudge: NudgeWithRelations): InsightData[] {
  if (!nudge.metadata) return [];
  try {
    const parsed = JSON.parse(nudge.metadata);
    return Array.isArray(parsed?.insights) ? parsed.insights : [];
  } catch {
    return [];
  }
}

function buildSummaryHtml(nudge: NudgeWithRelations): string {
  try {
    const meta = JSON.parse(nudge.metadata ?? "{}");
    if (meta?.strategicInsight?.narrative) {
      return meta.strategicInsight.narrative
        .replace(/\*\*([^*]+)\*\*/g, `<strong style="color: ${MDS.deepBlue};">$1</strong>`)
        .replace(/\n/g, "<br/>");
    }
  } catch { /* fall through to original logic */ }

  const insights = parseInsights(nudge);
  const fragments = buildSummaryFragments(
    { ruleType: nudge.ruleType, reason: nudge.reason, contact: nudge.contact },
    insights
  );
  return fragments
    .map((f) =>
      f.lineBreak
        ? `<br/><br/>`
        : f.bold
          ? `<strong style="color: ${MDS.deepBlue};">${escHtml(f.text)}</strong>`
          : escHtml(f.text)
    )
    .join("");
}

function buildNudgeRow(nudge: NudgeWithRelations, appUrl: string, isLast: boolean): string {
  const ps = priorityStyle(nudge.priority);
  const typeLabel = ruleTypeLabel(nudge.ruleType);
  let ctaLabel = ruleTypeCta(nudge.ruleType);
  const borderBottom = isLast ? "" : `border-bottom: 1px solid ${MDS.border};`;
  const summaryText = buildSummaryHtml(nudge);

  let ctaHref = `${appUrl}/nudges`;
  try {
    const meta = JSON.parse(nudge.metadata ?? "{}");
    if (meta?.strategicInsight?.suggestedAction?.label) {
      ctaLabel = meta.strategicInsight.suggestedAction.label;
    }
    if (nudge.ruleType === "CAMPAIGN_APPROVAL") {
      if (meta.campaignId) ctaHref = `${appUrl}/campaigns/${meta.campaignId}`;
      else ctaHref = `${appUrl}/campaigns`;
    } else if (nudge.ruleType === "ARTICLE_CAMPAIGN") {
      ctaHref = meta.contentItemId
        ? `${appUrl}/campaigns/draft?contentItemId=${meta.contentItemId}`
        : `${appUrl}/campaigns`;
    } else if (nudge.ruleType !== "MEETING_PREP") {
      const sp = new URLSearchParams({
        q: ctaLabel,
        nudgeId: nudge.id,
        contactId: nudge.contactId,
      });
      ctaHref = `${appUrl}/chat?${sp.toString()}`;
    }
  } catch { /* ignore */ }

  return `
    <tr>
      <td style="padding: 20px 28px; ${borderBottom}">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="vertical-align: top;">
              <div style="margin-bottom: 6px;">
                <span style="font-weight: 600; font-size: 15px; color: ${MDS.deepBlue};">${escHtml(nudge.contact.name)}</span>
                <span style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; color: ${ps.color}; background: ${ps.bg}; margin-left: 8px; vertical-align: middle; text-transform: uppercase; letter-spacing: 0.3px;">${escHtml(ps.label)}</span>
              </div>
              <div style="font-size: 12px; color: ${MDS.textLight}; margin-bottom: 8px;">
                ${escHtml(nudge.contact.title)} at ${escHtml(nudge.contact.company.name)} &middot; ${escHtml(typeLabel)}
              </div>
              <div style="background: ${MDS.bgLight}; border-radius: 4px; padding: 12px 14px; margin-bottom: 12px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${MDS.electricBlue}; margin-bottom: 6px;">&#10024; AI Summary</div>
                <div style="font-size: 13px; color: ${MDS.text}; line-height: 1.55;">${summaryText}</div>
              </div>
              <a href="${ctaHref}" style="display: inline-block; padding: 7px 20px; background: ${MDS.electricBlue}; color: ${MDS.white}; font-size: 12px; font-weight: 600; text-decoration: none; border-radius: 3px; letter-spacing: 0.2px;">${escHtml(ctaLabel)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildDigestHtml(
  partnerName: string,
  nudges: NudgeWithRelations[],
  appUrl: string
): string {
  const sorted = [...nudges].sort((a, b) => {
    const order: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });

  const displayed = sorted.slice(0, MAX_NUDGES_PER_EMAIL);
  const remaining = nudges.length - displayed.length;

  const urgentCount = nudges.filter((n) => n.priority === "URGENT").length;
  const highCount = nudges.filter((n) => n.priority === "HIGH").length;

  const nudgeRows = displayed
    .map((n, i) => buildNudgeRow(n, appUrl, i === displayed.length - 1))
    .join("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const firstName = partnerName.split(" ")[0];

  const summaryParts: string[] = [];
  if (urgentCount > 0) summaryParts.push(`<strong style="color: ${MDS.urgent};">${urgentCount} urgent</strong>`);
  if (highCount > 0) summaryParts.push(`<strong style="color: ${MDS.high};">${highCount} high-priority</strong>`);
  const summaryText = summaryParts.length > 0
    ? `, including ${summaryParts.join(" and ")}`
    : "";

  const overflowRow = remaining > 0
    ? `<tr>
        <td style="padding: 20px 28px; text-align: center;">
          <a href="${appUrl}/nudges" style="font-size: 14px; color: ${MDS.electricBlue}; text-decoration: none; font-weight: 600;">
            View ${remaining} more nudge${remaining !== 1 ? "s" : ""} &rarr;
          </a>
        </td>
      </tr>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ClientIQ — Nudge Digest</title>
</head>
<body style="margin: 0; padding: 0; background: ${MDS.bgLight}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: ${MDS.bgLight};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: ${MDS.deepBlue}; padding: 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <div style="font-size: 14px; font-weight: 600; color: ${MDS.electricBlue}; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">ClientIQ</div>
                    <div style="font-size: 22px; font-weight: 700; color: ${MDS.white}; letter-spacing: -0.3px; font-family: Georgia, 'Times New Roman', serif;">
                      Your Daily Nudge Digest
                    </div>
                    <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">${today}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="background: ${MDS.white}; padding: 24px 28px; border-bottom: 1px solid ${MDS.border};">
              <div style="font-size: 15px; color: ${MDS.text}; line-height: 1.6;">
                Hi ${firstName}, you have <strong style="color: ${MDS.deepBlue};">${nudges.length} action item${nudges.length !== 1 ? "s" : ""}</strong> today${summaryText}.
              </div>
            </td>
          </tr>

          <!-- Nudge List -->
          <tr>
            <td style="background: ${MDS.white};">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${nudgeRows}
                ${overflowRow}
              </table>
            </td>
          </tr>

          <!-- Footer CTA -->
          <tr>
            <td style="background: ${MDS.white}; padding: 24px 28px; text-align: center; border-top: 1px solid ${MDS.border};">
              <a href="${appUrl}/nudges" style="display: inline-block; padding: 12px 32px; background: ${MDS.deepBlue}; color: ${MDS.white}; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 3px; letter-spacing: -0.1px;">
                Open ClientIQ
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                Automated digest from ClientIQ &middot;
                <a href="${appUrl}/nudges/settings" style="color: ${MDS.blue}; text-decoration: none;">Manage preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Narrative Morning Briefing Email ─────────────────────────────────

export interface BriefingEmailData {
  partnerName: string;
  narrative: string;
  topActions: {
    contactName: string;
    company: string;
    actionLabel: string;
    detail: string;
    deeplink: string;
  }[];
  todayMeetings?: { title: string; startTime: string; attendeeCount: number; meetingId?: string }[];
  unsubscribeUrl: string;
  mini360Html?: string;
}

export function buildBriefingHtml(data: BriefingEmailData, appUrl: string): string {
  const firstName = data.partnerName.split(" ")[0];
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const narrativeParagraphs = narrativeToEmailHtml(data.narrative);

  const actionRows = data.topActions
    .map((a, i) => {
      const url = `${appUrl}${a.deeplink}`;
      return `
      <tr>
        <td style="padding: ${i === 0 ? "0" : "16px"} 0 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="vertical-align: top; width: 28px; padding-top: 2px;">
                <div style="width: 24px; height: 24px; border-radius: 50%; background: ${MDS.electricBlue}; color: ${MDS.white}; font-size: 12px; font-weight: 700; line-height: 24px; text-align: center;">${i + 1}</div>
              </td>
              <td style="vertical-align: top; padding-left: 12px;">
                <div style="font-weight: 600; font-size: 14px; color: ${MDS.deepBlue};">${a.contactName}${a.company ? ` · ${a.company}` : ""}</div>
                <div style="font-size: 12px; color: ${MDS.textLight}; margin-top: 2px;">${a.detail}</div>
                <a href="${url}" style="display: inline-block; margin-top: 8px; padding: 6px 16px; background: ${MDS.electricBlue}; color: ${MDS.white}; font-size: 12px; font-weight: 600; text-decoration: none; border-radius: 3px;">${a.actionLabel} &rarr;</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");

  const meetingSection = data.todayMeetings?.length
    ? `<tr>
        <td style="background: ${MDS.white}; padding: 20px 28px; border-top: 1px solid ${MDS.border};">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${MDS.textLight}; margin-bottom: 12px;">Today's Meetings</div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${data.todayMeetings.map((m) => {
              const mUrl = m.meetingId ? `${appUrl}/meetings/${m.meetingId}` : `${appUrl}/meetings`;
              return `<tr>
                <td style="padding: 6px 0;">
                  <a href="${mUrl}" style="font-size: 13px; font-weight: 600; color: ${MDS.deepBlue}; text-decoration: none;">${m.title}</a>
                  <span style="font-size: 12px; color: ${MDS.textLight};"> · ${m.startTime} · ${m.attendeeCount} attendee${m.attendeeCount !== 1 ? "s" : ""}</span>
                </td>
              </tr>`;
            }).join("")}
          </table>
        </td>
      </tr>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ClientIQ — Morning Briefing</title>
</head>
<body style="margin: 0; padding: 0; background: ${MDS.bgLight}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: ${MDS.bgLight};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: ${MDS.deepBlue}; padding: 32px 28px;">
              <div style="font-size: 14px; font-weight: 600; color: ${MDS.electricBlue}; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">ClientIQ</div>
              <div style="font-size: 24px; font-weight: 700; color: ${MDS.white}; letter-spacing: -0.3px; font-family: Georgia, 'Times New Roman', serif;">
                ${greeting}, ${firstName}
              </div>
              <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">${today}</div>
            </td>
          </tr>

          <!-- Narrative -->
          <tr>
            <td style="background: ${MDS.white}; padding: 28px 28px 12px 28px;">
              ${narrativeParagraphs}
            </td>
          </tr>

          <!-- Top Actions -->
          <tr>
            <td style="background: ${MDS.white}; padding: 8px 28px 24px 28px; border-top: 1px solid ${MDS.border};">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${MDS.textLight}; margin-bottom: 16px; padding-top: 16px;">Your Top Actions</div>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${actionRows}
              </table>
            </td>
          </tr>

          ${meetingSection}

          ${data.mini360Html ? `
          <!-- Mini-360 Intel Snippets -->
          <tr>
            <td style="background: ${MDS.white}; padding: 20px 28px; border-top: 1px solid ${MDS.border};">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${MDS.textLight}; margin-bottom: 12px;">Contact Intelligence</div>
              ${data.mini360Html}
            </td>
          </tr>` : ""}

          <!-- Footer CTA -->
          <tr>
            <td style="background: ${MDS.white}; padding: 24px 28px; text-align: center; border-top: 1px solid ${MDS.border};">
              <a href="${appUrl}/dashboard" style="display: inline-block; padding: 12px 32px; background: ${MDS.deepBlue}; color: ${MDS.white}; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 3px;">
                Open ClientIQ
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                You're receiving this because briefings are enabled. &middot;
                <a href="${data.unsubscribeUrl}" style="color: ${MDS.blue}; text-decoration: none;">Unsubscribe</a> &middot;
                <a href="${appUrl}/nudges/settings" style="color: ${MDS.blue}; text-decoration: none;">Manage preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendNudgeDigest(
  partnerName: string,
  partnerEmail: string,
  nudges: NudgeWithRelations[]
): Promise<{ sent: boolean; error?: string }> {
  if (!resend) {
    console.log("[email-service] RESEND_API_KEY not set — skipping nudge digest email");
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  const recipient = NUDGE_RECIPIENT || partnerEmail;
  if (!recipient) {
    return { sent: false, error: "No recipient email configured" };
  }

  if (nudges.length === 0) {
    return { sent: false, error: "No nudges to send" };
  }

  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const html = buildDigestHtml(partnerName, nudges, appUrl);

  const urgentCount = nudges.filter((n) => n.priority === "URGENT").length;
  const subject =
    urgentCount > 0
      ? `${urgentCount} urgent + ${nudges.length - urgentCount} more — ClientIQ`
      : `${nudges.length} nudge${nudges.length !== 1 ? "s" : ""} to review — ClientIQ`;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipient,
      subject,
      html,
    });

    if (error) {
      console.error("[email-service] Resend error:", error);
      return { sent: false, error: error.message };
    }

    console.log(`[email-service] Nudge digest sent to ${recipient}`);
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[email-service] Failed to send:", msg);
    return { sent: false, error: msg };
  }
}

/**
 * Send an outreach email to a contact as part of a cadence sequence.
 * Returns success status and the Resend message ID if available.
 */
export async function sendOutreachEmail(params: {
  fromName: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
}): Promise<{ sent: boolean; error?: string; messageId?: string }> {
  if (!resend) {
    console.warn("[email-service] Resend not configured, skipping outreach send");
    return { sent: false, error: "Resend not configured" };
  }

  const htmlBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: ${MDS.text};">
  <div style="white-space: pre-line; font-size: 14px; line-height: 1.7;">
${escHtml(params.body)}
  </div>
</div>`;

  try {
    const { data, error } = await resend.emails.send({
      from: `${escHtml(params.fromName)} <${FROM_ADDRESS.replace(/.*<|>.*/g, "")}>`,
      to: params.toEmail,
      subject: params.subject,
      html: htmlBody,
    });

    if (error) {
      console.error("[email-service] Outreach send error:", error);
      return { sent: false, error: error.message };
    }

    console.log(`[email-service] Outreach sent to ${params.toEmail}`);
    return { sent: true, messageId: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[email-service] Outreach send failed:", msg);
    return { sent: false, error: msg };
  }
}

// ── Contact 360 Email HTML ──────────────────────────────────────────

interface Contact360Section {
  id: string;
  title: string;
  content: string;
}

interface Contact360ResultForEmail {
  summary: string;
  sections: Contact360Section[];
  talkingPoints?: string[];
}

/**
 * Converts a markdown narrative (headline + bold section labels + bullet points)
 * into email-safe HTML with inline styles.
 */
function narrativeToEmailHtml(narrative: string): string {
  const rawLines = narrative.split("\n");
  const html: string[] = [];
  let bulletBuffer: string[] = [];

  function flushBullets() {
    if (bulletBuffer.length === 0) return;
    const items = bulletBuffer
      .map((b) => `<li style="margin: 0 0 6px 0; font-size: 14px; color: ${MDS.text}; line-height: 1.6;">${markdownBoldToHtml(b)}</li>`)
      .join("");
    html.push(`<ul style="margin: 0 0 16px 0; padding-left: 20px; list-style-type: disc;">${items}</ul>`);
    bulletBuffer = [];
  }

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;

    const bulletMatch = line.match(/^[-*]\s+(.*)/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1]);
      continue;
    }

    flushBullets();

    const isSectionLabel = /^\*\*[^*]+\*\*$/.test(line);
    if (isSectionLabel) {
      const label = line.replace(/\*\*/g, "");
      html.push(
        `<p style="margin: 16px 0 6px 0; font-size: 13px; font-weight: 700; color: ${MDS.deepBlue}; text-transform: uppercase; letter-spacing: 0.3px;">${escHtml(label)}</p>`
      );
    } else {
      html.push(
        `<p style="margin: 0 0 16px 0; font-size: 15px; color: ${MDS.text}; line-height: 1.7;">${markdownBoldToHtml(line)}</p>`
      );
    }
  }

  flushBullets();
  return html.join("");
}

function markdownBoldToHtml(text: string): string {
  return escHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function buildContact360EmailHtml(
  result: Contact360ResultForEmail,
  contactName: string,
  companyName: string,
  senderName?: string
): string {
  const sectionRows = result.sections
    .map(
      (s) => `
      <tr>
        <td style="padding: 0 0 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: ${MDS.white}; border: 1px solid ${MDS.border}; border-radius: 8px;">
            <tr>
              <td style="padding: 16px 20px 8px 20px;">
                <p style="margin: 0; font-family: Georgia, serif; font-size: 14px; font-weight: 600; color: ${MDS.deepBlue}; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${escHtml(s.title)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 20px 16px 20px;">
                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; color: ${MDS.text};">
                  ${markdownBoldToHtml(s.content)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("\n");

  const sharedBy = senderName
    ? `<p style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: ${MDS.textLight};">Shared by ${escHtml(senderName)} via ClientIQ</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: ${MDS.bgLight}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: ${MDS.bgLight};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="padding: 24px 32px; background: ${MDS.deepBlue}; border-radius: 12px 12px 0 0;">
              <p style="margin: 0; font-family: Georgia, serif; font-size: 22px; font-weight: 700; color: ${MDS.white};">
                Contact 360: ${escHtml(contactName)}
              </p>
              <p style="margin: 4px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: rgba(255,255,255,0.7);">
                ${escHtml(companyName)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background: ${MDS.white}; border-radius: 0 0 12px 12px; border: 1px solid ${MDS.border}; border-top: none;">
              ${sharedBy}
              <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.5; color: ${MDS.text}; font-style: italic;">
                ${markdownBoldToHtml(result.summary)}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${sectionRows}
              </table>
              <p style="margin: 24px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: ${MDS.textLight}; text-align: center;">
                Generated by ClientIQ — Concierge Intelligence Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildMini360Html(
  sections: Contact360Section[],
  contactName: string,
  contactUrl: string
): string {
  const sectionHtml = sections
    .map(
      (s) => `
        <div style="margin-bottom: 8px;">
          <span style="font-family: Georgia, serif; font-size: 11px; font-weight: 600; color: ${MDS.deepBlue}; text-transform: uppercase; letter-spacing: 0.3px;">${escHtml(s.title)}</span>
          <p style="margin: 2px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.5; color: ${MDS.text};">
            ${markdownBoldToHtml(s.content)}
          </p>
        </div>`
    )
    .join("\n");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0; background: ${MDS.bgLight}; border: 1px solid ${MDS.border}; border-radius: 8px;">
      <tr>
        <td style="padding: 12px 16px;">
          <p style="margin: 0 0 8px 0; font-family: Georgia, serif; font-size: 13px; font-weight: 600; color: ${MDS.electricBlue};">
            <a href="${escHtml(contactUrl)}" style="color: ${MDS.electricBlue}; text-decoration: none;">360 Intel: ${escHtml(contactName)}</a>
          </p>
          ${sectionHtml}
        </td>
      </tr>
    </table>`;
}

export function buildCampaignEmailHtml(params: {
  personalizedOpening: string;
  bodyTemplate: string;
  signatureBlock?: string;
  contentItems: {
    contentItemId: string;
    title: string;
    description?: string;
    url?: string;
    type: string;
    eventDate?: Date;
    eventLocation?: string;
  }[];
  recipientId: string;
  rsvpToken?: string;
  appUrl: string;
}): string {
  const base = params.appUrl.replace(/\/+$/, "");
  const openPixel = `${base}/api/track/open/${encodeURIComponent(params.recipientId)}`;

  const cardRows = params.contentItems
    .map((item, i) => {
      const isEvent = item.type.toUpperCase() === "EVENT";
      const borderBottom =
        i < params.contentItems.length - 1
          ? `border-bottom: 1px solid ${MDS.border};`
          : "";
      const clickUrl = `${base}/api/track/click/${encodeURIComponent(params.recipientId)}/${encodeURIComponent(item.contentItemId)}`;
      const rsvpUrl = params.rsvpToken
        ? `${base}/api/track/rsvp/${encodeURIComponent(params.rsvpToken)}`
        : clickUrl;

      const dateStr =
        item.eventDate instanceof Date && !Number.isNaN(item.eventDate.getTime())
          ? item.eventDate.toLocaleDateString("en-US", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : null;

      const metaLines: string[] = [];
      if (isEvent && dateStr) {
        metaLines.push(
          `<div style="font-size: 12px; color: ${MDS.textLight}; margin-top: 4px;">${escHtml(dateStr)}</div>`
        );
      }
      if (isEvent && item.eventLocation) {
        metaLines.push(
          `<div style="font-size: 12px; color: ${MDS.textLight}; margin-top: 2px;">${escHtml(item.eventLocation)}</div>`
        );
      }
      if (!isEvent && item.description) {
        metaLines.push(
          `<div style="font-size: 13px; color: ${MDS.text}; line-height: 1.55; margin-top: 8px;">${escHtml(item.description)}</div>`
        );
      }

      const ctaHref = isEvent ? rsvpUrl : clickUrl;
      const ctaLabel = isEvent ? "RSVP &rarr;" : "Read Article &rarr;";

      return `
    <tr>
      <td style="padding: 20px 28px; ${borderBottom}">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: ${MDS.bgLight}; border-radius: 4px; border: 1px solid ${MDS.border};">
          <tr>
            <td style="padding: 14px 16px;">
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${MDS.electricBlue}; margin-bottom: 6px;">${escHtml(item.type)}</div>
              <div style="font-weight: 600; font-size: 15px; color: ${MDS.deepBlue}; line-height: 1.35;">${escHtml(item.title)}</div>
              ${metaLines.join("")}
              <a href="${ctaHref}" style="display: inline-block; margin-top: 12px; padding: 7px 18px; background: ${MDS.electricBlue}; color: ${MDS.white}; font-size: 12px; font-weight: 600; text-decoration: none; border-radius: 3px;">${ctaLabel}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Campaign</title>
</head>
<body style="margin: 0; padding: 0; background: ${MDS.bgLight}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: ${MDS.bgLight};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; width: 100%; background: ${MDS.white}; border: 1px solid ${MDS.border}; border-radius: 4px;">
          <tr>
            <td style="padding: 28px 28px 16px 28px;">
              <p style="margin: 0; font-size: 15px; color: ${MDS.text}; line-height: 1.65;">${escHtml(params.personalizedOpening).replace(/\n/g, "<br />")}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <div style="white-space: pre-line; font-size: 14px; color: ${MDS.text}; line-height: 1.7;">${escHtml(params.bodyTemplate)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${cardRows}
              </table>
            </td>
          </tr>
          ${params.signatureBlock ? `<tr>
            <td style="padding: 16px 28px 0 28px; border-top: 1px solid ${MDS.border};">
              <div style="white-space: pre-line; font-size: 13px; color: ${MDS.textLight}; line-height: 1.6;">${escHtml(params.signatureBlock).replace(/\n/g, "<br />")}</div>
            </td>
          </tr>` : ""}
          <tr>
            <td style="padding: 16px 28px 32px 28px;">
              <img src="${openPixel}" width="1" height="1" alt="" style="display: block; border: 0; outline: none;" />
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendCampaignEmail(params: {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  toName: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string; messageId?: string }> {
  if (!resend) {
    console.warn("[email-service] Resend not configured, skipping campaign send");
    return { sent: false, error: "Resend not configured" };
  }

  const sender = FROM_ADDRESS.replace(/.*<|>.*/g, "").trim();

  try {
    const { data, error } = await resend.emails.send({
      from: `${escHtml(params.fromName)} <${sender}>`,
      replyTo: params.fromEmail,
      to: params.toEmail,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error("[email-service] Campaign send error:", error);
      return { sent: false, error: error.message };
    }

    console.log(`[email-service] Campaign email sent to ${params.toEmail}`);
    return { sent: true, messageId: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[email-service] Campaign send failed:", msg);
    return { sent: false, error: msg };
  }
}

import { Resend } from "resend";
import type { NudgeWithRelations } from "@/lib/repositories";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const NUDGE_RECIPIENT = process.env.NUDGE_EMAIL_TO || "";
const FROM_ADDRESS = process.env.RESEND_FROM || "Activate <onboarding@resend.dev>";

const MAX_NUDGES_PER_EMAIL = 5;

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

function buildNudgeRow(nudge: NudgeWithRelations, appUrl: string, isLast: boolean): string {
  const ps = priorityStyle(nudge.priority);
  const typeLabel = ruleTypeLabel(nudge.ruleType);
  const ctaLabel = ruleTypeCta(nudge.ruleType);
  const nudgesUrl = `${appUrl}/nudges`;
  const borderBottom = isLast ? "" : `border-bottom: 1px solid ${MDS.border};`;

  const reasonText = nudge.reason.length > 160
    ? nudge.reason.slice(0, 157) + "..."
    : nudge.reason;

  return `
    <tr>
      <td style="padding: 20px 28px; ${borderBottom}">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="vertical-align: top;">
              <div style="margin-bottom: 6px;">
                <span style="font-weight: 600; font-size: 15px; color: ${MDS.deepBlue};">${nudge.contact.name}</span>
                <span style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; color: ${ps.color}; background: ${ps.bg}; margin-left: 8px; vertical-align: middle; text-transform: uppercase; letter-spacing: 0.3px;">${ps.label}</span>
              </div>
              <div style="font-size: 12px; color: ${MDS.textLight}; margin-bottom: 8px;">
                ${nudge.contact.title} at ${nudge.contact.company.name} &middot; ${typeLabel}
              </div>
              <div style="font-size: 14px; color: ${MDS.text}; line-height: 1.5; margin-bottom: 12px;">
                ${reasonText}
              </div>
              <a href="${nudgesUrl}" style="display: inline-block; padding: 7px 20px; background: ${MDS.electricBlue}; color: ${MDS.white}; font-size: 12px; font-weight: 600; text-decoration: none; border-radius: 3px; letter-spacing: 0.2px;">${ctaLabel}</a>
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
  <title>Activate — Nudge Digest</title>
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
                    <div style="font-size: 14px; font-weight: 600; color: ${MDS.electricBlue}; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;">Activate</div>
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
                Open Activate
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                Automated digest from Activate &middot;
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
      ? `${urgentCount} urgent + ${nudges.length - urgentCount} more — Activate`
      : `${nudges.length} nudge${nudges.length !== 1 ? "s" : ""} to review — Activate`;

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

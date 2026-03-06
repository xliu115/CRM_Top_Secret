import { Resend } from "resend";
import type { NudgeWithRelations } from "@/lib/repositories";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const NUDGE_RECIPIENT = process.env.NUDGE_EMAIL_TO || "";
const FROM_ADDRESS = process.env.RESEND_FROM || "Chirp <onboarding@resend.dev>";

function priorityColor(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "#ef4444";
    case "HIGH":
      return "#f59e0b";
    case "MEDIUM":
      return "#64748b";
    default:
      return "#94a3b8";
  }
}

function priorityLabel(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "URGENT";
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
      return "MEDIUM";
    default:
      return "LOW";
  }
}

function ruleTypeIcon(ruleType: string): string {
  switch (ruleType) {
    case "STALE_CONTACT":
      return "⏰";
    case "JOB_CHANGE":
      return "🎉";
    case "COMPANY_NEWS":
      return "📰";
    case "UPCOMING_EVENT":
      return "📅";
    case "MEETING_PREP":
      return "📋";
    case "EVENT_ATTENDED":
      return "🎫";
    case "EVENT_REGISTERED":
      return "📆";
    case "ARTICLE_READ":
      return "📖";
    default:
      return "💡";
  }
}

function buildNudgeRow(nudge: NudgeWithRelations, appUrl: string): string {
  const pColor = priorityColor(nudge.priority);
  const pLabel = priorityLabel(nudge.priority);
  const icon = ruleTypeIcon(nudge.ruleType);
  const contactUrl = `${appUrl}/contacts/${nudge.contact.id}`;

  return `
    <tr>
      <td style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="vertical-align: top; width: 44px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: #eff6ff; color: #2563eb; font-size: 18px; line-height: 40px; text-align: center;">
                ${icon}
              </div>
            </td>
            <td style="vertical-align: top; padding-left: 14px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <a href="${contactUrl}" style="font-weight: 600; font-size: 15px; color: #0f172a; text-decoration: none;">
                  ${nudge.contact.name}
                </a>
                <span style="display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; color: white; background: ${pColor}; margin-left: 8px;">
                  ${pLabel}
                </span>
              </div>
              <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
                ${nudge.contact.title} at ${nudge.contact.company.name}
              </div>
              <div style="font-size: 14px; color: #334155; line-height: 1.5;">
                ${nudge.reason}
              </div>
              ${nudge.signal ? `<div style="margin-top: 6px; font-size: 12px; color: #94a3b8;">Signal: ${nudge.signal.type} — ${nudge.signal.content.slice(0, 120)}${nudge.signal.content.length > 120 ? "…" : ""}</div>` : ""}
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
  const urgentCount = nudges.filter((n) => n.priority === "URGENT").length;
  const highCount = nudges.filter((n) => n.priority === "HIGH").length;
  const mediumCount = nudges.filter(
    (n) => n.priority === "MEDIUM" || n.priority === "LOW"
  ).length;

  const sorted = [...nudges].sort((a, b) => {
    const order: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });

  const nudgeRows = sorted.map((n) => buildNudgeRow(n, appUrl)).join("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chirp — Nudge Digest</title>
</head>
<body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: #0f172a; border-radius: 12px 12px 0 0; padding: 32px 24px; text-align: center;">
              <div style="display: inline-block; width: 44px; height: 44px; border-radius: 10px; background: #2563eb; color: white; font-weight: 700; font-size: 22px; line-height: 44px; text-align: center; margin-bottom: 12px;">
                🐦
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                Your Nudge Digest
              </h1>
              <p style="margin: 6px 0 0; color: #94a3b8; font-size: 14px;">
                ${today}
              </p>
            </td>
          </tr>

          <!-- Greeting + Stats -->
          <tr>
            <td style="background: #ffffff; padding: 24px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">
                Hi ${partnerName.split(" ")[0]}, you have <strong>${nudges.length} open nudge${nudges.length !== 1 ? "s" : ""}</strong> to review today.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  ${urgentCount > 0 ? `<td style="text-align: center; padding: 12px 8px; background: #fef2f2; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${urgentCount}</div>
                    <div style="font-size: 11px; color: #ef4444; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Urgent</div>
                  </td>` : ""}
                  <td style="text-align: center; padding: 12px 8px; background: #fffbeb; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${highCount}</div>
                    <div style="font-size: 11px; color: #f59e0b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">High</div>
                  </td>
                  <td style="text-align: center; padding: 12px 8px; background: #f1f5f9; border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #64748b;">${mediumCount}</div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Medium / Low</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Nudge List -->
          <tr>
            <td style="background: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${nudgeRows}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background: #ffffff; padding: 24px; text-align: center; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <a href="${appUrl}/nudges" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                View All Nudges in Chirp
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; border-radius: 0 0 12px 12px; padding: 20px 24px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                This is an automated digest from Chirp.<br />
                All company names, contacts, and data shown are entirely fictional and for demonstration purposes only.
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
    console.log(
      "[email-service] RESEND_API_KEY not set — skipping nudge digest email"
    );
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
      ? `🔴 ${urgentCount} urgent + ${nudges.length - urgentCount} more nudges — Chirp`
      : `${nudges.length} nudge${nudges.length !== 1 ? "s" : ""} to review — Chirp`;

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

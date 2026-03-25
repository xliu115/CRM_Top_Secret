import twilio from "twilio";
import type { NudgeWithRelations } from "@/lib/repositories";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const overrideRecipient = process.env.NUDGE_SMS_TO || "";

const client =
  accountSid && authToken ? twilio(accountSid, authToken) : null;

const MAX_NUDGES_PER_SMS = 5;

const PRIORITY_LABEL: Record<string, string> = {
  URGENT: "🔴",
  HIGH: "🟠",
  MEDIUM: "🔵",
  LOW: "⚪",
};

const RULE_TYPE_LABEL: Record<string, string> = {
  STALE_CONTACT: "Reconnect",
  JOB_CHANGE: "Role Change",
  COMPANY_NEWS: "Company News",
  UPCOMING_EVENT: "Event",
  MEETING_PREP: "Meeting Prep",
  EVENT_ATTENDED: "Event Follow-Up",
  EVENT_REGISTERED: "Event Outreach",
  ARTICLE_READ: "Content",
  LINKEDIN_ACTIVITY: "LinkedIn",
};

function buildDigestSms(
  partnerName: string,
  nudges: NudgeWithRelations[]
): string {
  const firstName = partnerName.split(" ")[0];
  const sorted = [...nudges].sort((a, b) => {
    const order: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });

  const displayed = sorted.slice(0, MAX_NUDGES_PER_SMS);
  const remaining = nudges.length - displayed.length;

  const lines: string[] = [
    `Hi ${firstName}, you have ${nudges.length} nudge${nudges.length !== 1 ? "s" : ""} today:`,
    "",
  ];

  for (const n of displayed) {
    const dot = PRIORITY_LABEL[n.priority] ?? "⚪";
    const tag = RULE_TYPE_LABEL[n.ruleType] ?? "Nudge";
    const reason =
      n.reason.length > 80 ? n.reason.slice(0, 77) + "..." : n.reason;
    lines.push(`${dot} ${n.contact.name} (${tag})`);
    lines.push(`   ${reason}`);
  }

  if (remaining > 0) {
    lines.push("");
    lines.push(`+ ${remaining} more`);
  }

  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  lines.push("");
  lines.push(`Open Activate: ${appUrl}/nudges`);

  return lines.join("\n");
}

export async function sendNudgeDigestSms(
  partnerName: string,
  partnerPhone: string,
  nudges: NudgeWithRelations[]
): Promise<{ sent: boolean; error?: string; sid?: string }> {
  if (!client || !fromNumber) {
    console.log("[sms-service] Twilio not configured — skipping SMS digest");
    return { sent: false, error: "Twilio not configured" };
  }

  const recipient = overrideRecipient || partnerPhone;
  if (!recipient) {
    return { sent: false, error: "No recipient phone number" };
  }

  if (nudges.length === 0) {
    return { sent: false, error: "No nudges to send" };
  }

  const body = buildDigestSms(partnerName, nudges);

  try {
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to: recipient,
    });
    console.log(`[sms-service] Nudge digest SMS sent to ${recipient}: ${message.sid}`);
    return { sent: true, sid: message.sid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[sms-service] Failed to send SMS digest:", msg);
    return { sent: false, error: msg };
  }
}

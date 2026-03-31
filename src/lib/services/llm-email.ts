import { callLLM } from "./llm-core";

// ── Email Drafting ──────────────────────────────────────────────────

export interface EmailContext {
  partnerName: string;
  contactName: string;
  contactTitle: string;
  companyName: string;
  nudgeReason: string;
  recentInteractions: string[];
  signals: string[];
}

export async function generateEmail(ctx: EmailContext): Promise<{
  subject: string;
  body: string;
}> {
  const interactionContext = ctx.recentInteractions.length
    ? `Recent interactions:\n${ctx.recentInteractions.map((i) => `- ${i}`).join("\n")}`
    : "No recent interactions.";

  const signalContext = ctx.signals.length
    ? `Relevant signals:\n${ctx.signals.map((s) => `- ${s}`).join("\n")}`
    : "";

  const result = await callLLM(
    `You are an expert relationship manager drafting outreach emails. Write professional, warm, concise emails. Return JSON with "subject" and "body" keys only.`,
    `Draft an outreach email from ${ctx.partnerName} to ${ctx.contactName} (${ctx.contactTitle} at ${ctx.companyName}).

Reason for outreach: ${ctx.nudgeReason}

${interactionContext}

${signalContext}

Write a personalized email that references the reason and past context naturally. Keep it under 200 words. Return valid JSON: {"subject": "...", "body": "..."}`
  );
  if (result) {
    try {
      const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return generateEmailTemplate(ctx);
    }
  }

  return generateEmailTemplate(ctx);
}

function generateEmailTemplate(ctx: EmailContext): {
  subject: string;
  body: string;
} {
  const firstName = ctx.contactName.split(" ")[0];
  const partnerFirst = ctx.partnerName.split(" ")[0];

  let subject = `Checking in – ${ctx.companyName}`;
  let opening = `I hope this message finds you well.`;

  if (ctx.nudgeReason.includes("role change") || ctx.nudgeReason.includes("promoted")) {
    subject = `Congratulations on the new role!`;
    opening = `I saw the news about your recent role change – congratulations! That's a well-deserved move.`;
  } else if (ctx.nudgeReason.includes("news") || ctx.nudgeReason.includes("in the news")) {
    subject = `Thoughts on ${ctx.companyName}'s recent announcement`;
    opening = `I noticed the recent news about ${ctx.companyName} and wanted to share some thoughts that might be relevant to your work.`;
  } else if (ctx.nudgeReason.includes("event") || ctx.nudgeReason.includes("conference")) {
    subject = `See you at the upcoming event?`;
    opening = `I saw you'll be at an upcoming event and wanted to reach out about connecting there.`;
  } else if (ctx.nudgeReason.includes("days since")) {
    subject = `Quick check-in – ${ctx.companyName}`;
    opening = `It's been a while since we last connected, and I wanted to check in on how things are going.`;
  }

  const lastInteraction = ctx.recentInteractions[0]
    ? `\n\nLast time we spoke, ${ctx.recentInteractions[0].toLowerCase()}`
    : "";

  const body = `Hi ${firstName},

${opening}${lastInteraction}

I'd love to find some time to catch up and hear about what's top of mind for you and the team at ${ctx.companyName}. Would you have 30 minutes in the next couple of weeks?

Looking forward to reconnecting.

Best regards,
${partnerFirst}`;

  return { subject, body };
}

// ── Note / Short Message Drafting ───────────────────────────────────

export interface NoteContext {
  partnerName: string;
  contactName: string;
  contactTitle: string;
  companyName: string;
  recentInteractions: string[];
  signals: string[];
}

export async function generateNote(ctx: NoteContext): Promise<{
  body: string;
}> {
  const interactionContext = ctx.recentInteractions.length
    ? `Recent interactions:\n${ctx.recentInteractions.map((i) => `- ${i}`).join("\n")}`
    : "No recent interactions.";

  const signalContext = ctx.signals.length
    ? `Relevant signals:\n${ctx.signals.map((s) => `- ${s}`).join("\n")}`
    : "";

  const result = await callLLM(
    `You are an expert relationship manager drafting short, informal notes. Write warm, conversational messages — not formal emails. Keep it under 80 words. Return JSON with a "body" key only.`,
    `Draft a quick note from ${ctx.partnerName} to ${ctx.contactName} (${ctx.contactTitle} at ${ctx.companyName}).

${interactionContext}

${signalContext}

Write a brief, personalized note that feels natural and warm. No subject line needed. Return valid JSON: {"body": "..."}`
  );
  if (result) {
    try {
      const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return generateNoteTemplate(ctx);
    }
  }

  return generateNoteTemplate(ctx);
}

function generateNoteTemplate(ctx: NoteContext): { body: string } {
  const firstName = ctx.contactName.split(" ")[0];
  const partnerFirst = ctx.partnerName.split(" ")[0];
  return {
    body: `Hey ${firstName},\n\nJust wanted to reach out and see how things are going at ${ctx.companyName}. Would love to catch up when you have a moment.\n\nBest,\n${partnerFirst}`,
  };
}

// ── Follow-Up Email for Cadence Engine ─────────────────────────────

export interface FollowUpEmailContext {
  partnerName: string;
  contactName: string;
  contactTitle: string;
  companyName: string;
  stepNumber: number;
  totalSteps: number;
  stepType: string;
  angleStrategy: string;
  previousEmails: string[];
  recentInteractions: string[];
  daysSinceLastStep: number;
}

export async function generateFollowUpEmail(
  ctx: FollowUpEmailContext
): Promise<{ subject: string; body: string }> {
  const angleMap: Record<string, string> = {
    "check-in": "a warm check-in angle",
    "value-add": "sharing a relevant insight or resource",
    "news-reference": "referencing recent company news",
    "event-followup": "following up after a shared event",
  };
  const angleDesc = angleMap[ctx.angleStrategy] ?? "a professional follow-up";

  const prevEmailsSummary =
    ctx.previousEmails.length > 0
      ? `Previous emails sent in this sequence:\n${ctx.previousEmails.map((e, i) => `--- Email ${i + 1} ---\n${e.slice(0, 300)}`).join("\n")}`
      : "This is the first email in the sequence.";

  const interactionCtx =
    ctx.recentInteractions.length > 0
      ? `Recent interactions:\n${ctx.recentInteractions.map((i) => `- ${i}`).join("\n")}`
      : "No recent interactions.";

  const result = await callLLM(
    `You are an expert relationship manager writing follow-up outreach emails. Each follow-up must use a DIFFERENT angle than previous emails. Be warm, concise, and professional. Return JSON with "subject" and "body" keys only.`,
    `Write a follow-up email from ${ctx.partnerName || "the partner"} to ${ctx.contactName} (${ctx.contactTitle} at ${ctx.companyName}).

This is follow-up step ${ctx.stepNumber + 1}. The approach is ${angleDesc}.
It has been ${ctx.daysSinceLastStep} days since the last outreach.

${prevEmailsSummary}

${interactionCtx}

IMPORTANT: Use a completely different angle from any previous emails. Keep under 150 words. Return valid JSON: {"subject": "...", "body": "..."}`
  );

  if (result) {
    try {
      const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return generateFollowUpTemplate(ctx);
    }
  }
  return generateFollowUpTemplate(ctx);
}

function generateFollowUpTemplate(ctx: FollowUpEmailContext): {
  subject: string;
  body: string;
} {
  const firstName = ctx.contactName.split(" ")[0];
  const partnerFirst = ctx.partnerName?.split(" ")[0] || "Best";

  const templates = [
    {
      subject: `Following up — ${ctx.companyName}`,
      body: `Hi ${firstName},\n\nI wanted to follow up on my earlier note. I know things can get busy, so no worries if the timing wasn't right.\n\nWould love to find 20 minutes to connect when it works for you.\n\nBest,\n${partnerFirst}`,
    },
    {
      subject: `Quick thought for ${ctx.companyName}`,
      body: `Hi ${firstName},\n\nI came across something that made me think of your work at ${ctx.companyName} and wanted to share.\n\nWould you be open to a brief call to discuss? Happy to work around your schedule.\n\nBest,\n${partnerFirst}`,
    },
    {
      subject: `Checking in — ${ctx.companyName}`,
      body: `Hi ${firstName},\n\nI hope all is going well at ${ctx.companyName}. I wanted to reach out one more time — I think there could be some valuable things to discuss.\n\nIf the timing is better now, I'd be glad to set something up. No pressure either way.\n\nBest regards,\n${partnerFirst}`,
    },
  ];

  return templates[Math.min(ctx.stepNumber, templates.length - 1)];
}

// ── Reply Draft for Inbound Email ──────────────────────────────────

export interface ReplyDraftContext {
  partnerName: string;
  contactName: string;
  contactTitle: string;
  companyName: string;
  inboundSummary: string;
  recentInteractions: string[];
}

export async function generateReplyDraft(
  ctx: ReplyDraftContext
): Promise<{ subject: string; body: string }> {
  const interactionCtx =
    ctx.recentInteractions.length > 0
      ? `Recent interaction history:\n${ctx.recentInteractions.map((i) => `- ${i}`).join("\n")}`
      : "";

  const result = await callLLM(
    `You are an expert relationship manager drafting a reply to an inbound email. Be warm, responsive, and professional. Return JSON with "subject" and "body" keys only.`,
    `Draft a reply from ${ctx.partnerName} to ${ctx.contactName} (${ctx.contactTitle} at ${ctx.companyName}).

They sent an email with this summary: "${ctx.inboundSummary}"

${interactionCtx}

Write a thoughtful, personalized reply. Keep under 150 words. Return valid JSON: {"subject": "...", "body": "..."}`
  );

  if (result) {
    try {
      const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return {
        subject: `Re: ${ctx.contactName}`,
        body: `Hi ${ctx.contactName.split(" ")[0]},\n\nThank you for reaching out. I appreciate you getting in touch.\n\nLet me take a look and get back to you shortly.\n\nBest,\n${ctx.partnerName.split(" ")[0]}`,
      };
    }
  }

  return {
    subject: `Re: ${ctx.contactName}`,
    body: `Hi ${ctx.contactName.split(" ")[0]},\n\nThank you for reaching out. I appreciate you getting in touch.\n\nLet me take a look and get back to you shortly.\n\nBest,\n${ctx.partnerName.split(" ")[0]}`,
  };
}

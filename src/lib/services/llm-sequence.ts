import { callLLM } from "./llm-core";

// ── Sequence Classifier ────────────────────────────────────────────

export interface SequenceClassifyContext {
  ruleType: string;
  nudgeReason: string;
  emailSubject: string;
  emailBody: string;
  contactImportance: string;
  daysSinceLastContact?: number;
}

export async function classifySequenceWorthy(
  ctx: SequenceClassifyContext
): Promise<{ shouldSequence: boolean; reason: string }> {
  const result = await callLLM(
    `You are an expert CRM analyst deciding if a sent outreach email warrants automated follow-up tracking (a multi-step sequence). Answer with JSON: {"shouldSequence": true/false, "reason": "one sentence explanation"}.

Rules:
- Meeting prep emails are NEVER sequence-worthy (the meeting itself is the follow-up).
- Emails asking for a meeting, call, or response ARE sequence-worthy.
- Congratulatory or FYI-only emails are NOT sequence-worthy unless the contact is CRITICAL importance.
- CRITICAL/HIGH importance contacts should almost always get sequences for any outreach.
- If the email contains a question or call-to-action, it's likely sequence-worthy.`,
    `Rule type: ${ctx.ruleType}
Nudge reason: ${ctx.nudgeReason}
Email subject: ${ctx.emailSubject}
Email body (first 500 chars): ${ctx.emailBody.slice(0, 500)}
Contact importance: ${ctx.contactImportance}
Days since last contact: ${ctx.daysSinceLastContact ?? "unknown"}

Should this outreach get automated follow-up tracking? Return valid JSON only.`
  );

  if (result) {
    try {
      const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (typeof parsed.shouldSequence === "boolean") {
        return parsed;
      }
    } catch {
      // fall through to template
    }
  }

  return classifySequenceTemplate(ctx);
}

function classifySequenceTemplate(
  ctx: SequenceClassifyContext
): { shouldSequence: boolean; reason: string } {
  const importance = ctx.contactImportance.toUpperCase();
  const isHighValue = importance === "CRITICAL" || importance === "HIGH";

  if (ctx.ruleType === "MEETING_PREP") {
    return { shouldSequence: false, reason: "Meeting prep emails don't need follow-up sequences" };
  }

  if (ctx.ruleType === "REPLY_NEEDED") {
    return { shouldSequence: false, reason: "Reply emails are responses, not outreach that needs tracking" };
  }

  if (ctx.ruleType === "STALE_CONTACT" && isHighValue) {
    return { shouldSequence: true, reason: "Re-engagement outreach to high-value contact warrants follow-up" };
  }

  if (ctx.ruleType === "JOB_CHANGE") {
    return { shouldSequence: true, reason: "Congratulations on role change — expect a response" };
  }

  if (["COMPANY_NEWS", "UPCOMING_EVENT", "EVENT_REGISTERED"].includes(ctx.ruleType)) {
    return { shouldSequence: true, reason: "Proactive outreach referencing timely event — follow-up warranted" };
  }

  if (["EVENT_ATTENDED", "ARTICLE_READ", "LINKEDIN_ACTIVITY"].includes(ctx.ruleType)) {
    return {
      shouldSequence: isHighValue,
      reason: isHighValue
        ? "Engagement-based outreach to high-value contact — track follow-up"
        : "Light engagement signal — one-off outreach sufficient",
    };
  }

  if (ctx.ruleType === "STALE_CONTACT") {
    return { shouldSequence: false, reason: "Lower-priority stale contact — one-off check-in" };
  }

  if (ctx.ruleType === "FOLLOW_UP") {
    return { shouldSequence: false, reason: "Already part of an active sequence" };
  }

  return {
    shouldSequence: isHighValue,
    reason: isHighValue
      ? "High-value contact — default to follow-up tracking"
      : "Standard outreach — no follow-up tracking needed",
  };
}

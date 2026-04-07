import { callLLM } from "./llm-core";

function parseJsonSubjectBody(
  result: string
): { subject: string; body: string } | null {
  try {
    const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { subject?: string; body?: string };
    if (
      typeof parsed.subject === "string" &&
      typeof parsed.body === "string"
    ) {
      return { subject: parsed.subject, body: parsed.body };
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateCampaignTemplate(params: {
  partnerName: string;
  contentItems: { title: string; type: string; description?: string }[];
}): Promise<{ subject: string; body: string }> {
  const itemsBlock = params.contentItems
    .map(
      (c, i) =>
        `${i + 1}. [${c.type}] ${c.title}${c.description ? ` — ${c.description}` : ""}`
    )
    .join("\n");

  const result = await callLLM(
    "You are drafting a campaign email sharing McKinsey content. Write a professional, warm email.",
    `Draft a base campaign email from ${params.partnerName}.

Content to highlight:
${itemsBlock || "(no items)"}

Return valid JSON with "subject" and "body" keys only: {"subject": "...", "body": "..."}`
  );

  if (result) {
    const parsed = parseJsonSubjectBody(result);
    if (parsed) return parsed;
  }

  return campaignTemplateFallback(params);
}

function campaignTemplateFallback(params: {
  partnerName: string;
  contentItems: { title: string; type: string; description?: string }[];
}): { subject: string; body: string } {
  const first = params.partnerName.split(" ")[0];
  const titles = params.contentItems.map((c) => c.title).filter(Boolean);
  const list =
    titles.length > 0
      ? titles.map((t) => `- ${t}`).join("\n")
      : "- A few recent insights from McKinsey";

  return {
    subject: "McKinsey insights to share",
    body: `I'd like to share a few McKinsey pieces that may be relevant to you and your team:

${list}

Happy to discuss any of these if helpful.

Best regards,
${first}`,
  };
}

export async function generateArticleCampaignEmail(params: {
  articleTitle: string;
  articleDescription: string;
  articleUrl: string;
  articlePractice: string;
  partnerName: string;
}): Promise<{ subject: string; body: string }> {
  const result = await callLLM(
    "You are drafting a personal email from a senior consulting Partner sharing a McKinsey article with a client. Tone: warm, personal, professional — as if forwarding something you genuinely found relevant. NOT a newsletter blast.",
    `Draft a campaign email from ${params.partnerName} sharing this McKinsey article:

Title: ${params.articleTitle}
Description: ${params.articleDescription}
Practice area: ${params.articlePractice}
URL: ${params.articleUrl}

The email should:
- Have a compelling, personal subject line (not generic)
- Do NOT include a greeting line (e.g. "Hi," or "Dear...") — the greeting is added separately
- Open directly with a natural reason for sharing ("I came across this piece..." or "Our team just published...")
- Summarize the key insight in 1-2 sentences
- Include a clear call-to-action to read the article
- Close with an offer to discuss and a sign-off
- Be 80-120 words total

Return valid JSON with "subject" and "body" keys only: {"subject": "...", "body": "..."}`
  );

  if (result) {
    const parsed = parseJsonSubjectBody(result);
    if (parsed) return parsed;
  }

  const first = params.partnerName.split(" ")[0];
  return {
    subject: `Thought you'd find this relevant: ${params.articleTitle}`,
    body: `I wanted to share a recent piece from our team that I thought would resonate with you:

"${params.articleTitle}" — ${params.articleDescription}

You can read the full article here: ${params.articleUrl}

I'd love to hear your thoughts, and happy to discuss how these insights might apply to your organization.

Best regards,
${first}`,
  };
}

export async function personalizeCampaignEmail(params: {
  template: string;
  contactName: string;
  contactTitle: string;
  companyName: string;
  recentInteractions: string[];
}): Promise<string> {
  const interactionBlock = params.recentInteractions.length
    ? `Recent interactions:\n${params.recentInteractions.map((i) => `- ${i}`).join("\n")}`
    : "No recent interactions.";

  const result = await callLLM(
    "You write concise, warm professional email openings. Return only the opening paragraph text (2–3 sentences), no subject line, no greeting line, no sign-off. Plain text only.",
    `Write a personalized opening paragraph (2–3 sentences) for a campaign email that will follow the template below.

Template context (for tone only; do not repeat verbatim):
${params.template.slice(0, 1200)}

Recipient: ${params.contactName}, ${params.contactTitle} at ${params.companyName}.

${interactionBlock}`
  );

  if (result?.trim()) {
    return result.trim();
  }

  const firstName = params.contactName.split(" ")[0];
  return `Hi ${firstName},`;
}

export async function generateCampaignFollowUp(params: {
  contactName: string;
  contactTitle: string;
  companyName: string;
  campaignName: string;
  contentItems: { title: string; type: string }[];
  engagement: {
    opened: boolean;
    clicked: boolean;
    articleRead: boolean;
    rsvpStatus?: string;
  };
}): Promise<{ subject: string; body: string }> {
  const { engagement: e } = params;
  const itemsBlock = params.contentItems
    .map((c) => `- [${c.type}] ${c.title}`)
    .join("\n");

  let system =
    "You are drafting a short follow-up email for a McKinsey content campaign. Be professional and warm. Return JSON with \"subject\" and \"body\" keys only.";

  if (!e.opened) {
    system +=
      " The recipient may not have opened the first email; keep the follow-up gentle and value-focused.";
  } else if (e.articleRead) {
    system +=
      " The recipient read an article; acknowledge interest and offer a brief next step.";
  } else if (e.clicked) {
    system +=
      " The recipient clicked a link; thank them and offer to go deeper.";
  } else if (e.rsvpStatus) {
    system += ` RSVP status: ${e.rsvpStatus}. Reference it naturally.`;
  } else {
    system +=
      " The recipient opened the email but did not click; offer a light nudge with one clear CTA.";
  }

  const result = await callLLM(
    system,
    `Write a follow-up email to ${params.contactName} (${params.contactTitle} at ${params.companyName}) regarding the campaign "${params.campaignName}".

Engagement: opened=${e.opened}, clicked=${e.clicked}, articleRead=${e.articleRead}${e.rsvpStatus ? `, rsvpStatus=${e.rsvpStatus}` : ""}

Content shared:
${itemsBlock || "(none)"}

Return valid JSON: {"subject": "...", "body": "..."}`
  );

  if (result) {
    const parsed = parseJsonSubjectBody(result);
    if (parsed) return parsed;
  }

  return campaignFollowUpFallback(params);
}

function campaignFollowUpFallback(params: {
  contactName: string;
  contactTitle: string;
  companyName: string;
  campaignName: string;
  contentItems: { title: string; type: string }[];
  engagement: {
    opened: boolean;
    clicked: boolean;
    articleRead: boolean;
    rsvpStatus?: string;
  };
}): { subject: string; body: string } {
  const first = params.contactName.split(" ")[0];
  const e = params.engagement;

  if (!e.opened) {
    return {
      subject: `Following up — ${params.campaignName}`,
      body: `Hi ${first},

I wanted to resend a quick note about "${params.campaignName}" in case it got buried. I think the pieces we shared could be useful for ${params.companyName}.

Let me know if you would like to discuss any of them.

Best regards`,
    };
  }

  if (e.articleRead) {
    return {
      subject: `Thanks for reading — ${params.campaignName}`,
      body: `Hi ${first},

I saw you had a chance to read some of the content from "${params.campaignName}" — thank you. If any themes stood out for your role as ${params.contactTitle}, I would be glad to share a bit more context or connect you with the right colleague.

Best regards`,
    };
  }

  if (e.clicked) {
    return {
      subject: `Quick follow-up — ${params.campaignName}`,
      body: `Hi ${first},

Thanks for clicking through on "${params.campaignName}". If you want to go deeper on how this applies to ${params.companyName}, I am happy to find time.

Best regards`,
    };
  }

  if (e.rsvpStatus) {
    return {
      subject: `RSVP update — ${params.campaignName}`,
      body: `Hi ${first},

Following up on "${params.campaignName}" — I see your RSVP status is ${e.rsvpStatus}. Let me know if plans change or if you have questions about the event.

Best regards`,
    };
  }

  return {
    subject: `Checking in — ${params.campaignName}`,
    body: `Hi ${first},

Following up on "${params.campaignName}" — if any of the McKinsey pieces are timely for ${params.companyName}, I would be glad to discuss.

Best regards`,
  };
}

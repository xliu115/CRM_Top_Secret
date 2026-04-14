import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { campaignRepo, contactRepo, interactionRepo } from "@/lib/repositories";
import { prisma } from "@/lib/db/prisma";
import { generateArticleCampaignEmail, personalizeCampaignEmail } from "@/lib/services/llm-campaign";
import { scoreContactsForArticle } from "@/lib/services/article-relevance";
import { formatDateForLLM } from "@/lib/utils/format-date";

export async function POST(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    let body: { contentItemId?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const contentItemId = body.contentItemId?.trim();
    if (!contentItemId) {
      return NextResponse.json({ error: "contentItemId is required" }, { status: 400 });
    }

    const contentItem = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
    });
    if (!contentItem || contentItem.type !== "ARTICLE") {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const existing = await prisma.campaignContent.findFirst({
      where: { contentItemId, campaign: { partnerId } },
      include: { campaign: true },
    });
    if (existing) {
      return NextResponse.json({ campaignId: existing.campaignId });
    }

    const contacts = await contactRepo.findByPartnerId(partnerId);
    const contactIds = contacts.map((c) => c.id);

    const allArticles = await prisma.articleEngagement.findMany({
      where: { contactId: { in: contactIds } },
      orderBy: { createdAt: "desc" },
    });
    const articlesByContact = new Map<string, typeof allArticles>();
    for (const a of allArticles) {
      const arr = articlesByContact.get(a.contactId);
      if (arr) arr.push(a);
      else articlesByContact.set(a.contactId, [a]);
    }

    const scored = scoreContactsForArticle({
      practice: contentItem.practice,
      contacts: contacts.map((c) => ({
        id: c.id,
        importance: c.importance,
        lastContacted: c.lastContacted,
        company: { industry: c.company.industry ?? "" },
      })),
      articlesByContact,
      now: new Date(),
    });

    const matchedContactIds = scored.length > 0
      ? scored.map((s) => s.contactId)
      : contacts.slice(0, 5).map((c) => c.id);

    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    const partnerName = partner?.name ?? "Partner";

    const emailDraft = await generateArticleCampaignEmail({
      articleTitle: contentItem.title,
      articleDescription: contentItem.description ?? "",
      articleUrl: contentItem.url ?? "",
      articlePractice: contentItem.practice ?? "",
      partnerName,
    });

    const campaign = await campaignRepo.create({
      partnerId,
      name: `Share: ${contentItem.title}`,
      subject: emailDraft.subject,
      bodyTemplate: emailDraft.body,
      source: "ACTIVATE",
    });

    await campaignRepo.addContent(campaign.id, [contentItemId]);
    await campaignRepo.addRecipients(campaign.id, matchedContactIds);

    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id },
      include: { contact: { include: { company: true } } },
    });

    const personalizationPromises = recipients.map(async (r) => {
      if (!r.contact) return;
      const interactions = await interactionRepo.findByContactId(r.contact.id);
      const recentInteractions = interactions
        .slice(0, 5)
        .map((i) => `${i.type} (${formatDateForLLM(i.date)}): ${i.summary}`);

      const personalizedBody = await personalizeCampaignEmail({
        template: emailDraft.body,
        contactName: r.contact.name,
        contactTitle: r.contact.title ?? "",
        companyName: r.contact.company?.name ?? "",
        recentInteractions,
      });

      await campaignRepo.updateRecipient(r.id, { personalizedBody });
    });

    await Promise.allSettled(personalizationPromises);

    return NextResponse.json({ campaignId: campaign.id }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[campaigns/from-article] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

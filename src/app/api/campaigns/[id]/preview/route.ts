import { NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { campaignRepo, interactionRepo } from "@/lib/repositories";
import { personalizeCampaignEmail } from "@/lib/services/llm-campaign";
import { buildCampaignEmailHtml } from "@/lib/services/email-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const campaign = await campaignRepo.findById(id, partnerId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (campaign.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Preview is only available for draft campaigns" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const template = campaign.bodyTemplate ?? "";
    const subject = campaign.subject ?? "";

    const recipientsOut: {
      id: string;
      contactName: string;
      subject: string;
      htmlPreview: string;
    }[] = [];

    for (const r of campaign.recipients) {
      const contact = r.contact;
      const contactName = contact?.name ?? "Contact";
      const contactTitle = contact?.title ?? "";
      const companyName = contact?.company?.name ?? "";

      let recentInteractions: string[] = [];
      if (contact) {
        const interactions = await interactionRepo.findByContactId(contact.id);
        recentInteractions = interactions
          .slice(0, 5)
          .map(
            (i) =>
              `${i.type} (${i.date.toISOString().split("T")[0]}): ${i.summary}`
          );
      }

      const personalizedBody = await personalizeCampaignEmail({
        template,
        contactName,
        contactTitle,
        companyName,
        recentInteractions,
      });

      await campaignRepo.updateRecipient(r.id, { personalizedBody });

      const contentItems = campaign.contents.map((cc) => ({
        contentItemId: cc.contentItem.id,
        title: cc.contentItem.title,
        description: cc.contentItem.description ?? undefined,
        url: cc.contentItem.url ?? undefined,
        type: cc.contentItem.type,
        eventDate: cc.contentItem.eventDate ?? undefined,
        eventLocation: cc.contentItem.eventLocation ?? undefined,
      }));

      const htmlPreview = buildCampaignEmailHtml({
        personalizedOpening: personalizedBody,
        bodyTemplate: template,
        contentItems,
        recipientId: r.id,
        rsvpToken: r.rsvpToken ?? undefined,
        appUrl,
      });

      recipientsOut.push({
        id: r.id,
        contactName,
        subject,
        htmlPreview,
      });
    }

    return NextResponse.json({ recipients: recipientsOut });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

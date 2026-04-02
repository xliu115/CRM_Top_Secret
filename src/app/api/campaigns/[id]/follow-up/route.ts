import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { campaignRepo } from "@/lib/repositories";
import { generateCampaignFollowUp } from "@/lib/services/llm-campaign";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    let body: { recipientIds?: string[] } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const recipientIds = Array.isArray(body.recipientIds)
      ? body.recipientIds
      : [];
    if (recipientIds.length === 0) {
      return NextResponse.json(
        { error: "recipientIds is required" },
        { status: 400 }
      );
    }

    const campaign = await campaignRepo.findById(id, partnerId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const contentItems = campaign.contents.map((c) => ({
      title: c.contentItem.title,
      type: c.contentItem.type,
    }));

    const drafts: {
      recipientId: string;
      contactName: string;
      subject: string;
      body: string;
    }[] = [];

    const byId = new Map(campaign.recipients.map((r) => [r.id, r]));

    for (const rid of recipientIds) {
      const r = byId.get(rid);
      if (!r) continue;

      const contact = r.contact;
      const contactName = contact?.name ?? "Contact";
      const contactTitle = contact?.title ?? "";
      const companyName = contact?.company?.name ?? "";

      const types = new Set(r.engagements.map((e) => e.type));
      const engagement = {
        opened: types.has("OPENED"),
        clicked: types.has("CLICKED"),
        articleRead: types.has("ARTICLE_READ"),
        rsvpStatus: r.rsvpStatus ?? undefined,
      };

      const { subject, body: followBody } = await generateCampaignFollowUp({
        contactName,
        contactTitle,
        companyName,
        campaignName: campaign.name,
        contentItems,
        engagement,
      });

      drafts.push({
        recipientId: r.id,
        contactName,
        subject,
        body: followBody,
      });
    }

    return NextResponse.json({ drafts });
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

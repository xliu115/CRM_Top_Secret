import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { campaignRepo } from "@/lib/repositories";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ recipientId: string; contentItemId: string }> }
) {
  const { recipientId, contentItemId } = await params;

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: recipientId },
  });

  if (!recipient) {
    return new NextResponse(null, { status: 204 });
  }

  const contentItem = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
  });

  if (!contentItem?.url) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const engagementType =
    contentItem.type === "ARTICLE" ? "ARTICLE_READ" : "CLICKED";

  try {
    await campaignRepo.recordEngagement(
      recipientId,
      engagementType,
      contentItemId
    );
  } catch {
    // Still redirect
  }

  return NextResponse.redirect(contentItem.url, 302);
}

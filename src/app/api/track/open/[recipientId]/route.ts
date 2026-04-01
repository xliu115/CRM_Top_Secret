import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { campaignRepo } from "@/lib/repositories";

const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

const GIF_HEADERS = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  const { recipientId } = await params;

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: recipientId },
  });

  if (!recipient) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await campaignRepo.recordEngagement(recipientId, "OPENED");
  } catch {
    // Still return pixel so email clients don't break
  }

  return new NextResponse(PIXEL_GIF, { status: 200, headers: GIF_HEADERS });
}

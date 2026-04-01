import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { campaignRepo } from "@/lib/repositories";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  const { recipientId } = await params;
  const urlParam = request.nextUrl.searchParams.get("url");

  if (!urlParam?.trim()) {
    return NextResponse.json({ error: "Missing url query parameter" }, { status: 400 });
  }

  let targetUrl: string;
  try {
    const parsed = new URL(urlParam);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Invalid URL scheme" }, { status: 400 });
    }
    targetUrl = parsed.href;
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: recipientId },
  });

  if (!recipient) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await campaignRepo.recordEngagement(recipientId, "CLICKED");
  } catch {
    // Still redirect
  }

  return NextResponse.redirect(targetUrl, 302);
}

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { campaignRepo } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const source = searchParams.get("source") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const campaigns = await campaignRepo.findByPartnerId(partnerId, {
      status,
      source,
      search,
    });

    return NextResponse.json(campaigns);
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

export async function POST(request: NextRequest) {
  try {
    const partnerId = await requirePartnerId();

    let body: {
      name?: string;
      subject?: string;
      bodyTemplate?: string;
      signatureBlock?: string;
      contentItemIds?: string[];
      contactIds?: string[];
      segmentCriteria?: unknown;
    } = {};

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const segmentCriteria =
      body.segmentCriteria !== undefined && body.segmentCriteria !== null
        ? typeof body.segmentCriteria === "string"
          ? body.segmentCriteria
          : JSON.stringify(body.segmentCriteria)
        : undefined;

    const campaign = await campaignRepo.create({
      partnerId,
      name,
      subject: body.subject,
      bodyTemplate: body.bodyTemplate,
      signatureBlock: body.signatureBlock,
      source: "ACTIVATE",
      segmentCriteria,
    });

    if (Array.isArray(body.contentItemIds) && body.contentItemIds.length > 0) {
      await campaignRepo.addContent(campaign.id, body.contentItemIds);
    }

    if (Array.isArray(body.contactIds) && body.contactIds.length > 0) {
      await campaignRepo.addRecipients(campaign.id, body.contactIds);
    }

    const detail = await campaignRepo.findById(campaign.id, partnerId);
    return NextResponse.json(detail ?? campaign, { status: 201 });
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

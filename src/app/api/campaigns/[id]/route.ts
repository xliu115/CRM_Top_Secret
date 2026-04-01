import { NextRequest, NextResponse } from "next/server";
import { requirePartnerId } from "@/lib/auth/get-current-partner";
import { campaignRepo } from "@/lib/repositories";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const campaign = await campaignRepo.findById(id, partnerId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json(campaign);
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const existing = await campaignRepo.findById(id, partnerId);
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft campaigns can be updated" },
        { status: 400 }
      );
    }

    let body: {
      name?: string;
      subject?: string;
      bodyTemplate?: string;
      contentItemIds?: string[];
      contactIds?: string[];
    } = {};

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const data: Parameters<typeof campaignRepo.update>[2] = {};
    if (typeof body.name === "string") data.name = body.name;
    if (body.subject !== undefined) data.subject = body.subject;
    if (body.bodyTemplate !== undefined) data.bodyTemplate = body.bodyTemplate;

    if (Object.keys(data).length > 0) {
      await campaignRepo.update(id, partnerId, data);
    }

    if (body.contentItemIds !== undefined) {
      const currentIds = existing.contents.map((c) => c.contentItemId);
      if (currentIds.length > 0) {
        await campaignRepo.removeContent(id, currentIds);
      }
      if (body.contentItemIds.length > 0) {
        await campaignRepo.addContent(id, body.contentItemIds);
      }
    }

    if (body.contactIds !== undefined) {
      const currentContactIds = existing.recipients
        .map((r) => r.contactId)
        .filter((cid): cid is string => cid != null);
      if (currentContactIds.length > 0) {
        await campaignRepo.removeRecipients(id, currentContactIds);
      }
      if (body.contactIds.length > 0) {
        await campaignRepo.addRecipients(id, body.contactIds);
      }
    }

    const updated = await campaignRepo.findById(id, partnerId);
    return NextResponse.json(updated);
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partnerId = await requirePartnerId();
    const { id } = await params;

    const existing = await campaignRepo.findById(id, partnerId);
    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft campaigns can be deleted" },
        { status: 400 }
      );
    }

    await campaignRepo.delete(id, partnerId);
    return new NextResponse(null, { status: 204 });
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

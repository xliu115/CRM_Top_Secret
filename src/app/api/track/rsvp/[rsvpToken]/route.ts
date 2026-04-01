import { NextRequest, NextResponse } from "next/server";
import { campaignRepo } from "@/lib/repositories";

function confirmationHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #f5f5f5; color: #2d2d2d; }
    .card { background: #fff; padding: 32px 40px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.08);
      max-width: 420px; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 12px; color: #051c2c; }
    p { margin: 0; line-height: 1.5; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rsvpToken: string }> }
) {
  const { rsvpToken } = await params;
  const decline =
    request.nextUrl.searchParams.get("response") === "decline";

  const row = await campaignRepo.findRecipientByRsvpToken(rsvpToken);

  if (!row) {
    return new NextResponse(
      confirmationHtml(
        "Link not found",
        "This RSVP link is invalid or has expired."
      ),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const now = new Date();

  if (decline) {
    await campaignRepo.updateRecipient(row.id, {
      rsvpStatus: "DECLINED",
      rsvpRespondedAt: now,
    });
    return new NextResponse(
      confirmationHtml(
        "Response recorded",
        "You have declined this invitation. You can close this page."
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  await campaignRepo.updateRecipient(row.id, {
    rsvpStatus: "ACCEPTED",
    rsvpRespondedAt: now,
  });

  try {
    await campaignRepo.recordEngagement(row.id, "EVENT_REGISTERED");
  } catch {
    // Confirmation still shown
  }

  return new NextResponse(
    confirmationHtml(
      "You are registered",
      "Thank you — your RSVP has been recorded. We look forward to seeing you."
    ),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

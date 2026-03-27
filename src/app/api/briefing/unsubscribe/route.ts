import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyUnsubscribeToken } from "@/lib/services/briefing-service";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse(unsubscribePage("Missing token.", false), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const partnerId = verifyUnsubscribeToken(token);

  if (!partnerId) {
    return new NextResponse(unsubscribePage("Invalid or expired link.", false), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    await prisma.partner.update({
      where: { id: partnerId },
      data: { briefingEnabled: false },
    });

    return new NextResponse(
      unsubscribePage("You've been unsubscribed from morning briefings.", true),
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch {
    return new NextResponse(
      unsubscribePage("Something went wrong. Please try again.", false),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}

function unsubscribePage(message: string, success: boolean): string {
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const color = success ? "#16a34a" : "#dc2626";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Activate — Briefing Preferences</title>
</head>
<body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
  <div style="max-width: 400px; text-align: center; padding: 40px 24px;">
    <div style="font-size: 14px; font-weight: 600; color: #2251FF; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 16px;">Activate</div>
    <p style="font-size: 18px; font-weight: 600; color: ${color}; margin: 0 0 12px 0;">${message}</p>
    ${success ? '<p style="font-size: 14px; color: #64748b; margin: 0 0 24px 0;">You can re-enable briefings anytime from your dashboard settings.</p>' : ""}
    <a href="${appUrl}/dashboard" style="display: inline-block; padding: 10px 24px; background: #051C2C; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 4px;">Open Activate</a>
  </div>
</body>
</html>`;
}

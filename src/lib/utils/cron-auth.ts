import { NextRequest } from "next/server";

export function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const fromHeader = request.headers.get("x-cron-secret");
  return fromHeader === secret;
}

import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VALID_PARTNER_IDS = [
  "p-ava-patel",
  "p-jordan-kim",
  "p-sam-rivera",
  "p-morgan-chen",
  "p-taylor-brooks",
];

const protectedPaths = [
  "/dashboard",
  "/nudges",
  "/contacts",
  "/companies",
  "/meetings",
  "/chat",
  "/api/nudges",
  "/api/nudge-rules",
  "/api/contacts",
  "/api/meetings",
  "/api/chat",
  "/api/signals",
  "/api/dashboard",
  "/api/stats",
  "/api/companies",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!isProtected) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token) return NextResponse.next();

  // Dev/verification bypass: accept partner_id cookie for API routes
  if (
    process.env.NODE_ENV === "development" &&
    pathname.startsWith("/api/")
  ) {
    const partnerId = request.cookies.get("partner_id")?.value;
    if (partnerId && VALID_PARTNER_IDS.includes(partnerId)) {
      return NextResponse.next();
    }
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/nudges/:path*",
    "/contacts/:path*",
    "/companies/:path*",
    "/meetings/:path*",
    "/chat/:path*",
    "/api/nudges/:path*",
    "/api/nudge-rules/:path*",
    "/api/contacts/:path*",
    "/api/meetings/:path*",
    "/api/chat/:path*",
    "/api/signals/:path*",
    "/api/dashboard/:path*",
    "/api/stats/:path*",
    "/api/companies/:path*",
  ],
};

import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = [
  "/dashboard",
  "/nudges",
  "/contacts",
  "/meetings",
  "/chat",
  "/api/nudges",
  "/api/nudge-rules",
  "/api/contacts",
  "/api/meetings",
  "/api/chat",
  "/api/signals",
  "/api/dashboard",
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

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/nudges/:path*",
    "/contacts/:path*",
    "/meetings/:path*",
    "/chat/:path*",
    "/api/nudges/:path*",
    "/api/nudge-rules/:path*",
    "/api/contacts/:path*",
    "/api/meetings/:path*",
    "/api/chat/:path*",
    "/api/signals/:path*",
    "/api/dashboard/:path*",
  ],
};

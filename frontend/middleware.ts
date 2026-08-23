import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge-compatible middleware for route protection.
 * Uses cookie-based session detection to avoid importing next-auth
 * (which pulls in Node.js modules incompatible with Edge Runtime).
 *
 * Full session validation still happens server-side in API routes via auth.ts.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for NextAuth session token (covers both dev and production cookie names)
  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token");

  const isOnDashboard = pathname.startsWith("/dashboard");

  // Protect dashboard routes — redirect to login if no session
  if (isOnDashboard && !hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If logged in and on login page, redirect to dashboard
  if (hasSession && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

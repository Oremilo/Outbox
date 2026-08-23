import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth configuration.
 * This file must NOT import any Node.js-only modules (Prisma, providers, etc.)
 * because it's used by middleware which runs in the Edge Runtime.
 *
 * Providers are intentionally left as an empty array here and added in auth.ts,
 * which runs in the Node.js runtime.
 */
export const authConfig = {
  providers: [],
  pages: {
    signIn: "/",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      }

      // If logged in and on login page, redirect to dashboard
      if (isLoggedIn && nextUrl.pathname === "/") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;

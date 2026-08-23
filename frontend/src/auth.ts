import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Full NextAuth configuration for API routes and server components.
 * This file CAN import Node.js-only modules (Prisma adapter, etc.)
 * because it only runs in the Node.js runtime, never in Edge middleware.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Add Prisma adapter or other Node.js-only config here when needed:
  // adapter: PrismaAdapter(prisma),
});

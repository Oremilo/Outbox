import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Use only the Edge-safe config — no Prisma adapter or Node.js modules
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

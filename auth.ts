import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      role?: string;
    } & DefaultSession["user"];
  }
}

console.log("NextAuth loading - GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? `Loaded (length: ${process.env.GOOGLE_CLIENT_ID.length}, prefix: ${process.env.GOOGLE_CLIENT_ID.substring(0, 12)}...)` : "MISSING/NOT_LOADED");

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const dbUser = await db.user.findUnique({
          where: { email: user.email },
        });
        if (dbUser) {
          return true;
        }
      }
      return false; // Blocks sign-in if they aren't in the DB
    },
    async jwt({ token, user }) {
      // On initial sign-in, user is passed
      if (user && user.email) {
        const dbUser = await db.user.findUnique({
          where: { email: user.email },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.id = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) {
          session.user.id = String(token.id);
        }
        if (token.role) {
          session.user.role = String(token.role);
        }
      }
      return session;
    },
  },
});

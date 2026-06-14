import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
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
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

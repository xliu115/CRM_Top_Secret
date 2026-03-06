import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { partnerRepo } from "@/lib/repositories";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Partner Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "ava.patel@firm.com" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const partner = await partnerRepo.findByEmail(credentials.email);
        if (!partner) return null;
        return {
          id: partner.id,
          email: partner.email,
          name: partner.name,
          image: partner.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.partnerId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).partnerId =
          token.partnerId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};

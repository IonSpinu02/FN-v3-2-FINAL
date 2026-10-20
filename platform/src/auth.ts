import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

function allowlist(): Set<string> {
  const raw = process.env.ALLOWLIST_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "Accesso interno",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        const list = allowlist();
        if (!email || !list.has(email)) return null;
        const expected = process.env.PLATFORM_PASSWORD ?? "";
        if (!expected || password !== expected) return null;
        return { id: email, email };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});

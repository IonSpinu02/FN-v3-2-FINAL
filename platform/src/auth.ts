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

/** email (lowercase) → password dedicata */
function allowlistCredentials(): Map<string, string> {
  const raw = process.env.ALLOWLIST_CREDENTIALS ?? "";
  const map = new Map<string, string>();
  for (const chunk of raw.split(",")) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(":");
    if (sep <= 0) continue;
    const email = trimmed.slice(0, sep).trim().toLowerCase();
    const pass = trimmed.slice(sep + 1);
    if (email && pass) map.set(email, pass);
  }
  return map;
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
        if (!email) return null;

        const dedicated = allowlistCredentials().get(email);
        if (dedicated !== undefined) {
          if (password !== dedicated) return null;
          return { id: email, email };
        }

        const list = allowlist();
        if (!list.has(email)) return null;
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

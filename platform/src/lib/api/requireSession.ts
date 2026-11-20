import { auth } from "@/auth";

/** Opt-in solo in non-prod: `FN_AUTH_DEV_BYPASS=1` */
export const FN_AUTH_DEV_BYPASS_ENV = "FN_AUTH_DEV_BYPASS";

export type AppSession = {
  user: {
    id: string;
    email: string;
  };
};

function devBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const v = process.env[FN_AUTH_DEV_BYPASS_ENV]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Fail-closed in produzione: solo sessione NextAuth valida. */
export async function requireSession(): Promise<AppSession | null> {
  if (devBypassEnabled()) {
    return { user: { id: "dev-bypass", email: "dev-bypass@local" } };
  }
  const session = await auth();
  const email = session?.user?.email?.trim();
  if (!email) return null;
  const id = session?.user?.id?.trim() || email;
  return { user: { id, email } };
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
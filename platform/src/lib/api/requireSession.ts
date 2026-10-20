import { auth } from "@/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  return session;
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/** Accesso aperto: riattivare il blocco sessione quando si ripristina il login. */
export async function requireSession() {
  return { user: { id: "interno", email: "interno@fn" } };
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

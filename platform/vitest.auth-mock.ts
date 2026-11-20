import { vi } from "vitest";

/** Evita di caricare NextAuth/next/server nei test che importano route API. */
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
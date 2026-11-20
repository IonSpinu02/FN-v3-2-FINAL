import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FN_AUTH_DEV_BYPASS_ENV,
  requireSession,
} from "./requireSession";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";

describe("requireSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(auth).mockReset();
  });

  it("in produzione ignora FN_AUTH_DEV_BYPASS e richiede sessione reale", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(FN_AUTH_DEV_BYPASS_ENV, "1");
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(requireSession()).resolves.toBeNull();

    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", email: "staff@example.com" },
    } as never);
    await expect(requireSession()).resolves.toEqual({
      user: { id: "u1", email: "staff@example.com" },
    });
  });

  it("in dev senza bypass restituisce null se auth assente", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(FN_AUTH_DEV_BYPASS_ENV, "");
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(requireSession()).resolves.toBeNull();
  });

  it("in dev con FN_AUTH_DEV_BYPASS=1 non chiama auth", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(FN_AUTH_DEV_BYPASS_ENV, "1");
    const session = await requireSession();
    expect(session?.user.email).toBe("dev-bypass@local");
    expect(auth).not.toHaveBeenCalled();
  });
});
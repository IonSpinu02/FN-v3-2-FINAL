import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import {
  evaluateRouteTrackingStatus,
  parseActiveStrategicRoute,
  readActiveStrategicRoute,
  writeActiveStrategicRoute,
  type RouteStorage,
} from "@/lib/state/activeStrategicRoute";
import type { StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import { POST } from "@/app/api/export/strategic-plan-pdf/route";

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "test", email: "test@example.com" },
  } as never);
});

function memory(): RouteStorage {
  const bag = new Map<string, string>();
  return {
    getItem: (key) => bag.get(key) ?? null,
    setItem: (key, value) => {
      bag.set(key, value);
    },
    removeItem: (key) => {
      bag.delete(key);
    },
  };
}

function corridor(min: number, expected: number, stretch: number): Pick<StrategicBackcastResult, "checkpoints"> {
  return {
    checkpoints: [
      { day: 30, minOnTrackPct: min, expectedPct: expected, stretchPct: stretch, status: "IN_ROTTA" },
    ],
  };
}

describe("rotta operativa attiva", () => {
  it("ignora JSON malformato e conserva un payload valido", () => {
    const store = memory();
    expect(readActiveStrategicRoute(store)).toBeNull();
    store.setItem("fn-active-strategic-route", "{");
    expect(readActiveStrategicRoute(store)).toBeNull();
    expect(parseActiveStrategicRoute({ targetPct: 80, horizonDays: 180, activatedAt: "2026-11-11T00:00:00.000Z", baselinePctAtActivation: 6 })).toBeNull();
    writeActiveStrategicRoute(
      {
        targetPct: 8,
        horizonDays: 180,
        activatedAt: "2026-11-11T10:00:00.000Z",
        baselinePctAtActivation: 6.2,
      },
      store,
    );
    expect(readActiveStrategicRoute(store)?.targetPct).toBe(8);
    expect(readActiveStrategicRoute(store)?.horizonDays).toBe(180);
  });

  it("classifica in rotta, da accelerare e in anticipo sul checkpoint a 30 giorni", () => {
    const plan = corridor(7, 7.4, 7.8);
    expect(evaluateRouteTrackingStatus(7.2, plan).status).toBe("IN_ROTTA");
    expect(evaluateRouteTrackingStatus(6.4, plan).status).toBe("DA_ACCELERARE");
    expect(evaluateRouteTrackingStatus(8.1, plan).status).toBe("IN_ANTICIPO");
    const track = evaluateRouteTrackingStatus(7.1, plan);
    expect(track.nextCheckpointDays).toBe(30);
    expect(track.nextCheckpointPct).toBe(7.4);
    expect(track.deltaToNextCheckpointPct).toBeCloseTo(-0.3, 8);
  });

  it("valida il PDF del piano e rifiuta un input invalido", async () => {
    const bad = await POST(
      new Request("http://localhost/api/export/strategic-plan-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPct: 40, horizonDays: 15 }),
      }),
    );
    expect(bad.status).toBe(400);

    const ok = await POST(
      new Request("http://localhost/api/export/strategic-plan-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPct: 8, horizonDays: 180 }),
      }),
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("application/pdf");
    const okBytes = Buffer.from(await ok.arrayBuffer());
    expect(okBytes.subarray(0, 5).toString()).toBe("%PDF-");

    const beyond = await POST(
      new Request("http://localhost/api/export/strategic-plan-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPct: 18, horizonDays: 90 }),
      }),
    );
    expect(beyond.status).toBe(200);
    expect(beyond.headers.get("content-type")).toContain("application/pdf");
    const beyondBytes = Buffer.from(await beyond.arrayBuffer());
    expect(beyondBytes.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30000);
});

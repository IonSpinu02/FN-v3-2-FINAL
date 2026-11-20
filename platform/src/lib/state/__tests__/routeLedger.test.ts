import { describe, expect, it } from "vitest";
import {
  ROUTE_LEDGER_KEY,
  addConsensoObservation,
  addNetworkObservation,
  readLedger,
  removeObservation,
  type LedgerStorage,
} from "@/lib/state/routeLedger";

function memory(): LedgerStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("routeLedger", () => {
  it("salva e rilegge le rilevazioni della rotta", () => {
    const store = memory();
    addConsensoObservation("route-a", { date: "2026-02-01", pct: 7.1, n: 1200, source: "sondaggio" }, store);
    const ledger = addNetworkObservation("route-a", { date: "2026-02-01", committees: 1850, members: 160000, elected: 104 }, store);
    expect(ledger.consenso).toHaveLength(1);
    expect(ledger.rete).toHaveLength(1);
    expect(readLedger("route-a", store).consenso[0]!.pct).toBe(7.1);
  });

  it("non mescola le rilevazioni di rotte diverse", () => {
    const store = memory();
    addConsensoObservation("route-a", { date: "2026-02-01", pct: 7.1, source: "supermedia" }, store);
    expect(readLedger("route-b", store).consenso).toHaveLength(0);
  });

  it("scarta dati malformati o fuori scala", () => {
    const store = memory();
    store.setItem(
      ROUTE_LEDGER_KEY,
      JSON.stringify({
        routeId: "r",
        consenso: [
          { id: "ok", date: "2026-03-01", pct: 8, source: "interno" },
          { id: "bad-date", date: "ieri", pct: 8, source: "interno" },
          { id: "bad-pct", date: "2026-03-01", pct: 300, source: "interno" },
          { id: "bad-src", date: "2026-03-01", pct: 8, source: "oracolo" },
          { id: "bad-n", date: "2026-03-01", pct: 8, n: -4, source: "sondaggio" },
        ],
        rete: [{ id: "neg", date: "2026-03-01", committees: -1, members: 5, elected: 1 }],
      }),
    );
    const ledger = readLedger("r", store);
    expect(ledger.consenso.map((row) => row.id)).toEqual(["ok"]);
    expect(ledger.rete).toHaveLength(0);
  });

  it("sopravvive a JSON corrotto e permette di eliminare una voce", () => {
    const store = memory();
    store.setItem(ROUTE_LEDGER_KEY, "{non json");
    expect(readLedger("r", store)).toEqual({ consenso: [], rete: [] });
    const ledger = addConsensoObservation("r", { date: "2026-03-01", pct: 8, source: "interno" }, store);
    const id = ledger.consenso[0]!.id;
    expect(removeObservation("r", id, store).consenso).toHaveLength(0);
  });
});

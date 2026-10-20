import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { execSync } from "child_process";
import { describe, expect, it } from "vitest";
import { REGIONS } from "./constants";
import {
  evaluatePostVoteWithPoll,
  parseHistory,
} from "./historyAndEval";
import { DEFAULT_POLL_CONFIG } from "./regionalPoll";
import type { ScenarioResult } from "./types";

const root = path.join(process.cwd(), "..");
const dataDir = path.join(process.cwd(), "data");

describe("historyAndEval", () => {
  const snapshot = JSON.parse(
    readFileSync(path.join(dataDir, "scenario_congelato_18-10-2026.json"), "utf8"),
  ) as ScenarioResult;

  it("parseHistory vs Python", () => {
    const csv = readFileSync(
      path.join(root, "storico_iscritti_TEMPLATE.csv"),
      "utf8",
    );
    const ts = parseHistory(csv, snapshot);
    execSync(
      `python modello_fn_v3_2.py --storico storico_iscritti_TEMPLATE.csv --output _storico_py_test.json`,
      { cwd: root },
    );
    const py = (
      JSON.parse(
        readFileSync(path.join(root, "_storico_py_test.json"), "utf8"),
      ) as { monitoraggio_iscritti: typeof ts }
    ).monitoraggio_iscritti;
    expect(ts.length).toBe(py.length);
    for (let i = 0; i < ts.length; i++) {
      if (ts[i].H != null) expect(ts[i].H).toBeCloseTo(py[i].H!, 10);
    }
  });

  it("evaluatePostVoteWithPoll vs Python + copertura forbice", () => {
    const lines = ["regione,voti_validi,voti_fn"];
    for (const r of REGIONS) lines.push(`${r},100000,7200`);
    const csv = lines.join("\n");
    const ts = evaluatePostVoteWithPoll(snapshot, csv, DEFAULT_POLL_CONFIG);

    writeFileSync(path.join(root, "_esiti_test.csv"), csv, "utf8");
    execSync(
      `python modello_fn_v3_2.py --snapshot scenario_congelato_18-10-2026.json --esiti _esiti_test.csv --output _validazione_py.json`,
      { cwd: root },
    );
    const py = JSON.parse(
      readFileSync(path.join(root, "_validazione_py.json"), "utf8"),
    ) as ScenarioResult;
    const pv = py.validazione_predittiva as Record<string, number>;

    expect(ts.validazione_predittiva.mae_punti_scenario).toBeCloseTo(
      pv.mae_punti_scenario,
      8,
    );
    expect(
      ts.validazione_predittiva.copertura_forbice_sondaggio,
    ).toBeGreaterThanOrEqual(0);
    expect(
      ts.validazione_predittiva.copertura_forbice_sondaggio,
    ).toBeLessThanOrEqual(1);
  });
});

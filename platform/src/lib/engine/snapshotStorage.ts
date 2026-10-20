import type { SnapshotParams } from "./snapshotDiff";
import type { ScenarioResult } from "./types";
import { computeScenarioSha256 } from "./snapshotDiff";

export type LocalSnapshotRecord = {
  id: string;
  name: string;
  notes?: string;
  isOfficialBaseline: boolean;
  sha256Hash: string;
  params: SnapshotParams;
  scenarioData: ScenarioResult;
  createdBy: string;
  createdAt: string;
};

const KEY = "fn_v32_snapshots";

export function loadLocalSnapshots(): LocalSnapshotRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalSnapshotRecord[];
  } catch {
    return [];
  }
}

export function saveLocalSnapshot(
  input: Omit<LocalSnapshotRecord, "id" | "sha256Hash" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): LocalSnapshotRecord {
  const record: LocalSnapshotRecord = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    notes: input.notes,
    isOfficialBaseline: input.isOfficialBaseline ?? false,
    sha256Hash: computeScenarioSha256(input.scenarioData),
    params: input.params,
    scenarioData: input.scenarioData,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const list = loadLocalSnapshots().filter((s) => s.id !== record.id);
  list.unshift(record);
  localStorage.setItem(KEY, JSON.stringify(list));
  return record;
}

export function deleteLocalSnapshot(id: string): boolean {
  const list = loadLocalSnapshots();
  const target = list.find((s) => s.id === id);
  if (!target || target.isOfficialBaseline) return false;
  localStorage.setItem(KEY, JSON.stringify(list.filter((s) => s.id !== id)));
  return true;
}

export function downloadSnapshotJson(record: LocalSnapshotRecord): void {
  const blob = new Blob([JSON.stringify(record, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fn_snapshot_${record.name.replace(/\s+/g, "_").slice(0, 40)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

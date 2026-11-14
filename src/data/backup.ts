import { database } from "./database";

const STORES = ["appState", "plans", "concepts", "reviews", "errors", "blocks", "learningSessions"] as const;
type StoreName = typeof STORES[number];
type BackupData = Record<StoreName, Array<Record<string, unknown>>>;
export interface BackupSummary {
  exportedAt: number;
  counts: Record<StoreName, number>;
  data: BackupData;
}
function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function hasKey(store: StoreName, value: Record<string, unknown>) {
  return typeof value[store === "appState" ? "key" : "id"] === "string" && String(value[store === "appState" ? "key" : "id"]).length > 0;
}
export async function createBackup(): Promise<string> {
  const db = await database();
  const entries = await Promise.all(STORES.map(store => db.getAll(store)));
  const data = Object.fromEntries(STORES.map((store, index) => [store, entries[index]])) as unknown as BackupData;
  return JSON.stringify({ format: "ritmo-backup-v1", exportedAt: Date.now(), data }, null, 2);
}
export function inspectBackup(raw: string): BackupSummary {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("O arquivo não contém JSON válido."); }
  const root = object(parsed);
  if (!root || root.format !== "ritmo-backup-v1") throw new Error("Formato incompatível. Use um backup criado pelo Ritmo 8.");
  const source = object(root.data);
  if (!source) throw new Error("O backup não contém a seção de dados.");
  const data = {} as BackupData;
  for (const store of STORES) {
    const rows = source[store];
    if (!Array.isArray(rows)) throw new Error(`O backup não contém a lista “${store}”.`);
    const normalized = rows.map((value, index) => {
      const row = object(value);
      if (!row || !hasKey(store, row)) throw new Error(`Registro ${index + 1} inválido na lista “${store}”.`);
      return row;
    });
    data[store] = normalized;
  }
  return {
    exportedAt: Number(root.exportedAt ?? 0),
    counts: Object.fromEntries(STORES.map(store => [store, data[store].length])) as Record<StoreName, number>,
    data,
  };
}
export async function restoreBackup(summary: BackupSummary, mode: "merge" | "replace") {
  const db = await database();
  const tx = db.transaction([...STORES], "readwrite");
  if (mode === "replace") {
    for (const store of STORES) await tx.objectStore(store).clear();
  }
  for (const store of STORES) {
    for (const row of summary.data[store]) {
      await tx.objectStore(store).put(row as never);
    }
  }
  await tx.done;
  return summary.counts;
}

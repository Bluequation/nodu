import { describe, expect, it } from "vitest";
import { inspectBackup } from "./backup";

const emptyData = {
  appState: [], plans: [], concepts: [], reviews: [], errors: [], blocks: [], learningSessions: [],
};
describe("backup do Ritmo 8", () => {
  it("valida o formato e informa as contagens", () => {
    const raw = JSON.stringify({ format: "ritmo-backup-v1", exportedAt: 123, data: { ...emptyData, concepts: [{ id: "c1" }] } });
    const backup = inspectBackup(raw);
    expect(backup.counts.concepts).toBe(1);
    expect(backup.exportedAt).toBe(123);
  });
  it("rejeita formato incompatível", () => {
    expect(() => inspectBackup(JSON.stringify({ format: "ritmo-v7", data: emptyData }))).toThrow("incompatível");
  });
  it("rejeita registro sem identificador estável", () => {
    expect(() => inspectBackup(JSON.stringify({ format: "ritmo-backup-v1", data: { ...emptyData, concepts: [{ topic: "Sem ID" }] } }))).toThrow("inválido");
  });
});

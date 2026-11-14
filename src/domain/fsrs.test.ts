import { describe, expect, it } from "vitest";
import { emptyFsrsState, rateFsrs, retrievability } from "./fsrs";

const DAY = 86_400_000;
const MINUTE = 60_000;

describe("FSRS-6 do Ritmo", () => {
  it("agenda o primeiro esquecimento em 10 minutos", () => {
    const result = rateFsrs(emptyFsrsState(1_000_000), "again", 1_000_000);
    expect(result.due).toBe(1_000_000 + 10 * MINUTE);
    expect(result.lapses).toBe(1);
    expect(result.reps).toBe(1);
  });

  it("aplica o passo curto de 15 minutos para hard no primeiro contato", () => {
    const result = rateFsrs(emptyFsrsState(1_000_000), "hard", 1_000_000);
    expect(result.delay).toBe(15 * MINUTE);
    expect(result.interval).toBe(0);
  });

  it("calcula estabilidade e dificuldade após uma resposta boa", () => {
    const result = rateFsrs(emptyFsrsState(1_000_000), "good", 1_000_000);
    expect(result.s).toBeGreaterThan(0);
    expect(result.d).toBeGreaterThanOrEqual(1);
    expect(result.d).toBeLessThanOrEqual(10);
    expect(result.due).toBeGreaterThan(1_000_000);
  });

  it("calcula recuperabilidade somente após existir revisão", () => {
    expect(retrievability(emptyFsrsState(1_000_000), 1_000_000)).toBeNull();
    const state = rateFsrs(emptyFsrsState(1_000_000), "good", 1_000_000);
    expect(retrievability(state, state.last)).toBeCloseTo(1, 5);
    expect(retrievability(state, state.last + 10 * DAY)).toBeLessThan(1);
  });

  it("mantém a estabilidade em uma reaprendizagem curta com hard", () => {
    const first = rateFsrs(emptyFsrsState(1_000_000), "good", 1_000_000);
    const second = rateFsrs(first, "hard", 1_000_000 + 20 * MINUTE);
    expect(second.short).toBe(true);
    expect(second.s).toBeGreaterThanOrEqual(first.s);
  });
});

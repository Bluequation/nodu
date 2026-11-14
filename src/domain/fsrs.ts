import type { FsrsState } from "./study";

export const FSRS_WEIGHTS = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194,
  0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
  1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
] as const;
export type FsrsGrade = "again" | "hard" | "good" | "easy";
export interface FsrsResult extends FsrsState {
  delay: number;
  short: boolean;
}
const GRADE_VALUE: Record<FsrsGrade, number> = { again: 1, hard: 2, good: 3, easy: 4 };
const DAY = 86_400_000;
const MINUTE = 60_000;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function retrievability(state: FsrsState | null | undefined, at = Date.now()): number | null {
  if (!state || !state.reps || !state.s) return null;
  const factor = Math.pow(0.9, -1 / FSRS_WEIGHTS[20]) - 1;
  return clamp(
    Math.pow(1 + factor * Math.max(0, (at - state.last) / DAY) / state.s, -FSRS_WEIGHTS[20]),
    0,
    1,
  );
}

/** FSRS-6 implementation and short-step behavior ported from Ritmo 7.1. */
export function rateFsrs(
  state: FsrsState,
  grade: FsrsGrade,
  at = Date.now(),
  desiredRetention = 0.9,
): FsrsResult {
  const g = GRADE_VALUE[grade];
  const w = FSRS_WEIGHTS;
  const short = state.reps > 0 && at - state.last < DAY;
  let stability = state.s || 0;
  let difficulty = state.d || 0;
  const initialDifficulty = (rating: number) => w[4] - Math.exp(w[5] * (rating - 1)) + 1;

  if (!state.reps || !stability) {
    stability = w[g - 1];
    difficulty = clamp(initialDifficulty(g), 1, 10);
  } else {
    const delta = -w[6] * (g - 3);
    const damped = delta * (10 - difficulty) / 9;
    difficulty = clamp(w[7] * initialDifficulty(4) + (1 - w[7]) * (difficulty + damped), 1, 10);
    if (short) {
      let increase = Math.exp(w[17] * (g - 3 + w[18])) * Math.pow(stability, -w[19]);
      if (g >= 2) increase = Math.max(1, increase);
      stability = Math.max(0.01, stability * increase);
    } else {
      const recall = retrievability(state, at) ?? 1;
      if (g === 1) {
        const longTerm = w[11] * Math.pow(state.d, -w[12]) *
          (Math.pow(state.s + 1, w[13]) - 1) * Math.exp((1 - recall) * w[14]);
        const ceiling = state.s / Math.exp(w[17] * w[18]);
        stability = Math.max(0.01, Math.min(longTerm, ceiling));
      } else {
        const penalty = g === 2 ? w[15] : 1;
        const bonus = g === 4 ? w[16] : 1;
        stability = Math.max(0.01, state.s * (
          1 + Math.exp(w[8]) * (11 - state.d) * Math.pow(state.s, -w[9]) *
          (Math.exp((1 - recall) * w[10]) - 1) * penalty * bonus
        ));
      }
    }
  }

  stability = Math.max(0.01, stability);
  const factor = Math.pow(0.9, -1 / w[20]) - 1;
  const idealInterval = stability / factor * (Math.pow(desiredRetention, -1 / w[20]) - 1);
  const interval = clamp(Math.round(idealInterval), 1, 36500);
  let delay = interval * DAY;
  if (g === 1) delay = 10 * MINUTE;
  else if (g === 2 && state.reps === 0) delay = 15 * MINUTE;
  else if (g === 2 && short) delay = 20 * MINUTE;

  return {
    s: stability,
    d: difficulty,
    last: at,
    due: at + delay,
    reps: (state.reps || 0) + 1,
    lapses: (state.lapses || 0) + (g === 1 ? 1 : 0),
    interval: delay < DAY ? 0 : interval,
    delay,
    short,
  };
}

export function emptyFsrsState(now = Date.now()): FsrsState {
  return { s: 0, d: 0, last: 0, due: now - 1, reps: 0, lapses: 0, interval: 0 };
}

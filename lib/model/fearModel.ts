/**
 * Per-patient fear model: ridge regression from the 8 visual dials (count rescaled to 0..1)
 * to observed peak SUDS, trained in the browser after every exposure.
 *
 * It starts from prior weights fitted to the planner's target SUDS, and the patient's ratings
 * pull it away from that prior:   w = (XᵀX + λI)⁻¹ (Xᵀy + λ·w₀)
 * With 1–2 ratings it stays close to the planner's ladder; with more it becomes personal.
 * Exploratory only: a small linear model on a handful of ratings.
 */
import { DIAL_KEYS, norm } from "../pipeline/dials";
import type { DialKey, Dials, Exposure, Ladder, Rung } from "../types";

const PRIOR_LAMBDA = 0.6; // ridge strength when fitting the planner prior
const PATIENT_LAMBDA = 1.5; // pull toward the prior when fitting the patient's ratings

export type FearModel = {
  weights: number[]; // [intercept, ...8 dials]
  prior: number[];
  n: number;
  predict: (d: Dials) => number;
};

const features = (d: Dials) => [1, ...DIAL_KEYS.map((k) => norm(d, k))];

/** Solve A x = b with Gaussian elimination and partial pivoting (A is small and SPD here). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-9;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-9));
}

/** Ridge toward a prior mean: argmin Σ(y − Xw)² + λ‖w − w₀‖² (intercept lightly regularized). */
function ridge(X: number[][], y: number[], lambda: number, w0: number[]): number[] {
  const p = w0.length;
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => (i === j ? (i === 0 ? lambda * 0.01 : lambda) : 0)));
  const b = w0.map((w, i) => (i === 0 ? lambda * 0.01 : lambda) * w);
  for (let r = 0; r < X.length; r++) {
    for (let i = 0; i < p; i++) {
      b[i] += X[r][i] * y[r];
      for (let j = 0; j < p; j++) A[i][j] += X[r][i] * X[r][j];
    }
  }
  return solve(A, b);
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function fitFearModel(rungs: Rung[], exposures: Exposure[]): FearModel {
  const planned = rungs.filter((r) => r.kind !== "variation");
  const zero = new Array(DIAL_KEYS.length + 1).fill(0);
  zero[0] = 50;
  const prior = planned.length
    ? ridge(
        planned.map((r) => features(r.dials)),
        planned.map((r) => r.targetSuds),
        PRIOR_LAMBDA,
        zero,
      )
    : zero;

  const byId = new Map(rungs.map((r) => [r.id, r]));
  const rated = exposures.filter((e) => byId.has(e.rungId) && e.samples.length > 0);
  const weights = rated.length
    ? ridge(
        rated.map((e) => features(byId.get(e.rungId)!.dials)),
        rated.map((e) => e.peakSuds),
        PATIENT_LAMBDA,
        prior,
      )
    : prior;

  return {
    weights,
    prior,
    n: rated.length,
    predict: (d) => clamp(features(d).reduce((t, x, i) => t + x * weights[i], 0)),
  };
}

export function modelForLadder(ladder: Ladder, exposures: Exposure[]): FearModel {
  return fitFearModel(ladder.rungs, exposures);
}

/** Normalized dial importance for the fingerprint radar (positive drive only, max = 1). */
export function fingerprint(model: FearModel): { key: DialKey; weight: number; raw: number }[] {
  const raw = model.weights.slice(1);
  const pos = raw.map((w) => Math.max(0, w));
  const max = Math.max(...pos, 1e-6);
  return DIAL_KEYS.map((key, i) => ({ key, weight: pos[i] / max, raw: raw[i] }));
}

/** One plain-language sentence comparing the two strongest drivers. */
export function fingerprintSentence(model: FearModel, labels: Record<DialKey, { label: string }>): string {
  const fp = fingerprint(model)
    .filter((f) => f.raw > 0.5)
    .sort((a, b) => b.raw - a.raw);
  if (fp.length < 2) return "Not enough ratings yet to say what drives your fear.";
  const [a, b] = fp;
  const ratio = a.raw / Math.max(b.raw, 1e-6);
  const times =
    ratio >= 2.6 ? `about ${Math.round(ratio)} times as much as` : ratio >= 1.6 ? "about twice as much as" : ratio >= 1.15 ? "a little more than" : "about as much as";
  return `${labels[a.key].label} drives your fear ${times} ${labels[b.key].label.toLowerCase()}.`;
}

/** Choose half-step dials on the line between two rungs where the model predicts the midpoint SUDS. */
export function halfStepDials(model: FearModel, lower: Dials, upper: Dials, targetSuds: number): Dials {
  let best = lower;
  let bestErr = Infinity;
  for (let t = 0.1; t <= 0.9001; t += 0.05) {
    const d: Dials = {
      realism: lower.realism + (upper.realism - lower.realism) * t,
      proximity: lower.proximity + (upper.proximity - lower.proximity) * t,
      size: lower.size + (upper.size - lower.size) * t,
      contact: lower.contact + (upper.contact - lower.contact) * t,
      count: Math.round(lower.count + (upper.count - lower.count) * t),
      clarity: lower.clarity + (upper.clarity - lower.clarity) * t,
      color: lower.color + (upper.color - lower.color) * t,
      motion: lower.motion + (upper.motion - lower.motion) * t,
    };
    const err = Math.abs(model.predict(d) - targetSuds);
    if (err < bestErr) {
      bestErr = err;
      best = d;
    }
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { ...best, realism: r2(best.realism), proximity: r2(best.proximity), size: r2(best.size), contact: r2(best.contact), clarity: r2(best.clarity), color: r2(best.color), motion: r2(best.motion) };
}

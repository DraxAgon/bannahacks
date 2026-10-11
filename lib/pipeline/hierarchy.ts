import type { Dials } from "../types";
import { changedDials } from "./dials";

type PlannedRung = { targetSuds: number; dials: Dials };

/** Hierarchy rules from the Therapist Aid guide and the build brief. Returns human-readable problems. */
export function hierarchyProblems(rungs: PlannedRung[], n: number, startWithWord: boolean): string[] {
  const problems: string[] = [];
  if (rungs.length !== n) problems.push(`Expected exactly ${n} rungs, got ${rungs.length}.`);
  if (!rungs.length) return problems;
  const first = rungs[0].targetSuds;
  const last = rungs[rungs.length - 1].targetSuds;
  if (first < 5 || first > 15) problems.push(`Rung 1 targetSuds must be 5 to 15 (got ${first}).`);
  if (last < 85 || last > 95) problems.push(`Top rung targetSuds must be 85 to 95 (got ${last}).`);
  for (let i = 1; i < rungs.length; i++) {
    const a = rungs[i - 1].targetSuds;
    const b = rungs[i].targetSuds;
    if (b <= a) problems.push(`targetSuds must rise: rung ${i + 1} (${b}) is not above rung ${i} (${a}).`);
    if (b - a > 15) problems.push(`Gap between rung ${i} and ${i + 1} is ${b - a}; keep it at 15 or less.`);
  }
  if (startWithWord && rungs[0].dials.realism > 0.1) problems.push("startWithWord is true, so rung 1 must have realism 0.");
  return problems;
}

/** Soft rule: at most two dials change between neighbours. Reported in the inspector, not enforced. */
export function dialChangeWarnings(rungs: PlannedRung[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < rungs.length; i++) {
    const changed = changedDials(rungs[i - 1].dials, rungs[i].dials);
    if (changed.length > 2) out.push(`Rungs ${i}→${i + 1} change ${changed.length} dials (${changed.join(", ")}).`);
  }
  return out;
}

/** Deterministic repair used only if the planner still breaks the SUDS rules after its retry. */
export function respaceSuds(n: number): number[] {
  const lo = n <= 6 ? 15 : 10;
  const hi = n <= 6 ? 85 : 90;
  return Array.from({ length: n }, (_, i) => Math.round(lo + ((hi - lo) * i) / Math.max(1, n - 1)));
}

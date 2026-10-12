import { mainRungs } from "./pipeline/buildLadder";
import type { Exposure, Ladder, ProgressMode, Rung, Session } from "./types";

export type NextAction = "climb" | "repeat" | "variation" | "halfstep" | "end";

export type NextStep = {
  primary: NextAction;
  reason: string;
  criterionMet: boolean;
  offerHalfStep: boolean;
  nextRung?: Rung;
};

/** Progress rule for the chosen mode (therapist setting). */
export function criterionMet(e: Exposure, mode: ProgressMode): boolean {
  if (mode === "habituation") return e.endSuds <= e.peakSuds / 2 || e.endSuds <= 30;
  return e.happened !== "yes";
}

/** Half-step trigger: peak 70 or more and end SUDS still above 50. */
export const stuck = (e: Exposure) => e.peakSuds >= 70 && e.endSuds > 50;

export function nextStep(ladder: Ladder, rung: Rung, e: Exposure): NextStep {
  const main = mainRungs(ladder).filter((r) => r.status === "ready");
  const anchorId = rung.kind === "variation" ? rung.parentId : rung.id;
  const pos = main.findIndex((r) => r.id === anchorId);
  const nextRung = pos >= 0 ? main[pos + 1] : undefined;
  const met = criterionMet(e, ladder.settings.mode);
  const offerHalfStep = stuck(e);

  if (offerHalfStep) {
    return {
      primary: "halfstep",
      reason: "That was a lot. A smaller step in between can help.",
      criterionMet: met,
      offerHalfStep,
      nextRung,
    };
  }
  if (met) {
    return {
      primary: nextRung ? "climb" : "variation",
      reason: nextRung ? "Ready for the next one when you are." : "That was the top step.",
      criterionMet: met,
      offerHalfStep,
      nextRung,
    };
  }
  return {
    primary: "repeat",
    reason: "Another look at this step usually helps.",
    criterionMet: met,
    offerHalfStep,
    nextRung,
  };
}

/** Suggested starting rung: the lowest ready rung whose criterion hasn't been met yet. */
export function suggestedStart(ladder: Ladder, sessions: Session[]): Rung | undefined {
  const main = mainRungs(ladder).filter((r) => r.status === "ready" && r.image);
  const done = new Set(
    sessions.flatMap((s) => s.exposures.filter((e) => criterionMet(e, ladder.settings.mode)).map((e) => e.rungId)),
  );
  return main.find((r) => !done.has(r.id)) ?? main[0];
}

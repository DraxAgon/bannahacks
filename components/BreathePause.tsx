"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/** Pause overlay: a slowly expanding circle, 4 seconds in, 6 out. Pausing never counts as failure. */
export function BreathePause({ onReturn, onEnd }: { onReturn: () => void; onEnd: () => void }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const cycle = (p: "in" | "out") => {
      setPhase(p);
      t = setTimeout(() => cycle(p === "in" ? "out" : "in"), p === "in" ? 4000 : 6000);
    };
    cycle("in");
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onReturn();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onReturn]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#121614]/97 px-6 text-center"
      role="dialog"
      aria-modal="true"
      aria-label="Paused. Breathe."
    >
      <div className="relative grid h-64 w-64 place-items-center">
        <motion.div
          className="absolute inset-0 rounded-full border border-[#8DB9A7]/40 bg-[#22302A]"
          animate={
            reduce
              ? { opacity: phase === "in" ? 1 : 0.5 }
              : { scale: phase === "in" ? 1 : 0.55, opacity: phase === "in" ? 1 : 0.7 }
          }
          initial={reduce ? { opacity: 0.5 } : { scale: 0.55, opacity: 0.7 }}
          transition={{ duration: phase === "in" ? 4 : 6, ease: "easeInOut" }}
        />
        <p className="relative font-display text-[28px] text-[#EDE7DA]" aria-live="polite">
          {phase === "in" ? "Breathe in" : "Breathe out"}
        </p>
      </div>
      <p className="mt-8 max-w-sm text-[16px] text-[#9A9384]">
        Pausing is part of the work, not a failure. Take as long as you need.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          autoFocus
          onClick={onReturn}
          className="min-h-12 rounded-full bg-[#8DB9A7] px-6 text-[16px] font-medium text-[#121614]"
        >
          Return when ready
        </button>
        <button
          type="button"
          onClick={onEnd}
          className="min-h-12 rounded-full border border-[#2A332F] px-6 text-[16px] text-[#EDE7DA] hover:border-[#8DB9A7]"
        >
          End session
        </button>
      </div>
    </div>
  );
}

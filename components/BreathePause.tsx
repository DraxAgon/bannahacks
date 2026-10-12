"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "./ui";

/** Pause: a thin ring that grows for 4 seconds and settles for 6. Pausing never counts against anyone. */
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

  const inhale = phase === "in";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg px-4 text-center text-ink"
      role="dialog"
      aria-modal="true"
      aria-label="Paused"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="relative grid h-[min(64vw,260px)] w-[min(64vw,260px)] place-items-center">
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full border-[1.5px] border-ink"
          initial={reduce ? { opacity: 0.35 } : { scale: 0.62, opacity: 0.55 }}
          animate={
            reduce
              ? { opacity: inhale ? 0.9 : 0.35 }
              : { scale: inhale ? 1 : 0.62, opacity: inhale ? 0.9 : 0.55 }
          }
          transition={{ duration: inhale ? 4 : 6, ease: "easeInOut" }}
        />
        <p className="relative text-[22px] font-medium tracking-tight" aria-live="polite">
          {inhale ? "Breathe in" : "Breathe out"}
        </p>
      </div>
      <div className="mt-14 flex w-full max-w-xs flex-col gap-2">
        <Button autoFocus onClick={onReturn}>
          I&rsquo;m ready
        </Button>
        <Button variant="ghost" onClick={onEnd}>
          End session
        </Button>
      </div>
    </motion.div>
  );
}

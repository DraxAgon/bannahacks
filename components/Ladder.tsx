"use client";

import { AlertCircle, ChevronRight, Layers, Sprout } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { pct, rampColor } from "@/lib/format";
import { mainRungs, variationsOf } from "@/lib/pipeline/buildLadder";
import type { Ladder as LadderT, Rung } from "@/lib/types";
import { RungImage } from "./RungImage";

export function SudsChip({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 font-mono text-[12px] text-ink ${className}`}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: rampColor(value) }} aria-hidden />
      {label} {Math.round(value)}
    </span>
  );
}

export function CriticBadges({ rung }: { rung: Rung }) {
  const c = rung.critique;
  if (!c) return null;
  const idLow = c.identityMatch < 0.6 && rung.dials.realism >= 0.125;
  return (
    <>
      <span
        className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 font-mono text-[12px] text-muted"
        title="Vision critic: identity match with the anchor"
      >
        {idLow ? "△ " : "✓ "}identity {pct(c.identityMatch)}
      </span>
      <SudsChip label="est." value={c.intensity} className="text-muted" />
    </>
  );
}

function RungCard({ rung, variations, onOpen }: { rung: Rung; variations: number; onOpen: () => void }) {
  return (
    <div className="relative grid grid-cols-[2.25rem_minmax(0,88px)_1fr] items-center gap-3 rounded-[12px] border border-line bg-surface p-3 shadow-[var(--shadow)] sm:grid-cols-[3.25rem_120px_1fr_auto] sm:gap-5 sm:p-4">
      <span className="font-display text-center text-[34px] leading-none text-primary sm:text-[48px]" aria-hidden>
        {rung.index}
      </span>
      <div className="relative z-10 w-full">
        <RungImage rung={rung} size="sm" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {rung.kind === "half-step" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[12px] text-primary">
              <Sprout className="h-3 w-3" aria-hidden /> Half-step
            </span>
          )}
          {variations > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[12px] text-primary">
              <Layers className="h-3 w-3" aria-hidden /> +{variations} variation{variations > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="mt-1 block text-left text-[16px] font-medium leading-snug text-ink after:absolute after:inset-0 after:content-[''] hover:text-primary sm:text-[17px]"
        >
          <span className="sr-only">Rung {rung.index}: </span>
          {rung.title}
        </button>
        <div className="relative z-10 mt-2 flex flex-wrap items-center gap-1.5 pointer-events-none">
          <SudsChip label="target" value={rung.targetSuds} />
          <CriticBadges rung={rung} />
        </div>
        {rung.status === "error" && (
          <p className="mt-2 flex items-start gap-1.5 text-[13px] text-error">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {rung.error}
          </p>
        )}
      </div>
      <ChevronRight className="hidden h-5 w-5 text-muted sm:block" aria-hidden />
    </div>
  );
}

/** Two thin rails with rung cards between them, rung 1 at the bottom. */
export function Ladder({ ladder, onOpen }: { ladder: LadderT; onOpen: (id: string) => void }) {
  const reduce = useReducedMotion();
  const rungs = [...mainRungs(ladder)].reverse();
  return (
    <div className="relative px-3 sm:px-6">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-full bg-line sm:left-1" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[3px] rounded-full bg-line sm:right-1" aria-hidden />
      <ol className="space-y-3 py-3" aria-label="Exposure ladder, top rung first">
        <AnimatePresence initial={false}>
          {rungs.map((r) => (
            <motion.li
              key={r.id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: -28, height: 0 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <RungCard rung={r} variations={variationsOf(ladder, r.id).length} onOpen={() => onOpen(r.id)} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

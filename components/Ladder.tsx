"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { mainRungs, variationsOf } from "@/lib/pipeline/buildLadder";
import type { Ladder as LadderT, Rung } from "@/lib/types";
import { RungImage } from "./RungImage";

const EASE = [0.22, 1, 0.36, 1] as const;
// Inline so the global :focus-visible radius doesn't square off the tile's focus ring.
const TILE_RADIUS = { borderRadius: 18 };

function motionFor(i: number, reduce: boolean | null) {
  if (reduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0.15 } },
      transition: { duration: 0.2 },
    };
  }
  return {
    layout: true,
    initial: { opacity: 0, scale: 0.96, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, transition: { duration: 0.2, ease: EASE } },
    transition: {
      duration: 0.5,
      ease: EASE,
      delay: Math.min(i, 12) * 0.03,
      layout: { duration: 0.55, ease: EASE },
    },
  };
}

function Tile({
  rung,
  variations,
  live,
  tapped,
  onTap,
  onOpen,
  onRetry,
}: {
  rung: Rung;
  variations: number;
  live: boolean;
  tapped: boolean;
  onTap: () => void;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const [hover, setHover] = useState(false);
  const errored = rung.status === "error";
  const lookable = Boolean(rung.image) && !errored;
  const shown = hover || tapped;

  return (
    <div
      data-tile={rung.id}
      className="relative"
      onPointerEnter={(e) => e.pointerType !== "touch" && setHover(true)}
      onPointerLeave={(e) => e.pointerType !== "touch" && setHover(false)}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left" style={TILE_RADIUS}>
        {errored ? (
          <div className="aspect-square w-full rounded-2xl bg-subtle" />
        ) : (
          <RungImage rung={rung} revealed={shown} hint={lookable ? "Tap to look" : undefined} />
        )}
        <span className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-faint">
          <span className="tabular">Step {rung.index}</span>
          {rung.kind === "half-step" && (
            <span className="rounded-full bg-subtle px-2 py-px text-[12px] font-medium text-muted">Smaller step</span>
          )}
          {variations > 0 && (
            <span className="tabular">
              +{variations} variation{variations > 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[15px] font-medium tracking-[-0.01em] text-ink">{rung.title}</span>
        <span className="mt-2.5 block h-[2px] w-full overflow-hidden rounded-full bg-subtle" aria-hidden>
          <span
            className="block h-full rounded-full bg-ink/30 transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(2, Math.min(100, rung.targetSuds))}%` }}
          />
        </span>
        <span className="sr-only">Planned intensity {rung.targetSuds} out of 100.</span>
      </button>

      {lookable && (
        // Covers the image while it is blurred. Once revealed it lets clicks through to open the step.
        <button
          type="button"
          onClick={onTap}
          aria-pressed={shown}
          aria-label={shown ? `Hide step ${rung.index}` : `Look at step ${rung.index}`}
          className={`absolute inset-x-0 top-0 aspect-square w-full ${shown ? "pointer-events-none" : "cursor-pointer"}`}
          style={TILE_RADIUS}
        />
      )}

      {errored && (
        <div className="pointer-events-none absolute inset-x-0 top-0 grid aspect-square w-full place-items-center p-3 text-center">
          <div>
            <p className="text-[13px] text-muted">Couldn&rsquo;t draw this one</p>
            {live && (
              <button
                type="button"
                onClick={onRetry}
                className="pointer-events-auto mt-2.5 h-9 rounded-full bg-bg px-4 text-[13px] font-medium text-ink transition-colors duration-150 hover:bg-line"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** The steps as a calm grid, gentlest first. New steps (a live half-step) slide into place. */
export function Ladder({
  ladder,
  live,
  placeholders = 0,
  onOpen,
  onRetry,
}: {
  ladder: LadderT;
  live: boolean;
  /** Skeleton tiles to show while the plan is still being written. */
  placeholders?: number;
  onOpen: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const rungs = mainRungs(ladder);
  const [tapped, setTapped] = useState<string | null>(null);

  // A tap reveals one step at a time; tapping anywhere else blurs it again.
  useEffect(() => {
    if (!tapped) return;
    const onDown = (e: PointerEvent) => {
      const tile = e.target instanceof Element ? e.target.closest("[data-tile]") : null;
      if (tile?.getAttribute("data-tile") !== tapped) setTapped(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [tapped]);

  return (
    <ol
      className="relative grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-3"
      aria-label="Steps, gentlest first"
    >
      <AnimatePresence mode="popLayout">
        {rungs.length === 0
          ? Array.from({ length: placeholders }, (_, i) => (
              <motion.li key={`placeholder-${i}`} {...motionFor(i, reduce)} aria-hidden>
                <div className="loading-sheen aspect-square w-full rounded-2xl" />
                <div className="mt-3 h-3 w-12 rounded-full bg-subtle" />
                <div className="mt-2 h-3.5 w-3/4 rounded-full bg-subtle" />
              </motion.li>
            ))
          : rungs.map((r, i) => (
              <motion.li key={r.id} {...motionFor(i, reduce)}>
                <Tile
                  rung={r}
                  variations={variationsOf(ladder, r.id).length}
                  live={live}
                  tapped={tapped === r.id}
                  onTap={() => setTapped((cur) => (cur === r.id ? null : r.id))}
                  onOpen={() => {
                    setTapped(null);
                    onOpen(r.id);
                  }}
                  onRetry={() => onRetry(r.id)}
                />
              </motion.li>
            ))}
      </AnimatePresence>
    </ol>
  );
}

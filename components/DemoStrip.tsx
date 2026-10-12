"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { fetchDemoLadder } from "@/lib/demo";
import type { Ladder, Rung } from "@/lib/types";
import { veilFor } from "@/lib/format";
import { AiLabel } from "./ui";

const STEPS = 9;

// Each tile sits one --step higher than the one before it, so the row climbs to the right.
// Mobile: a gentle climb inside a snap-scrolling strip. From 768px: nine columns climbing about one tile.
const listClass = [
  "[--step:5px] md:[--step:clamp(8px,1.25vw,14px)]",
  "pt-[calc(var(--step)*8)]",
  "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:scroll-px-8 sm:px-8",
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  "md:mx-auto md:grid md:max-w-[1064px] md:grid-cols-9 md:gap-2 md:overflow-visible md:px-0 md:pb-0 lg:gap-3",
].join(" ");

const tileClass = "w-[132px] shrink-0 snap-start translate-y-[calc(var(--i)*var(--step)*-1)] md:w-auto md:min-w-0";

const climb = (i: number) => ({ "--i": i }) as CSSProperties;

/** Landing signature: the nine demo spider images, blurred until the visitor chooses to look. */
export function DemoStrip() {
  const [ladder, setLadder] = useState<Ladder | null | undefined>(undefined);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchDemoLadder("spiders").then((l) => {
      if (alive) setLadder(l);
    });
    return () => {
      alive = false;
    };
  }, []);

  const rungs = (ladder?.rungs ?? []).filter((r) => r.kind === "planned" && r.image).slice(0, STEPS);
  const ready = rungs.length > 0;

  return (
    <div>
      <ol
        aria-label="Demo ladder, from a word on a card to a spider on an open hand"
        aria-busy={!ready}
        className={listClass}
      >
        {ready
          ? rungs.map((r, i) => (
              <Step
                key={r.id}
                rung={r}
                index={i}
                open={hovered === r.id || pinned === r.id}
                onHover={(on) => setHovered((cur) => (on ? r.id : cur === r.id ? null : cur))}
                onTap={() => setPinned((cur) => (cur === r.id ? null : r.id))}
              />
            ))
          : Array.from({ length: STEPS }, (_, i) => (
              <li key={i} aria-hidden className={tileClass} style={climb(i)}>
                <div className="loading-sheen aspect-square rounded-2xl" />
                <div className="mt-2 h-[18px]" />
              </li>
            ))}
      </ol>

      <p
        aria-hidden={!ready}
        className={`mt-5 text-center text-[13px] text-faint transition-opacity duration-300 ease-out ${ready ? "" : "opacity-0"}`}
      >
        <span className="hidden [@media(hover:hover)]:inline">Hover a step to look</span>
        <span className="[@media(hover:hover)]:hidden">Tap a step to look</span>
      </p>
    </div>
  );
}

function Step({
  rung,
  index,
  open,
  onHover,
  onTap,
}: {
  rung: Rung;
  index: number;
  open: boolean;
  onHover: (on: boolean) => void;
  onTap: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const pointer = useRef<string | null>(null);
  const n = index + 1;

  return (
    <li className={tileClass} style={climb(index)}>
      <button
        type="button"
        aria-label={`Step ${n}, ${rung.title}. ${open ? "Showing" : "Blurred"}.`}
        className="relative block aspect-square w-full cursor-pointer overflow-hidden rounded-2xl! bg-subtle"
        onPointerDown={(e) => {
          pointer.current = e.pointerType;
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") onHover(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") onHover(false);
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) onHover(true);
        }}
        onBlur={() => onHover(false)}
        onClick={() => {
          // Mouse users look by hovering and keyboard users by focusing; a tap toggles.
          if (pointer.current === "touch" || pointer.current === "pen") onTap();
          pointer.current = null;
        }}
      >
        {!loaded && <span aria-hidden className="loading-sheen absolute inset-0" />}
        <span
          aria-hidden
          className={`absolute inset-0 ${loaded ? "develop" : "opacity-0"}`}
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <img
            src={rung.image}
            alt=""
            draggable={false}
            onLoad={() => setLoaded(true)}
            className="h-full w-full select-none object-cover transition-[filter,transform] duration-500 ease-out"
            style={{
              filter: open || veilFor(rung.targetSuds) === 0 ? "none" : `blur(${Math.round(veilFor(rung.targetSuds) * 0.6)}px) saturate(0.9)`,
              transform: open || veilFor(rung.targetSuds) === 0 ? "scale(1)" : "scale(1.1)",
            }}
          />
        </span>
        <AiLabel compact className="absolute bottom-1.5 left-1.5 opacity-80" />
      </button>
      <p aria-hidden className="tabular mt-2 text-[12px] leading-[18px] text-faint">
        {n}
      </p>
    </li>
  );
}

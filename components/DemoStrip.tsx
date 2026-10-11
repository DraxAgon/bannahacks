"use client";

import { useEffect, useState } from "react";
import { fetchDemoLadder } from "@/lib/demo";
import type { Ladder } from "@/lib/types";
import { AiLabel } from "./ui";

/** Landing signature: the demo spider ladder, every rung blurred until the visitor chooses to look. */
export function DemoStrip() {
  const [ladder, setLadder] = useState<Ladder | null | undefined>(undefined);
  const [revealed, setRevealed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchDemoLadder("spiders").then((l) => alive && setLadder(l));
    return () => {
      alive = false;
    };
  }, []);

  const rungs = ladder?.rungs.filter((r) => r.image && r.kind === "planned") ?? [];

  return (
    <div className="relative">
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 [scrollbar-width:thin] sm:gap-4"
        role="list"
        aria-label="Demo spider ladder, from the word on a card to a close photograph"
      >
        {ladder === undefined || rungs.length === 0
          ? Array.from({ length: 9 }, (_, i) => (
              <div key={i} role="listitem" className="w-[132px] shrink-0 snap-start sm:w-[150px]">
                <div className="loading-sheen aspect-square rounded-[10px]" />
                <p className="mt-2 font-mono text-[12px] text-muted">
                  {ladder === null ? "Demo ladder not seeded yet" : "Loading"}
                </p>
              </div>
            ))
          : rungs.map((r, i) => {
              const open = revealed === r.id;
              return (
                <div key={r.id} role="listitem" className="w-[132px] shrink-0 snap-start sm:w-[150px]">
                  <button
                    type="button"
                    aria-pressed={open}
                    aria-label={`Rung ${i + 1}: ${r.title}. ${open ? "Showing image" : "Image blurred, press to reveal"}`}
                    onMouseEnter={() => setRevealed(r.id)}
                    onMouseLeave={() => setRevealed((cur) => (cur === r.id ? null : cur))}
                    onFocus={() => setRevealed(r.id)}
                    onBlur={() => setRevealed((cur) => (cur === r.id ? null : cur))}
                    onClick={() => setRevealed((cur) => (cur === r.id ? null : r.id))}
                    className="group relative block aspect-square w-full overflow-hidden rounded-[10px] border border-line bg-primary-soft"
                  >
                    <img
                      src={r.image}
                      alt=""
                      draggable={false}
                      className="h-full w-full object-cover transition-[filter,transform] duration-500 ease-out"
                      style={{ filter: open ? "none" : "blur(18px) saturate(0.6)", transform: open ? "scale(1)" : "scale(1.08)" }}
                    />
                    {!open && (
                      <span className="absolute inset-0 grid place-items-center font-mono text-[11px] uppercase tracking-widest text-ink/70">
                        Hover or tap
                      </span>
                    )}
                    <AiLabel className="absolute bottom-1.5 left-1.5" />
                  </button>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-[22px] leading-none text-primary">{i + 1}</span>
                    <span className="line-clamp-2 text-[13px] leading-snug text-muted">{r.title}</span>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { variationsOf } from "@/lib/pipeline/buildLadder";
import type { Ladder, Rung } from "@/lib/types";
import { RungImage } from "./RungImage";
import { Button } from "./ui";

function metaLine(r: Rung) {
  const parts = [`Planned intensity ${Math.round(r.targetSuds)}`];
  if (r.critique) {
    parts.push(`AI critic ${Math.round(r.critique.intensity)}`);
    // Identity match means nothing for the word-card step.
    if (r.dials.realism >= 0.125) {
      parts.push(`${r.kind === "variation" ? "Same kind" : "Same subject"} ${Math.round(r.critique.identityMatch * 100)}%`);
    }
  }
  return parts.join(" · ");
}

/** Lightbox content for one step: the image, what it shows, and (when live) redraw or add a variation. */
export function RungDrawer({
  ladder,
  rung,
  live,
  onRedraw,
  onVariation,
}: {
  ladder: Ladder;
  rung: Rung;
  live: boolean;
  onRedraw: (id: string) => void;
  onVariation: (parentId: string) => void;
}) {
  const variations = variationsOf(ladder, rung.id);
  const [picked, setPicked] = useState(rung.id);
  // After "New variation", follow the new one as soon as it appears.
  const [followFrom, setFollowFrom] = useState<number | null>(null);

  const following = followFrom !== null && variations.length > followFrom;
  const selectedId = following ? variations[variations.length - 1].id : picked;
  const all = [rung, ...variations];
  const sel = all.find((r) => r.id === selectedId) ?? rung;
  const busy = sel.status === "generating" || sel.status === "pending";

  return (
    <div>
      <div className="p-3 sm:p-4">
        <RungImage key={sel.id} rung={sel} revealed label="full" />
      </div>

      {variations.length > 0 && (
        <div className="-mt-1 flex gap-2.5 overflow-x-auto px-3 py-1.5 sm:px-4" role="group" aria-label="Variations">
          {all.map((r, i) => {
            const active = r.id === sel.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setPicked(r.id);
                  setFollowFrom(null);
                }}
                aria-pressed={active}
                aria-label={i === 0 ? "Original" : `Variation ${i}`}
                className={`w-16 shrink-0 rounded-xl transition-[opacity,box-shadow] duration-150 ease-out ${
                  active ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : "opacity-55 hover:opacity-100"
                }`}
                style={{ borderRadius: 12 }}
              >
                <RungImage rung={r} revealed rounded="rounded-xl" labelClassName="absolute bottom-1 left-1 px-1.5! text-[10px]!" />
              </button>
            );
          })}
        </div>
      )}

      <div className="px-5 pb-7 pt-3 sm:px-7 sm:pb-8">
        <p className="text-[13px] text-faint">
          <span className="tabular">Step {rung.index}</span>
          {rung.kind === "half-step" && " · Smaller step"}
          {sel.kind === "variation" && " · Variation"}
        </p>
        <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-ink">{rung.title}</h2>
        {sel.scene && <p className="mt-2 text-[15px] leading-relaxed text-muted">{sel.scene}</p>}
        <p className="tabular mt-3 text-[13px] text-faint">{metaLine(sel)}</p>
        {sel.status === "error" && <p className="mt-3 text-[14px] text-muted">Couldn&rsquo;t draw this one.</p>}

        {live && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onRedraw(sel.id)} disabled={busy}>
              {busy ? "Drawing…" : "Redraw"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFollowFrom(variations.length);
                onVariation(rung.id);
              }}
            >
              New variation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

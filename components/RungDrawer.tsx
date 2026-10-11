"use client";

import { Layers, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { variationsOf } from "@/lib/pipeline/buildLadder";
import type { Dials, Ladder, Rung } from "@/lib/types";
import { DialEditor } from "./DialEditor";
import { CriticBadges, SudsChip } from "./Ladder";
import { RungImage } from "./RungImage";
import { Button, Eyebrow } from "./ui";

const CONTEXTS = ["", "kitchen", "garden", "bathroom", "living room", "park"];

export function RungDrawer({
  ladder,
  rung,
  live,
  onRegenerate,
  onVariation,
  onDelete,
}: {
  ladder: Ladder;
  rung: Rung;
  live: boolean;
  onRegenerate: (dials: Dials) => void;
  onVariation: (context?: string) => void;
  onDelete: () => void;
}) {
  const [dials, setDials] = useState<Dials>(rung.dials);
  const [context, setContext] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = rung.status === "generating" || rung.status === "pending";
  const variations = variationsOf(ladder, rung.id);
  const edited = JSON.stringify(dials) !== JSON.stringify(rung.dials);

  return (
    <div className="space-y-8">
      <div>
        <RungImage rung={rung} size="lg" revealedDefault />
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <SudsChip label="target" value={rung.targetSuds} />
          <CriticBadges rung={rung} />
        </div>
        {rung.critique?.note && <p className="mt-2 text-[14px] text-muted">Critic: {rung.critique.note}</p>}
        {rung.status === "error" && <p className="mt-2 text-[14px] text-error">{rung.error}</p>}
      </div>

      <section>
        <Eyebrow>Rationale</Eyebrow>
        <p className="mt-2 text-[16px] leading-relaxed text-ink">{rung.rationale}</p>
        <p className="mt-2 text-[14px] text-muted">Scene: {rung.scene}</p>
      </section>

      <section>
        <Eyebrow>Notice prompts (shown during exposure)</Eyebrow>
        <ul className="mt-2 space-y-1.5">
          {rung.noticePrompts.map((p) => (
            <li key={p} className="border-l-2 border-primary/40 pl-3 text-[15px] text-ink">
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <Eyebrow>Dials</Eyebrow>
          {edited && (
            <button type="button" className="min-h-11 text-[13px] text-muted underline underline-offset-4" onClick={() => setDials(rung.dials)}>
              Reset
            </button>
          )}
        </div>
        <div className="mt-3">
          <DialEditor dials={dials} onChange={setDials} compareTo={rung.dials} disabled={busy} />
        </div>
      </section>

      <section className="space-y-3 border-t border-line pt-6">
        {!live && (
          <p className="text-[14px] text-muted">
            Live generation isn&rsquo;t configured on this deployment, so regenerating and variations are off. Everything else
            works.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onRegenerate(dials)} disabled={!live || busy}>
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden />
            {busy ? "Drawing…" : edited ? "Regenerate with these dials" : "Regenerate"}
          </Button>
          {rung.kind !== "variation" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => onVariation(context || undefined)} disabled={!live || busy}>
                <Layers className="h-4 w-4" aria-hidden /> New variation
              </Button>
              <label className="sr-only" htmlFor="ctx">
                Variation setting
              </label>
              <select
                id="ctx"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-11 rounded-full border border-line bg-surface px-3 text-[14px] text-ink"
              >
                {CONTEXTS.map((c) => (
                  <option key={c} value={c}>
                    {c ? `In a ${c}` : "Any setting"}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2 text-[14px]">
            <span>Delete this rung{variations.length ? " and its variations" : ""}?</span>
            <Button variant="secondary" className="border-error text-error" onClick={onDelete}>
              Delete
            </Button>
            <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <Button variant="quiet" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete rung
          </Button>
        )}
      </section>

      {variations.length > 0 && (
        <section>
          <Eyebrow>Variations · same intensity, new individual or setting</Eyebrow>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {variations.map((v) => (
              <div key={v.id}>
                <RungImage rung={v} size="sm" />
                <p className="mt-1.5 line-clamp-2 text-[12px] text-muted">{v.scene}</p>
                {v.critique && (
                  <p className="font-mono text-[11px] text-muted">
                    est. {v.critique.intensity} · kind {Math.round(v.critique.identityMatch * 100)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

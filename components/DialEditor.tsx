"use client";

import { DIAL_KEYS, DIAL_LABELS } from "@/lib/pipeline/dials";
import type { Dials } from "@/lib/types";
import { Range } from "./controls";

export function DialEditor({
  dials,
  onChange,
  disabled,
  compareTo,
}: {
  dials: Dials;
  onChange: (d: Dials) => void;
  disabled?: boolean;
  compareTo?: Dials;
}) {
  return (
    <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {DIAL_KEYS.map((k) => {
        const meta = DIAL_LABELS[k];
        const isCount = k === "count";
        const v = dials[k];
        const changed = compareTo && Math.abs(compareTo[k] - v) > (isCount ? 0 : 0.005);
        return (
          <div key={k} className={disabled ? "opacity-60" : ""}>
            <div className="flex items-baseline justify-between text-[13px]">
              <label htmlFor={`dial-${k}`} className="font-medium text-ink">
                {meta.label}
                {changed && <span className="ml-1.5 text-accent" aria-label="edited">●</span>}
              </label>
              <span className="font-mono text-muted">{isCount ? v : v.toFixed(2)}</span>
            </div>
            <Range
              id={`dial-${k}`}
              label={meta.label}
              value={v}
              min={isCount ? 1 : 0}
              max={isCount ? 6 : 1}
              step={isCount ? 1 : 0.05}
              valueText={isCount ? `${v}` : `${Math.round(v * 100)} percent, ${meta.low} to ${meta.high}`}
              onChange={(nv) => !disabled && onChange({ ...dials, [k]: nv })}
            />
            <div className="flex justify-between font-mono text-[11px] text-muted">
              <span>{meta.low}</span>
              <span>{meta.high}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

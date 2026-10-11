"use client";

import { rampColor } from "@/lib/format";
import { Range } from "./controls";

const ANCHORS: [number, string][] = [
  [0, "Calm"],
  [25, "Mild"],
  [50, "Moderate"],
  [75, "Strong"],
  [100, "Most distress"],
];

export function sudsWord(v: number) {
  return [...ANCHORS].reverse().find(([n]) => v >= n)?.[1] ?? "Calm";
}

/** SUDS 0–100. Arrow keys move by 1, Page Up/Down by 10. */
export function SudsSlider({
  value,
  onChange,
  label = "How distressed do you feel right now?",
  id = "suds",
  pulse = false,
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  id?: string;
  pulse?: boolean;
}) {
  return (
    <div className={`rounded-[14px] border border-line bg-surface px-4 py-3 ${pulse ? "pulse-ring" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[15px] text-ink">
          {label}
        </label>
        <span className="flex items-center gap-2 font-mono text-[15px] text-ink">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: rampColor(value) }} aria-hidden />
          {value}
          <span className="hidden text-[12px] text-muted sm:inline">{sudsWord(value)}</span>
        </span>
      </div>
      <Range
        id={id}
        value={value}
        min={0}
        max={100}
        step={1}
        label={label}
        valueText={`${value} out of 100, ${sudsWord(value)}`}
        onChange={onChange}
      />
      <div className="flex justify-between font-mono text-[11px] text-muted">
        <span>0 calm</span>
        <span>100 most distress</span>
      </div>
    </div>
  );
}

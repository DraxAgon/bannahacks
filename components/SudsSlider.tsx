"use client";

import { Range } from "./controls";

const WORDS: [number, string][] = [
  [80, "Very anxious"],
  [60, "Anxious"],
  [40, "Uneasy"],
  [20, "A little"],
  [0, "Calm"],
];

/** One plain word for a 0 to 100 rating. */
export function sudsWord(v: number) {
  return WORDS.find(([n]) => v >= n)?.[1] ?? "Calm";
}

/** A 0 to 100 feeling rating: a label, a slider, and a word under it. Arrow keys move by 1. */
export function SudsSlider({
  value,
  onChange,
  label = "How do you feel right now?",
  id = "suds",
  pulse = false,
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  id?: string;
  pulse?: boolean;
}) {
  const word = sudsWord(value);
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-center transition-colors duration-500 ease-out ${
        pulse ? "pulse-ring bg-subtle" : "bg-transparent"
      }`}
    >
      <label htmlFor={id} className="block text-[15px] text-ink">
        {label}
      </label>
      <Range
        id={id}
        className="mt-2"
        value={value}
        min={0}
        max={100}
        step={1}
        label={label}
        valueText={`${word}, ${value} out of 100`}
        onChange={onChange}
      />
      <p className="mt-1 text-[15px] font-medium text-ink" aria-hidden>
        {word} <span className="tabular ml-1 font-normal text-faint">{value}</span>
      </p>
    </div>
  );
}

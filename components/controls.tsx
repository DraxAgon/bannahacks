"use client";

import type { ReactNode } from "react";

/** iOS-style segmented control: gray track, the chosen option sits on a white thumb. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[14px] font-medium text-ink">{label}</legend>
      <div className="inline-flex flex-wrap gap-0.5 rounded-full bg-subtle p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={`relative flex h-9 min-w-11 cursor-pointer select-none items-center justify-center rounded-full px-4 text-[14px] font-medium transition-[background-color,color,box-shadow] duration-150 ease-out has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink ${
                active ? "bg-bg text-ink shadow-[0_1px_3px_rgb(0_0_0/0.1)]" : "text-muted hover:text-ink"
              }`}
            >
              <input type="radio" className="sr-only" name={name} checked={active} onChange={() => onChange(o.value)} />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-6">
      <span>
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[14px] text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-7 w-12 rounded-full bg-line transition-colors duration-150 ease-out peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-[transform,background-color] duration-150 ease-out peer-checked:translate-x-5 peer-checked:bg-on-primary" />
      </span>
    </label>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[15px] font-medium text-ink">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-[14px] text-muted">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

/**
 * Soft filled input. The `!` modifiers beat the global `:focus-visible` rule in globals.css,
 * which is unlayered and would otherwise square the corners and add an outline on every click.
 */
export const inputClass =
  "block w-full rounded-2xl! border-0 bg-subtle px-4 py-3.5 text-[16px] leading-normal text-ink outline-none! placeholder:text-faint transition-[background-color,box-shadow] duration-150 ease-out focus:bg-bg focus:shadow-[inset_0_0_0_1.5px_var(--ink)]";

/** Slider with a filled track; arrow keys work natively. */
export function Range({
  id,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  label,
  valueText,
  className = "",
}: {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  valueText?: string;
  className?: string;
}) {
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <input
      id={id}
      type="range"
      className={`range ${className}`}
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      aria-valuetext={valueText}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ["--fill" as string]: `${fill}%` }}
    />
  );
}

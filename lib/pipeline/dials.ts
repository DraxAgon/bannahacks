import type { Dials, DialKey, PostParams } from "../types";

export const DIAL_KEYS: DialKey[] = ["realism", "proximity", "size", "contact", "count", "clarity", "color", "motion"];

export const DIAL_LABELS: Record<DialKey, { label: string; low: string; high: string }> = {
  realism: { label: "Realism", low: "Word", high: "Photo" },
  proximity: { label: "Proximity", low: "Far", high: "Macro" },
  size: { label: "Size in frame", low: "Tiny", high: "Fills frame" },
  contact: { label: "Contact", low: "Contained", high: "On a hand" },
  count: { label: "Count", low: "1", high: "6" },
  clarity: { label: "Clarity", low: "Blurred", high: "Sharp" },
  color: { label: "Colour", low: "Grey", high: "Full" },
  motion: { label: "Motion", low: "Still", high: "Toward you" },
};

/** Normalized 0..1 view of a dial (count rescaled from 1..6). */
export function norm(d: Dials, k: DialKey): number {
  return k === "count" ? (d.count - 1) / 5 : d[k];
}

export function clampDials(d: Dials): Dials {
  const c = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
  return {
    realism: c(d.realism),
    proximity: c(d.proximity),
    size: c(d.size),
    contact: c(d.contact),
    count: Math.min(6, Math.max(1, Math.round(d.count || 1))),
    clarity: c(d.clarity),
    color: c(d.color),
    motion: c(d.motion),
  };
}

export function midDials(a: Dials, b: Dials): Dials {
  const m = (x: number, y: number) => Math.round(((x + y) / 2) * 100) / 100;
  return clampDials({
    realism: m(a.realism, b.realism),
    proximity: m(a.proximity, b.proximity),
    size: m(a.size, b.size),
    contact: m(a.contact, b.contact),
    count: Math.round((a.count + b.count) / 2),
    clarity: m(a.clarity, b.clarity),
    color: m(a.color, b.color),
    motion: m(a.motion, b.motion),
  });
}

/** Dials that changed meaningfully between two rungs. */
export function changedDials(a: Dials, b: Dials, eps = 0.08): DialKey[] {
  return DIAL_KEYS.filter((k) => Math.abs(norm(a, k) - norm(b, k)) > eps);
}

/** Stage 4 parameters: deterministic, measurable intensity steps. */
export function postParams(d: Dials): PostParams {
  const wordCard = d.realism < 0.125;
  return {
    blurSigma: wordCard || d.clarity >= 0.95 ? 0 : Math.round((1 - d.clarity) * 14 * 10) / 10,
    saturation: wordCard ? 1 : Math.round(d.color * 100) / 100,
    vignette: !wordCard && d.proximity < 0.3,
  };
}

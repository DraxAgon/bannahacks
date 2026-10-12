/** Sequential intensity ramp: mist → sage → amber. Never red. */
export function rampColor(suds: number): string {
  const stops = [
    [0, [0xc9, 0xd6, 0xd1]],
    [50, [0x8d, 0xb9, 0xa7]],
    [100, [0xd9, 0x96, 0x3a]],
  ] as const;
  const v = Math.max(0, Math.min(100, suds));
  const i = v <= 50 ? 0 : 1;
  const [a, ca] = stops[i];
  const [b, cb] = stops[i + 1];
  const t = (v - a) / (b - a);
  const c = ca.map((x, k) => Math.round(x + (cb[k] - x) * t));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * How much to blur a step before someone chooses to look, from its planned intensity.
 * Gentle steps (the word, a drawing) stay readable; stronger steps get a heavier veil.
 */
export function veilFor(targetSuds: number): number {
  if (targetSuds <= 30) return 0;
  return Math.round(Math.min(24, 6 + ((targetSuds - 30) / 62) * 18));
}

/** "Closer View Of Its Hairy Legs" -> "Closer view of its hairy legs". */
export function sentenceCase(title: string): string {
  const t = title.trim();
  if (!t) return t;
  const words = t.split(/\s+/);
  const titled = words.filter((w) => /^[A-Z][a-z]/.test(w)).length >= Math.ceil(words.length / 2);
  if (!titled) return t.charAt(0).toUpperCase() + t.slice(1);
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : /^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");
}

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

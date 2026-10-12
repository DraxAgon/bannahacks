"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, Tooltip, type TooltipContentProps } from "recharts";
import { SERIES_A } from "@/lib/chartColors";
import { fingerprint, fingerprintSentence, type FearModel } from "@/lib/model/fearModel";
import { DIAL_LABELS } from "@/lib/pipeline/dials";

const GRID = "#e4e4e7";
const AXIS_TEXT = "#71717a";

type Datum = { dial: string; low: string; high: string; weight: number; points: number };

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

function DialTooltip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as Datum | undefined;
  if (!active || !d) return null;
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5 text-[13px] leading-snug shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
      <p className="font-semibold text-ink">{d.dial}</p>
      <p className="tabular mt-0.5 text-muted">
        {signed(d.points)} points, {d.low} to {d.high}
      </p>
    </div>
  );
}

/** Tracks an element's content width so the radar can size itself to leave room for its labels. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Radar of which visual features push distress up, from the person's own ratings. */
export function FearFingerprint({ model }: { model: FearModel }) {
  const reduce = useReducedMotion();
  const [box, width] = useWidth<HTMLDivElement>();

  const data: Datum[] = fingerprint(model).map((f) => ({
    dial: DIAL_LABELS[f.key].label,
    low: DIAL_LABELS[f.key].low,
    high: DIAL_LABELS[f.key].high,
    weight: Math.round(f.weight * 100) / 100,
    points: Math.round(f.raw),
  }));

  // Leave about 94px either side of the circle for the longest side label ("Size in frame").
  const radius = Math.max(56, Math.min(116, Math.floor(width / 2) - 94));
  const height = radius * 2 + 72;

  return (
    <div>
      <p className="max-w-[36ch] text-[20px] leading-[1.35] tracking-[-0.01em] text-ink">{fingerprintSentence(model, DIAL_LABELS)}</p>
      <p className="tabular mt-2 text-[14px] text-muted">
        Based on {model.n} rating{model.n === 1 ? "" : "s"}
      </p>

      <figure
        ref={box}
        aria-label="Radar chart of how much each visual feature raises distress"
        className="mt-6 print:[&_.recharts-wrapper]:max-w-full print:[&_svg]:h-auto print:[&_svg]:max-w-full"
        style={{ minHeight: height }}
      >
        {width > 0 && (
          <RadarChart width={width} height={height} data={data} outerRadius={radius} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <PolarGrid stroke={GRID} />
            <PolarAngleAxis dataKey="dial" tick={{ fontSize: 12, fill: AXIS_TEXT }} tickLine={false} axisLine={false} />
            <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
            <Tooltip content={DialTooltip} isAnimationActive={false} />
            <Radar
              dataKey="weight"
              name="Influence"
              stroke={SERIES_A}
              strokeWidth={2}
              strokeLinejoin="round"
              fill={SERIES_A}
              fillOpacity={0.08}
              dot={{ r: 3, fill: SERIES_A, strokeWidth: 0 }}
              isAnimationActive={!reduce}
              animationDuration={600}
              animationEasing="ease-out"
            />
          </RadarChart>
        )}
      </figure>

      <div className="sr-only">

        <table>
        <caption>What drives the fear: points of distress each feature adds from its low to its high setting</caption>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Points, low to high</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.dial}>
              <th scope="row">
                {d.dial} ({d.low} to {d.high})
              </th>
              <td>{signed(d.points)}</td>
            </tr>
          ))}
        </tbody>
        </table>

      </div>
    </div>
  );
}

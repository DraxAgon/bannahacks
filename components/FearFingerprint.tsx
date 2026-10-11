"use client";

import { useReducedMotion } from "motion/react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { SERIES_A } from "@/lib/chartColors";
import { fingerprint, fingerprintSentence, type FearModel } from "@/lib/model/fearModel";
import { DIAL_LABELS } from "@/lib/pipeline/dials";

/** Radar of normalized dial weights from the per-patient ridge model. Draws itself on mount. */
export function FearFingerprint({ model }: { model: FearModel }) {
  const reduce = useReducedMotion();
  const data = fingerprint(model).map((f) => ({
    dial: DIAL_LABELS[f.key].label,
    weight: Math.round(f.weight * 100) / 100,
    raw: Math.round(f.raw * 10) / 10,
  }));
  return (
    <div>
      <p className="font-display text-[20px] leading-snug text-ink">{fingerprintSentence(model, DIAL_LABELS)}</p>
      <p className="mt-1 font-mono text-[12px] text-muted">
        Exploratory: based on {model.n} rating{model.n === 1 ? "" : "s"} · ridge regression with a planner prior
      </p>
      <div className="mt-4 h-72 w-full" role="img" aria-label="Fear fingerprint radar: relative influence of each visual dial on this patient's distress">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="var(--line)" />
            <PolarAngleAxis dataKey="dial" tick={{ fontSize: 12, fill: "var(--muted)" }} />
            <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
            <Tooltip
              formatter={(_v, _n, item) => [`${(item?.payload as { raw: number }).raw} SUDS per full dial step`, "Effect"]}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13 }}
            />
            <Radar
              dataKey="weight"
              name="Relative influence"
              stroke={SERIES_A}
              strokeWidth={2}
              fill={SERIES_A}
              fillOpacity={0.18}
              dot={{ r: 4, fill: SERIES_A }}
              isAnimationActive={!reduce}
              animationDuration={1400}
              animationEasing="ease-out"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Dial weights</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.dial}>
              <th scope="row">{d.dial}</th>
              <td>{d.raw}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

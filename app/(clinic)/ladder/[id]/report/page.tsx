"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { FearFingerprint } from "@/components/FearFingerprint";
import { Button, LinkButton } from "@/components/ui";
import { SERIES_A, SERIES_B } from "@/lib/chartColors";
import { useLadder } from "@/lib/live";
import { fitFearModel } from "@/lib/model/fearModel";
import { listSessions } from "@/lib/store";
import type { Rung, Session } from "@/lib/types";

const GRID = "#f0f0f1";
const AXIS_TEXT = "#71717a";
const CURSOR = "#f4f4f5";
const tick = { fontSize: 12, fill: AXIS_TEXT };

const wrap = "mx-auto w-full max-w-[760px] px-4 pb-20 pt-6 sm:px-8 sm:pt-10 print:max-w-none print:px-0 print:pb-0 print:pt-0";
const titleClass = "text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[48px]";

type StepDatum = { id: string; label: string; title: string; note: string; peak: number; end: number };

/**
 * Step labels as a person reads the ladder: planned steps 1, 2, 3…, a smaller step between 2 and 3 is "2½",
 * and variations of step 3 are "3b", "3c". (rung.index is renumbered when a half-step is inserted, so it
 * cannot express "2½" on its own.)
 */
function stepLabels(rungs: Rung[]): Map<string, string> {
  const out = new Map<string, string>();
  let step = 0;
  for (const r of rungs) {
    if (r.kind === "planned") out.set(r.id, String((step += 1)));
    else if (r.kind === "half-step") out.set(r.id, `${step || ""}½`);
  }
  const seen = new Map<string, number>();
  for (const r of rungs) {
    if (r.kind !== "variation") continue;
    const parent = r.parentId ?? "";
    const k = (seen.get(parent) ?? 0) + 1;
    seen.set(parent, k);
    out.set(r.id, `${out.get(parent) ?? r.index}${String.fromCharCode(97 + Math.min(k, 25))}`);
  }
  return out;
}

function fmtDay(iso: string) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />;
}

function StepTooltip({ active, payload }: TooltipContentProps) {
  const d = payload?.[0]?.payload as StepDatum | undefined;
  if (!active || !d) return null;
  return (
    <div className="max-w-[240px] rounded-xl bg-surface px-3 py-2.5 text-[13px] leading-snug shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
      <p className="font-semibold text-ink">
        Step {d.label}
        {d.note && <span className="font-normal text-muted"> · {d.note}</span>}
      </p>
      <p className="mt-0.5 truncate text-muted">{d.title}</p>
      <div className="tabular mt-2 space-y-1">
        <p className="flex items-center gap-2">
          <Swatch color={SERIES_A} />
          <span className="text-muted">Peak</span>
          <span className="ml-auto pl-4 font-medium text-ink">{d.peak}</span>
        </p>
        <p className="flex items-center gap-2">
          <Swatch color={SERIES_B} />
          <span className="text-muted">End</span>
          <span className="ml-auto pl-4 font-medium text-ink">{d.end}</span>
        </p>
      </div>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="print-break mt-16 sm:mt-20 print:mt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const ladder = useLadder(id);
  const reduce = useReducedMotion();
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    listSessions(id).then(setSessions);
  }, [id]);

  const exposures = useMemo(() => sessions?.flatMap((s) => s.exposures) ?? [], [sessions]);
  const model = useMemo(() => (ladder ? fitFearModel(ladder.rungs, exposures) : null), [ladder, exposures]);

  const steps = useMemo<StepDatum[]>(() => {
    if (!ladder) return [];
    const labels = stepLabels(ladder.rungs);
    return ladder.rungs.flatMap((r) => {
      const es = exposures.filter((e) => e.rungId === r.id);
      const last = es[es.length - 1];
      if (!last) return [];
      return [
        {
          id: r.id,
          label: labels.get(r.id) ?? String(r.index),
          title: r.title,
          note: r.kind === "half-step" ? "smaller step" : r.kind === "variation" ? "variation" : "",
          peak: last.peakSuds,
          end: last.endSuds,
        },
      ];
    });
  }, [ladder, exposures]);

  if (ladder === undefined || sessions === null) {
    return (
      <div className={wrap} aria-busy="true">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3, ease: "easeOut" }}
          className="pt-10 text-[15px] text-muted"
        >
          Loading…
        </motion.p>
      </div>
    );
  }

  if (ladder === null) {
    return (
      <div className={wrap}>
        <h1 className={`${titleClass} mt-10`}>Ladder not found.</h1>
        <LinkButton href="/ladders" variant="secondary" className="mt-8">
          Your ladders
        </LinkButton>
      </div>
    );
  }

  const fear = ladder.fear || ladder.subject.name || "Your";
  const hasLooks = exposures.length > 0;

  const sessionCount = sessions.filter((s) => s.exposures.length > 0).length;
  const latest = exposures.reduce((m, e) => {
    const at = e.endedAt ?? e.startedAt;
    return at > m ? at : m;
  }, "");

  return (
    <div className={wrap}>
      <div className="flex min-h-11 items-center justify-between gap-4">
        <Link
          href={`/ladder/${ladder.id}`}
          className="no-print -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-[15px] text-muted transition-colors duration-150 hover:text-ink"
        >
          <span aria-hidden>←</span> {fear} ladder
        </Link>
        <p className="hidden text-[13px] text-muted print:block">{fear} ladder</p>
        {hasLooks && (
          <Button variant="ghost" onClick={() => window.print()} className="no-print -mr-3 px-3!">
            Print
          </Button>
        )}
      </div>

      <h1 className={`${titleClass} mt-8 sm:mt-10`}>Report</h1>

      {!hasLooks ? (
        <div className="mt-10">
          <p className="text-[17px] text-ink">No looks yet.</p>
          <LinkButton href={`/ladder/${ladder.id}/session`} className="mt-6">
            Start a session
          </LinkButton>
        </div>
      ) : (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <p className="tabular mt-3 text-[15px] text-muted">
            {plural(exposures.length, "look")} over {plural(sessionCount, "session")}
            {latest && ` · ${fmtDay(latest)}`}
          </p>


          <Section
            title="Distress per step"
            aside={
              <div className="flex shrink-0 items-center gap-4 text-[13px] text-muted">
                <span className="flex items-center gap-1.5">
                  <Swatch color={SERIES_A} /> Peak
                </span>
                <span className="flex items-center gap-1.5">
                  <Swatch color={SERIES_B} /> End
                </span>
              </div>
            }
          >
            <figure
              aria-label="Bar chart of peak and end distress, 0 to 100, for each step faced"
              className="-ml-1 h-[260px] print:[&_.recharts-wrapper]:max-w-full print:[&_svg]:h-auto print:[&_svg]:max-w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={steps} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barGap={4} barCategoryGap="22%">
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} tickMargin={10} interval={0} />
                  <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={tick} axisLine={false} tickLine={false} tickMargin={4} width={30} />
                  <Tooltip content={StepTooltip} cursor={{ fill: CURSOR }} isAnimationActive={false} />
                  <Bar
                    dataKey="peak"
                    name="Peak"
                    fill={SERIES_A}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={!reduce}
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                  <Bar
                    dataKey="end"
                    name="End"
                    fill={SERIES_B}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={!reduce}
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            </figure>
            <div className="sr-only">
              <table>
              <caption>Distress per step, 0 to 100, from the latest look at each step</caption>
              <thead>
                <tr>
                  <th scope="col">Step</th>
                  <th scope="col">Peak</th>
                  <th scope="col">End</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((d) => (
                  <tr key={d.id}>
                    <th scope="row">
                      {d.label}: {d.title}
                      {d.note && ` (${d.note})`}
                    </th>
                    <td>{d.peak}</td>
                    <td>{d.end}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </Section>

          {model && (
            <Section title="What drives the fear">
              <FearFingerprint model={model} />
            </Section>
          )}

          <p className="mt-16 hidden text-[12px] text-faint print:block sm:mt-20">Exploratory, not a diagnosis. Best reviewed with a therapist.</p>
        </motion.div>
      )}
    </div>
  );
}

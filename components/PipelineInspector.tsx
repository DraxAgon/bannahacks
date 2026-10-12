"use client";

import { ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PLANNER_SYSTEM } from "@/lib/ai/prompts";
import { fmtMs } from "@/lib/format";
import { mainRungs } from "@/lib/pipeline/buildLadder";
import type { Attempt, AttemptStage, Ladder, Rung, RungKind } from "@/lib/types";
import { RevealImage } from "./RungImage";

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

const INK = "#0a0a0a";
const FAINT = "#a1a1aa";
const GRID = "#e4e4e7";
const AXIS = "#71717a";

const STAGE: Record<AttemptStage, string> = {
  plan: "Plan",
  anchor: "Subject",
  rung: "Image",
  critique: "Critic",
  variation: "Variation",
};

const KIND: Record<RungKind, string> = {
  planned: "Step",
  "half-step": "Smaller step",
  variation: "Variation",
};

function Code({ children, max = "max-h-80" }: { children: string; max?: string }) {
  return (
    <pre
      className={`${max} overflow-auto whitespace-pre-wrap break-words rounded-xl bg-subtle p-3.5 text-[12px] leading-relaxed text-ink`}
      style={{ fontFamily: MONO }}
    >
      {children}
    </pre>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 text-[14px] text-muted transition-colors duration-150 hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform duration-200 group-open:rotate-90" aria-hidden />
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function AttemptRow({ a }: { a: Attempt }) {
  const model = a.model ?? (typeof a.params?.model === "string" ? a.params.model : "");
  return (
    <li className="border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
        <span className={`font-medium ${a.ok ? "text-ink" : "text-error"}`}>{a.ok ? "Done" : "Failed"}</span>
        <span className="text-muted">{STAGE[a.stage] ?? a.stage}</span>
        {model && <span className="text-faint">{model}</span>}
        <span className="tabular text-faint">{fmtMs(a.ms)}</span>
        {a.params?.safetyBoost === true && <span className="text-muted">Safety boost</span>}
        {typeof a.params?.intensityHint === "string" && <span className="text-muted">Asked {a.params.intensityHint}</span>}
      </div>
      {a.error && <p className="mt-1.5 text-[13px] text-error">{a.error}</p>}
      {a.critique && (
        <div className="mt-1.5">
          <Disclosure summary="Critic JSON">
            <Code>{JSON.stringify(a.critique, null, 2)}</Code>
          </Disclosure>
        </div>
      )}
    </li>
  );
}

function Attempts({ list }: { list: Attempt[] }) {
  if (list.length === 0) return <p className="text-[14px] text-faint">None yet.</p>;
  return (
    <ul>
      {list.map((a, i) => (
        <AttemptRow key={i} a={a} />
      ))}
    </ul>
  );
}

function IntensityChart({ rungs }: { rungs: Rung[] }) {
  const reduce = useReducedMotion();
  const data = rungs.map((r) => ({
    name: String(r.index),
    target: r.targetSuds,
    estimated: r.critique?.intensity ?? null,
  }));
  return (
    <div>
      <div className="flex items-center gap-5 text-[13px] text-muted" aria-hidden>
        <span className="inline-flex items-center gap-2">
          <span className="block h-[2px] w-5 rounded-full" style={{ background: INK }} />
          AI critic
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="block w-5 border-t-2 border-dashed" style={{ borderColor: FAINT }} />
          Planned
        </span>
      </div>
      <div className="mt-3 h-60 w-full" role="img" aria-label="Planned intensity and AI critic estimate for each step">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: AXIS }}
              axisLine={{ stroke: GRID }}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 12, fill: AXIS }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: GRID }}
              labelFormatter={(l) => `Step ${l}`}
              contentStyle={{
                background: "#ffffff",
                border: "none",
                borderRadius: 12,
                boxShadow: "0 10px 30px -10px rgba(0,0,0,0.2)",
                fontSize: 13,
                color: INK,
              }}
              itemStyle={{ color: INK, padding: 0 }}
              labelStyle={{ color: AXIS, marginBottom: 2 }}
            />
            <Line
              type="monotone"
              dataKey="target"
              name="Planned"
              stroke={FAINT}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 3.5, fill: FAINT, strokeWidth: 0 }}
              isAnimationActive={!reduce}
            />
            <Line
              type="monotone"
              dataKey="estimated"
              name="AI critic"
              stroke={INK}
              strokeWidth={2}
              dot={{ r: 3, fill: INK, strokeWidth: 0 }}
              activeDot={{ r: 4.5, fill: INK, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={!reduce}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type Tab = "overview" | "plan" | "subject" | "steps";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "plan", label: "Plan" },
  { id: "subject", label: "Subject" },
  { id: "steps", label: "Steps" },
];

function Segmented({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const reduce = useReducedMotion();
  return (
    <div role="tablist" aria-label="How it was made" className="flex w-full rounded-full bg-subtle p-1 sm:inline-flex sm:w-auto">
      {TABS.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`panel-${t.id}`}
            onClick={() => onChange(t.id)}
            className={`relative h-9 flex-1 rounded-full px-3.5 text-[14px] font-medium transition-colors duration-150 sm:flex-none sm:px-4 ${
              active ? "text-ink" : "text-muted hover:text-ink"
            }`}
            style={{ borderRadius: 999 }}
          >
            {active && (
              <motion.span
                layoutId="inspector-tab"
                className="absolute inset-0 rounded-full bg-bg shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)]"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Everything the pipeline did for this ladder: plan, subject reference, every prompt, every critic verdict. */
export function PipelineInspector({ ladder }: { ladder: Ladder }) {
  const [tab, setTab] = useState<Tab>("overview");
  const rungs = mainRungs(ladder);

  const stats = useMemo(() => {
    const main = mainRungs(ladder);
    const all = [...(ladder.planAttempts ?? []), ...(ladder.anchorAttempts ?? []), ...ladder.rungs.flatMap((r) => r.attempts)];
    const by = (s: Attempt["stage"]) => all.filter((a) => a.stage === s);
    const avg = (xs: Attempt[]) => (xs.length ? Math.round(xs.reduce((t, a) => t + a.ms, 0) / xs.length) : 0);
    const critiques = all.filter((a) => a.critique);
    const imageCalls =
      by("rung").filter((a) => a.ok).length + by("anchor").filter((a) => a.ok && a.params?.source !== "upload").length;
    const rounds = ladder.rungs.map((r) => r.attempts.filter((a) => a.stage === "rung" && a.ok).length);
    return {
      imageCalls,
      failed: all.filter((a) => !a.ok).length,
      unsafeBlocked: critiques.filter((a) => a.critique?.unsafe).length,
      repairs: rounds.reduce((t, n) => t + Math.max(0, n - 1), 0),
      latency: { plan: avg(by("plan")), anchor: avg(by("anchor")), rung: avg(by("rung")), critique: avg(by("critique")) },
      withinTen: main.filter((r) => r.critique && Math.abs(r.critique.intensity - r.targetSuds) <= 10).length,
      critiqued: main.filter((r) => r.critique).length,
    };
  }, [ladder]);

  const plan = ladder.plan as { warnings?: string[]; retried?: boolean } | undefined;
  const planCalls = ladder.planAttempts?.length ?? 0;

  const pipeline: { name: string; detail: string; ms: number }[] = [
    { name: "Plan", detail: `${planCalls} call${planCalls === 1 ? "" : "s"}${plan?.retried ? ", retried" : ""}`, ms: stats.latency.plan },
    {
      name: "Subject",
      detail: ladder.anchorSource === "upload" ? "From an uploaded photo" : "Generated reference",
      ms: stats.latency.anchor,
    },
    { name: "Draw", detail: `${stats.imageCalls} image${stats.imageCalls === 1 ? "" : "s"}`, ms: stats.latency.rung },
    { name: "Finish", detail: "Blur, saturation, vignette", ms: 0 },
    {
      name: "Critic",
      detail: `${stats.critiqued} checked, ${stats.unsafeBlocked} unsafe blocked`,
      ms: stats.latency.critique,
    },
  ];

  return (
    <div>
      <Segmented value={tab} onChange={setTab} />

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-8">
        {tab === "overview" && (
          <div className="space-y-10">
            <ol className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-5">
              {pipeline.map((p, i) => (
                <li key={p.name} className="border-t border-line pt-3">
                  <p className="text-[15px] font-medium text-ink">
                    <span className="tabular mr-2 text-faint">{i + 1}</span>
                    {p.name}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-muted">{p.detail}</p>
                  {p.ms > 0 && <p className="tabular mt-1 text-[13px] text-faint">Avg {fmtMs(p.ms)}</p>}
                </li>
              ))}
            </ol>

            <Section title="Planned vs AI critic">
              <p className="text-[14px] text-muted">
                {stats.withinTen} of {stats.critiqued} steps landed within 10 points of the plan. {stats.repairs} redrawn
                automatically. {stats.failed} failed call{stats.failed === 1 ? "" : "s"} retried or shown.
              </p>
              <div className="mt-5">
                <IntensityChart rungs={rungs} />
              </div>
            </Section>

            {plan?.warnings && plan.warnings.length > 0 && (
              <Section title="Ladder checks">
                <ul className="list-disc space-y-1 pl-5 text-[14px] text-muted">
                  {plan.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}

        {tab === "plan" && (
          <div className="space-y-10">
            <Section title="Request">
              <Code>{JSON.stringify(ladder.request ?? { description: ladder.description }, null, 2)}</Code>
              <div className="mt-2">
                <Disclosure summary="System prompt">
                  <Code>{PLANNER_SYSTEM}</Code>
                </Disclosure>
              </div>
            </Section>
            <Section title="Attempts">
              <Attempts list={ladder.planAttempts ?? []} />
            </Section>
            <Section title="Planner JSON">
              <Code max="max-h-[28rem]">{JSON.stringify(ladder.plan ?? { subject: ladder.subject }, null, 2)}</Code>
            </Section>
          </div>
        )}

        {tab === "subject" && (
          <div className="grid gap-8 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div className="max-w-[260px]">
              {ladder.anchorImage ? (
                <RevealImage rung={{ image: ladder.anchorImage, status: "ready", title: "Subject reference" }} />
              ) : (
                <div className="aspect-square w-full rounded-2xl bg-subtle" />
              )}
              <p className="mt-3 text-[13px] leading-snug text-faint">The reference for every step. Never shown as a step.</p>
            </div>
            <div className="min-w-0 space-y-10">
              <Section title={ladder.subject.name ? ladder.subject.name[0].toUpperCase() + ladder.subject.name.slice(1) : "Subject"}>
                <p className="text-[15px] leading-relaxed text-muted">{ladder.subject.canonical || "Not chosen yet."}</p>
              </Section>
              <Section title="Attempts">
                {(ladder.anchorAttempts ?? []).length === 0 ? (
                  <p className="text-[14px] text-faint">None yet.</p>
                ) : (
                  <ul className="space-y-6">
                    {(ladder.anchorAttempts ?? []).map((a, i) => (
                      <li key={i}>
                        <ul>
                          <AttemptRow a={a} />
                        </ul>
                        {a.prompt && (
                          <div className="mt-2">
                            <Code>{a.prompt}</Code>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </div>
        )}

        {tab === "steps" && (
          <ol className="border-t border-line">
            {ladder.rungs.map((r) => {
              const prompt = r.prompt ?? r.attempts.find((a) => a.stage === "rung")?.prompt;
              return (
                <li key={r.id} className="border-b border-line">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-start gap-3 py-4 [&::-webkit-details-marker]:hidden">
                      <span className="tabular w-6 shrink-0 pt-px text-[15px] text-faint">{r.index}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-ink">{r.title}</span>
                        <span className="tabular mt-0.5 block text-[13px] text-faint">
                          {KIND[r.kind]} · planned {r.targetSuds}
                          {r.critique
                            ? ` · critic ${r.critique.intensity} · same ${r.kind === "variation" ? "kind" : "subject"} ${Math.round(r.critique.identityMatch * 100)}%`
                            : ""}{" "}
                          · {r.attempts.length} call{r.attempts.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      <ChevronRight
                        className="mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform duration-200 group-open:rotate-90"
                        aria-hidden
                      />
                    </summary>
                    <div className="space-y-8 pb-6 sm:pl-9">
                      <Section title="Image prompt">
                        <Code>{prompt ?? "No prompt yet."}</Code>
                      </Section>
                      <div className="grid gap-8 sm:grid-cols-2">
                        <Section title="Dials">
                          <Code>{JSON.stringify(r.dials, null, 2)}</Code>
                        </Section>
                        <Section title="Finishing (sharp)">
                          <Code>{JSON.stringify(r.post ?? {}, null, 2)}</Code>
                        </Section>
                      </div>
                      <Section title="Every attempt">
                        <Attempts list={r.attempts} />
                      </Section>
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

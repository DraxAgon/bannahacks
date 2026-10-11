"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PLANNER_SYSTEM } from "@/lib/ai/prompts";
import { SERIES_A, SERIES_B } from "@/lib/chartColors";
import { fmtMs } from "@/lib/format";
import { mainRungs } from "@/lib/pipeline/buildLadder";
import type { Attempt, Ladder, Rung } from "@/lib/types";
import { RungImage } from "./RungImage";
import { Eyebrow } from "./ui";

function Pre({ children, max = "max-h-80" }: { children: string; max?: string }) {
  return (
    <pre
      className={`${max} overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-line bg-surface p-3 font-mono text-[12px] leading-relaxed text-ink`}
    >
      {children}
    </pre>
  );
}

function AttemptRow({ a }: { a: Attempt }) {
  return (
    <li className="rounded-[10px] border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px]">
        <span className={a.ok ? "text-primary" : "text-error"}>{a.ok ? "ok" : "failed"}</span>
        <span className="text-ink">{a.stage}</span>
        <span className="text-muted">{a.model ?? String(a.params?.model ?? "")}</span>
        <span className="text-muted">{fmtMs(a.ms)}</span>
        {a.params?.safetyBoost === true && <span className="text-accent">safety-boost</span>}
        {typeof a.params?.intensityHint === "string" && <span className="text-accent">hint: {a.params.intensityHint}</span>}
      </div>
      {a.error && <p className="mt-1.5 font-mono text-[12px] text-error">{a.error}</p>}
      {a.critique && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[13px] text-muted">Critic JSON</summary>
          <div className="mt-2">
            <Pre>{JSON.stringify(a.critique, null, 2)}</Pre>
          </div>
        </details>
      )}
    </li>
  );
}

function IntensityChart({ rungs }: { rungs: Rung[] }) {
  const data = rungs.map((r) => ({
    name: String(r.index),
    target: r.targetSuds,
    estimated: r.critique?.intensity ?? null,
  }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Target versus critic-estimated intensity for each rung">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--line)" label={{ value: "rung", position: "insideBottomRight", offset: -2, fontSize: 11, fill: "var(--muted)" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--line)" />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13 }} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Line type="monotone" dataKey="target" name="Target SUDS" stroke={SERIES_B} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4 }} />
          <Line type="monotone" dataKey="estimated" name="Critic estimate" stroke={SERIES_A} strokeWidth={2} dot={{ r: 4 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type Tab = "overview" | "planner" | "anchor" | "rungs";

export function PipelineInspector({ ladder }: { ladder: Ladder }) {
  const [tab, setTab] = useState<Tab>("overview");
  const rungs = mainRungs(ladder);

  const stats = useMemo(() => {
    const all = [
      ...(ladder.planAttempts ?? []),
      ...(ladder.anchorAttempts ?? []),
      ...ladder.rungs.flatMap((r) => r.attempts),
    ];
    const by = (s: Attempt["stage"]) => all.filter((a) => a.stage === s);
    const avg = (xs: Attempt[]) => (xs.length ? Math.round(xs.reduce((t, a) => t + a.ms, 0) / xs.length) : 0);
    const critiques = all.filter((a) => a.critique);
    const imageCalls = by("rung").filter((a) => a.ok).length + by("anchor").filter((a) => a.ok && a.params?.source !== "upload").length;
    const rounds = ladder.rungs.map((r) => r.attempts.filter((a) => a.stage === "rung" && a.ok).length);
    return {
      calls: all.length,
      imageCalls,
      failed: all.filter((a) => !a.ok).length,
      unsafeBlocked: critiques.filter((a) => a.critique?.unsafe).length,
      repairs: rounds.reduce((t, n) => t + Math.max(0, n - 1), 0),
      latency: { plan: avg(by("plan")), anchor: avg(by("anchor")), rung: avg(by("rung")), critique: avg(by("critique")) },
      withinTen: rungs.filter((r) => r.critique && Math.abs(r.critique.intensity - r.targetSuds) <= 10).length,
      critiqued: rungs.filter((r) => r.critique).length,
    };
  }, [ladder, rungs]);

  const plan = ladder.plan as { warnings?: string[]; retried?: boolean } | undefined;

  return (
    <div>
      <div role="tablist" aria-label="Pipeline stages" className="mb-6 flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
        {(["overview", "planner", "anchor", "rungs"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-10 flex-1 rounded-full px-4 text-[14px] capitalize ${tab === t ? "bg-primary text-surface" : "text-muted hover:text-ink"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-8">
          <ol className="grid gap-px overflow-hidden rounded-[12px] border border-line bg-line text-[13px] sm:grid-cols-5">
            {[
              ["1 · Plan", `${ladder.planAttempts?.length ?? 0} call${ladder.planAttempts?.length === 1 ? "" : "s"}${plan?.retried ? " · retried" : ""}`, stats.latency.plan],
              ["2 · Anchor", ladder.anchorSource === "upload" ? "therapist photo" : "generated", stats.latency.anchor],
              ["3 · Render", `${stats.imageCalls} images`, stats.latency.rung],
              ["4 · Post", "sharp: blur, saturation, vignette", 0],
              ["5 · Critic", `${stats.critiqued} checked · ${stats.unsafeBlocked} unsafe blocked`, stats.latency.critique],
            ].map(([t, d, ms]) => (
              <li key={t as string} className="bg-surface p-3">
                <p className="font-medium text-ink">{t}</p>
                <p className="mt-1 text-muted">{d}</p>
                {Number(ms) > 0 && <p className="mt-1 font-mono text-[12px] text-muted">avg {fmtMs(Number(ms))}</p>}
              </li>
            ))}
          </ol>
          <div>
            <Eyebrow>Target vs estimated intensity</Eyebrow>
            <p className="mt-1 text-[14px] text-muted">
              {stats.withinTen} of {stats.critiqued} rungs land within 10 SUDS of target. Auto-repairs: {stats.repairs}. Failed
              calls retried or surfaced: {stats.failed}.
            </p>
            <div className="mt-4">
              <IntensityChart rungs={rungs} />
            </div>
          </div>
          {plan?.warnings && plan.warnings.length > 0 && (
            <div>
              <Eyebrow>Hierarchy checks</Eyebrow>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-muted">
                {plan.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "planner" && (
        <div className="space-y-6">
          <div>
            <Eyebrow>Request</Eyebrow>
            <div className="mt-2">
              <Pre>{JSON.stringify(ladder.request ?? { description: ladder.description }, null, 2)}</Pre>
            </div>
          </div>
          <details>
            <summary className="cursor-pointer text-[14px] text-muted">System prompt</summary>
            <div className="mt-2">
              <Pre>{PLANNER_SYSTEM}</Pre>
            </div>
          </details>
          <div>
            <Eyebrow>Attempts</Eyebrow>
            <ul className="mt-2 space-y-2">
              {(ladder.planAttempts ?? []).map((a, i) => (
                <AttemptRow key={i} a={a} />
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>Validated planner JSON</Eyebrow>
            <div className="mt-2">
              <Pre max="max-h-[28rem]">{JSON.stringify(ladder.plan ?? { subject: ladder.subject }, null, 2)}</Pre>
            </div>
          </div>
        </div>
      )}

      {tab === "anchor" && (
        <div className="grid gap-6 sm:grid-cols-[240px_1fr]">
          <div>
            {ladder.anchorImage ? (
              <RungImage rung={{ image: ladder.anchorImage, status: "ready", title: "Identity anchor" }} />
            ) : (
              <p className="text-muted">No anchor yet.</p>
            )}
            <p className="mt-2 text-[13px] text-muted">The identity reference for every rung. Never shown to the patient as a rung.</p>
          </div>
          <div className="space-y-4">
            <div>
              <Eyebrow>Subject</Eyebrow>
              <p className="mt-1 text-ink">
                <strong>{ladder.subject.name}</strong> — {ladder.subject.canonical}
              </p>
            </div>
            <div>
              <Eyebrow>Attempts</Eyebrow>
              <ul className="mt-2 space-y-2">
                {(ladder.anchorAttempts ?? []).map((a, i) => (
                  <li key={i}>
                    <AttemptRow a={a} />
                    <div className="mt-2">
                      <Pre>{a.prompt}</Pre>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {tab === "rungs" && (
        <ol className="space-y-4">
          {ladder.rungs.map((r) => (
            <li key={r.id} className="rounded-[12px] border border-line bg-surface/60 p-4">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-[22px] text-primary">{r.index}</span>
                  <span className="font-medium text-ink">{r.title}</span>
                  <span className="font-mono text-[12px] text-muted">
                    {r.kind} · target {r.targetSuds}
                    {r.critique ? ` · est ${r.critique.intensity} · id ${Math.round(r.critique.identityMatch * 100)}%` : ""} ·{" "}
                    {r.attempts.length} calls
                  </span>
                </summary>
                <div className="mt-4 space-y-4">
                  <div>
                    <Eyebrow>Exact image prompt</Eyebrow>
                    <div className="mt-2">
                      <Pre>{r.prompt ?? r.attempts.find((a) => a.stage === "rung")?.prompt ?? "—"}</Pre>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Eyebrow>Dials</Eyebrow>
                      <div className="mt-2">
                        <Pre>{JSON.stringify(r.dials, null, 2)}</Pre>
                      </div>
                    </div>
                    <div>
                      <Eyebrow>Post-processing (sharp)</Eyebrow>
                      <div className="mt-2">
                        <Pre>{JSON.stringify(r.post ?? {}, null, 2)}</Pre>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Eyebrow>Every attempt</Eyebrow>
                    <ul className="mt-2 space-y-2">
                      {r.attempts.map((a, i) => (
                        <AttemptRow key={i} a={a} />
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

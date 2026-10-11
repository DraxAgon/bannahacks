"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FearFingerprint } from "@/components/FearFingerprint";
import { Button, Eyebrow, LinkButton } from "@/components/ui";
import { SERIES_A, SERIES_B } from "@/lib/chartColors";
import { fmtDuration } from "@/lib/format";
import { useLadder } from "@/lib/live";
import { fitFearModel } from "@/lib/model/fearModel";
import { criterionMet } from "@/lib/session";
import { listSessions } from "@/lib/store";
import type { Exposure, Rung, Session } from "@/lib/types";

const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13 };
const axisTick = { fontSize: 12, fill: "var(--muted)" };

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="print-break border-t border-line pt-6">
      <h2 className="font-display text-[24px] leading-tight">{title}</h2>
      {sub && <p className="mt-1 text-[14px] text-muted">{sub}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface p-4">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-[22px] text-ink">{value}</dd>
    </div>
  );
}

function SudsSparkline({ e, rung, n, animate }: { e: Exposure; rung?: Rung; n: number; animate: boolean }) {
  return (
    <figure className="rounded-[12px] border border-line bg-surface p-3">
      <figcaption className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="truncate text-ink">
          #{n} · Rung {rung?.index ?? "?"}
          {rung?.kind === "half-step" ? " (half-step)" : rung?.kind === "variation" ? " (variation)" : ""}
        </span>
        <span className="shrink-0 font-mono text-muted">
          {e.peakSuds}→{e.endSuds}
        </span>
      </figcaption>
      <div className="mt-2 h-28" role="img" aria-label={`SUDS over time for exposure ${n}: peak ${e.peakSuds}, end ${e.endSuds}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={e.samples} margin={{ top: 4, right: 6, bottom: 0, left: -28 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="t" type="number" domain={[0, "dataMax"]} allowDecimals={false} tick={axisTick} stroke="var(--line)" unit="s" />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={axisTick} stroke="var(--line)" />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => `${t} s`} formatter={(v) => [v, "SUDS"]} />
            <Line type="monotone" dataKey="suds" stroke={SERIES_A} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={animate} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
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
  const byId = useMemo(() => new Map(ladder?.rungs.map((r) => [r.id, r]) ?? []), [ladder]);
  const model = useMemo(() => (ladder ? fitFearModel(ladder.rungs, exposures) : null), [ladder, exposures]);

  if (ladder === undefined || sessions === null) {
    return <div className="mx-auto max-w-5xl px-5 py-24 text-muted sm:px-8">Loading report…</div>;
  }
  if (ladder === null) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-24 sm:px-8">
        <h1 className="font-display text-[32px]">Ladder not found.</h1>
        <LinkButton href="/ladders" variant="secondary" className="mt-6">
          My ladders
        </LinkButton>
      </div>
    );
  }

  const rungLabel = (e: Exposure) => `R${byId.get(e.rungId)?.index ?? "?"}`;
  const lookMs = exposures.reduce((t, e) => t + e.lookMs, 0);
  const releases = exposures.reduce((t, e) => t + e.releases, 0);
  const halfSteps = ladder.rungs.filter((r) => r.kind === "half-step").length;
  const variations = ladder.rungs.filter((r) => r.kind === "variation").length;
  const met = exposures.filter((e) => criterionMet(e, ladder.settings.mode)).length;

  // Peak vs end per rung (latest exposure of each rung, in ladder order).
  const perRung = ladder.rungs
    .filter((r) => exposures.some((e) => e.rungId === r.id))
    .map((r) => {
      const es = exposures.filter((e) => e.rungId === r.id);
      const lastE = es[es.length - 1];
      return {
        rung: `R${r.index}${r.kind === "half-step" ? "½" : r.kind === "variation" ? "v" : ""}`,
        title: r.title,
        peak: lastE.peakSuds,
        end: lastE.endSuds,
        lookMs: es.reduce((t, e) => t + e.lookMs, 0),
        releases: es.reduce((t, e) => t + e.releases, 0),
        count: es.length,
      };
    });

  const expectancy = exposures.map((e, i) => ({
    name: `#${i + 1} ${rungLabel(e)}`,
    before: e.likelihood,
    after: e.happened === "yes" ? 100 : e.happened === "partly" ? 50 : 0,
    surprise: e.surprise,
    prediction: e.prediction,
    happened: e.happened,
  }));

  const notes = exposures.filter((e) => e.learned);

  return (
    <div className="mx-auto max-w-5xl px-5 pb-10 pt-10 sm:px-8 sm:pt-14">
      <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/ladder/${ladder.id}`} className="flex min-h-11 items-center gap-2 text-[15px] text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the ladder
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden /> Print or save as PDF
        </Button>
      </div>

      <Eyebrow>Clinician report · {ladder.source === "demo" ? "demo ladder" : "live ladder"}</Eyebrow>
      <h1 className="font-display mt-3 text-[36px] leading-tight sm:text-[46px]">
        Patient {ladder.alias} · {ladder.subject.name || ladder.fear}
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        {sessions.length} session{sessions.length === 1 ? "" : "s"} · {exposures.length} exposure{exposures.length === 1 ? "" : "s"} ·{" "}
        {ladder.settings.mode} mode · {ladder.settings.view === "hold" ? "hold-to-view" : "steady view"} · generated{" "}
        {new Date().toLocaleDateString()}
      </p>

      {exposures.length === 0 ? (
        <div className="mt-10 rounded-[12px] border border-line bg-surface p-6">
          <p className="text-ink">No exposures recorded yet.</p>
          <p className="mt-1 text-[15px] text-muted">Run a session on this ladder and the report fills in here.</p>
          <LinkButton href={`/ladder/${ladder.id}/session`} className="mt-4">
            Start a session
          </LinkButton>
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Exposures" value={String(exposures.length)} />
            <Stat label="Time looked" value={fmtDuration(lookMs)} />
            <Stat label="Releases" value={String(releases)} />
            <Stat label="Criterion met" value={`${met}/${exposures.length}`} />
            <Stat label="Half-steps added" value={String(halfSteps)} />
            <Stat label="Variations added" value={String(variations)} />
          </dl>

          <Section title="SUDS over time" sub="One panel per exposure, in order. Seconds since the exposure began.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {exposures.map((e, i) => (
                <SudsSparkline key={i} e={e} rung={byId.get(e.rungId)} n={i + 1} animate={!reduce} />
              ))}
            </div>
          </Section>

          <div className="grid gap-12 lg:grid-cols-2">
            <Section title="Peak vs end, per rung" sub="Latest exposure on each rung.">
              <div className="h-64" role="img" aria-label="Paired bars of peak and end SUDS per rung">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perRung} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} barGap={2}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="rung" tick={axisTick} stroke="var(--line)" />
                    <YAxis domain={[0, 100]} tick={axisTick} stroke="var(--line)" />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--primary-soft)" }} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="peak" name="Peak SUDS" fill={SERIES_B} radius={[4, 4, 0, 0]} isAnimationActive={!reduce} />
                    <Bar dataKey="end" name="End SUDS" fill={SERIES_A} radius={[4, 4, 0, 0]} isAnimationActive={!reduce} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section title="Expectancy, before vs after" sub="Predicted likelihood vs whether it happened (no = 0, so no green bar · partly = 50 · yes = 100).">
              <div className="h-64" role="img" aria-label="Paired bars of predicted likelihood and outcome per exposure">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expectancy} margin={{ top: 4, right: 8, bottom: 0, left: -20 }} barGap={2}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="name" tick={axisTick} stroke="var(--line)" />
                    <YAxis domain={[0, 100]} tick={axisTick} stroke="var(--line)" />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--primary-soft)" }} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="before" name="Predicted likelihood %" fill={SERIES_B} radius={[4, 4, 0, 0]} isAnimationActive={!reduce} />
                    <Bar dataKey="after" name="Happened" fill={SERIES_A} radius={[4, 4, 0, 0]} isAnimationActive={!reduce} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>

          <Section title="Looking time and releases" sub="Releases are moments the patient let go in hold-to-view: an avoidance signal to discuss.">
            <div className="overflow-x-auto rounded-[12px] border border-line bg-surface">
              <table className="w-full text-left text-[14px]">
                <thead className="font-mono text-[12px] uppercase tracking-wider text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2.5 font-normal">Rung</th>
                    <th className="px-4 py-2.5 font-normal">Title</th>
                    <th className="px-4 py-2.5 font-normal">Exposures</th>
                    <th className="px-4 py-2.5 font-normal">Looked</th>
                    <th className="px-4 py-2.5 font-normal">Releases</th>
                    <th className="px-4 py-2.5 font-normal">Peak → end</th>
                  </tr>
                </thead>
                <tbody>
                  {perRung.map((r) => (
                    <tr key={r.rung} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-mono">{r.rung}</td>
                      <td className="px-4 py-2.5">{r.title}</td>
                      <td className="px-4 py-2.5 font-mono">{r.count}</td>
                      <td className="px-4 py-2.5 font-mono">{fmtDuration(r.lookMs)}</td>
                      <td className="px-4 py-2.5 font-mono">{r.releases}</td>
                      <td className="px-4 py-2.5 font-mono">
                        {r.peak} → {r.end}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid gap-12 lg:grid-cols-2">
            <Section title="Fear fingerprint" sub="Which visual dials drive this patient's distress, learned from their own ratings.">
              {model && <FearFingerprint model={model} />}
            </Section>

            <Section title="What the patient learned" sub="In their own words, after each exposure.">
              {notes.length ? (
                <ul className="space-y-3">
                  {notes.map((e, i) => (
                    <li key={i} className="border-l-2 border-primary/50 pl-4">
                      <p className="text-[16px] leading-relaxed text-ink">&ldquo;{e.learned}&rdquo;</p>
                      <p className="mt-1 font-mono text-[12px] text-muted">
                        {rungLabel(e)} · predicted &ldquo;{e.prediction || "—"}&rdquo; ({e.likelihood}%) · happened: {e.happened} · surprise{" "}
                        {e.surprise}
                        {e.feelings.length ? ` · felt ${e.feelings.join(", ")}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No notes yet.</p>
              )}
            </Section>
          </div>

          <Section title="All exposures" sub="Table view of every exposure.">
            <div className="overflow-x-auto rounded-[12px] border border-line bg-surface">
              <table className="w-full text-left text-[13px]">
                <thead className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  <tr className="border-b border-line">
                    {["#", "Rung", "Date", "Expected", "Peak", "End", "Likelihood", "Happened", "Surprise", "Looked", "Releases"].map((h) => (
                      <th key={h} className="px-3 py-2.5 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {exposures.map((e, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2">{rungLabel(e)}</td>
                      <td className="px-3 py-2">{new Date(e.startedAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{e.expectedSuds}</td>
                      <td className="px-3 py-2">{e.peakSuds}</td>
                      <td className="px-3 py-2">{e.endSuds}</td>
                      <td className="px-3 py-2">{e.likelihood}%</td>
                      <td className="px-3 py-2">{e.happened}</td>
                      <td className="px-3 py-2">{e.surprise}</td>
                      <td className="px-3 py-2">{fmtDuration(e.lookMs)}</td>
                      <td className="px-3 py-2">{e.releases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <p className="text-[13px] text-muted">
            Designed for use with a licensed therapist. Not a medical device. The fear fingerprint is an exploratory linear model
            fitted to this patient&rsquo;s ratings and should be read alongside clinical judgement.
          </p>
        </div>
      )}
    </div>
  );
}

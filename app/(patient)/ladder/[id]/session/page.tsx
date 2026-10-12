"use client";

import { ArrowUp, Layers, Loader2, Pause, Repeat, Sprout } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BreathePause } from "@/components/BreathePause";
import { Range } from "@/components/controls";
import { HoldToView } from "@/components/HoldToView";
import { LadderMark } from "@/components/LadderMark";
import { SudsSlider } from "@/components/SudsSlider";
import { fmtDuration } from "@/lib/format";
import { preloadImages } from "@/lib/images";
import { runnerFor, useHealth, useLadder } from "@/lib/live";
import { fitFearModel, halfStepDials } from "@/lib/model/fearModel";
import { mainRungs, newId } from "@/lib/pipeline/buildLadder";
import { nextStep, suggestedStart, summarize, type NextStep } from "@/lib/session";
import { listSessions, saveSession } from "@/lib/store";
import type { Exposure, Ladder, Rung, Session } from "@/lib/types";

type Phase = "welcome" | "predict" | "expose" | "reflect" | "next" | "summary";

const PREDICTIONS = [
  "I'll panic",
  "I won't be able to keep looking",
  "I'll feel sick",
  "It will feel unbearable",
  "The feeling will never fade",
];
const FEELINGS = ["scared", "disgusted", "tense", "okay"];

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-[15px] transition-colors duration-200 ${
        on ? "border-primary bg-primary-soft text-ink" : "border-line text-muted hover:border-primary/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function SessionShell({
  children,
  onPause,
  showPause,
  ladderId,
}: {
  children: React.ReactNode;
  onPause: () => void;
  showPause: boolean;
  ladderId: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-4 sm:px-8">
        <Link href={`/ladder/${ladderId}`} className="flex items-center gap-2 text-muted hover:text-ink" aria-label="Back to the ladder">
          <LadderMark className="h-5 w-5 text-primary" />
          <span className="font-display text-[17px]">Fear Ladder</span>
        </Link>
        {showPause && (
          <button
            type="button"
            onClick={onPause}
            className="flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-[15px] text-ink hover:border-primary"
          >
            <Pause className="h-4 w-4" aria-hidden /> Pause
          </button>
        )}
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ladder = useLadder(id);
  const live = useHealth();
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("welcome");
  const [paused, setPaused] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<Session[]>([]);
  const [rungId, setRungId] = useState<string | null>(null);
  const [startChoice, setStartChoice] = useState<string | null>(null);

  // predict
  const [predChips, setPredChips] = useState<string[]>([]);
  const [predText, setPredText] = useState("");
  const [likelihood, setLikelihood] = useState(50);
  const [expectedSuds, setExpectedSuds] = useState(50);

  // expose
  const [suds, setSuds] = useState(50);
  const [lookMs, setLookMs] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [promptIdx, setPromptIdx] = useState(0);
  const lookRef = useRef(0);
  const visibleRef = useRef(false);
  const everVisible = useRef(false);
  const releasesRef = useRef(0);
  const samplesRef = useRef<{ t: number; suds: number }[]>([]);
  const startedAtRef = useRef<number>(0);
  const sudsRef = useRef(50);

  // reflect
  const [endSuds, setEndSuds] = useState(30);
  const [happened, setHappened] = useState<Exposure["happened"] | null>(null);
  const [surprise, setSurprise] = useState(50);
  const [feelings, setFeelings] = useState<string[]>([]);
  const [learned, setLearned] = useState("");

  // next
  const [last, setLast] = useState<{ exposure: Exposure; step: NextStep } | null>(null);
  const [drawing, setDrawing] = useState<null | "halfstep" | "variation">(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [newRungId, setNewRungId] = useState<string | null>(null);

  useEffect(() => {
    listSessions(id).then(setHistory);
  }, [id]);

  const rung: Rung | undefined = useMemo(() => ladder?.rungs.find((r) => r.id === rungId), [ladder, rungId]);
  const suggested = useMemo(() => (ladder ? suggestedStart(ladder, history) : undefined), [ladder, history]);
  const readyMain = useMemo(() => (ladder ? mainRungs(ladder).filter((r) => r.status === "ready" && r.image) : []), [ladder]);

  // Have every rung's image ready before the exposure starts, without blocking this screen.
  useEffect(() => {
    preloadImages(readyMain.map((r) => r.image));
  }, [readyMain]);

  // Look timer: counts only while the image is actually visible.
  useEffect(() => {
    if (phase !== "expose" || paused) return;
    let prev = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      if (visibleRef.current) {
        lookRef.current += now - prev;
        setLookMs(lookRef.current);
      }
      prev = now;
    }, 200);
    return () => clearInterval(t);
  }, [phase, paused]);

  // Gentle SUDS pulse every 30 s; record a sample each time.
  useEffect(() => {
    if (phase !== "expose" || paused) return;
    const t = setInterval(() => {
      samplesRef.current.push({ t: Math.round((Date.now() - startedAtRef.current) / 1000), suds: sudsRef.current });
      setPulse(true);
      setTimeout(() => setPulse(false), 5000);
    }, 30_000);
    return () => clearInterval(t);
  }, [phase, paused]);

  // Rotate notice prompts.
  useEffect(() => {
    if (phase !== "expose" || !rung?.noticePrompts.length) return;
    const t = setInterval(() => setPromptIdx((i) => (i + 1) % rung.noticePrompts.length), 12_000);
    return () => clearInterval(t);
  }, [phase, rung]);

  // Arrow keys adjust SUDS during exposure even when the slider isn't focused.
  useEffect(() => {
    if (phase !== "expose" || paused) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        changeSuds(Math.min(100, sudsRef.current + 5));
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        changeSuds(Math.max(0, sudsRef.current - 5));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, paused]);

  const lastSampleAt = useRef(0);
  function changeSuds(v: number) {
    setSuds(v);
    sudsRef.current = v;
    setPulse(false);
    const now = Date.now();
    const t = Math.round((now - startedAtRef.current) / 1000);
    const samples = samplesRef.current;
    if (samples.length && now - lastSampleAt.current < 1000) samples[samples.length - 1] = { t, suds: v };
    else samples.push({ t, suds: v });
    lastSampleAt.current = now;
  }

  const onVisibleChange = useCallback((v: boolean) => {
    if (!v && visibleRef.current && everVisible.current) releasesRef.current += 1;
    if (v && !everVisible.current) {
      everVisible.current = true;
      samplesRef.current.push({ t: Math.round((Date.now() - startedAtRef.current) / 1000), suds: sudsRef.current });
    }
    visibleRef.current = v;
  }, []);

  function beginRung(id: string) {
    setRungId(id);
    setPredChips([]);
    setPredText("");
    setLikelihood(50);
    setExpectedSuds(50);
    setPhase("predict");
    window.scrollTo({ top: 0 });
  }

  function startExposure() {
    lookRef.current = 0;
    setLookMs(0);
    releasesRef.current = 0;
    samplesRef.current = [];
    everVisible.current = false;
    visibleRef.current = false;
    startedAtRef.current = Date.now();
    setSuds(expectedSuds);
    sudsRef.current = expectedSuds;
    setPromptIdx(0);
    setPhase("expose");
  }

  function finishExposure() {
    visibleRef.current = false;
    setEndSuds(sudsRef.current);
    setHappened(null);
    setSurprise(50);
    setFeelings([]);
    setLearned("");
    setPhase("reflect");
  }

  async function saveReflection(l: Ladder, r: Rung, s: Session) {
    const samples = [...samplesRef.current, { t: Math.round((Date.now() - startedAtRef.current) / 1000), suds: endSuds }];
    const peak = Math.max(...samples.map((x) => x.suds), endSuds);
    const exposure: Exposure = {
      rungId: r.id,
      startedAt: new Date(startedAtRef.current).toISOString(),
      endedAt: new Date().toISOString(),
      lookMs: Math.round(lookRef.current),
      releases: releasesRef.current,
      samples,
      prediction: [...predChips, predText.trim()].filter(Boolean).join("; "),
      likelihood,
      expectedSuds,
      peakSuds: peak,
      endSuds,
      happened: happened ?? "partly",
      surprise,
      learned: learned.trim(),
      feelings,
    };
    const updated: Session = { ...s, exposures: [...s.exposures, exposure] };
    setSession(updated);
    await saveSession(updated);
    setLast({ exposure, step: nextStep(l, r, exposure) });
    setNewRungId(null);
    setDrawError(null);
    setPhase("next");
    window.scrollTo({ top: 0 });
  }

  async function endSession() {
    setPaused(false);
    if (session) {
      const ended = { ...session, endedAt: new Date().toISOString() };
      setSession(ended);
      await saveSession(ended);
    }
    setPhase("summary");
  }

  async function drawHalfStep(l: Ladder, r: Rung) {
    setDrawing("halfstep");
    setDrawError(null);
    try {
      const all = [...history.flatMap((s) => s.exposures), ...(session?.exposures ?? [])];
      const model = fitFearModel(l.rungs, all);
      const main = mainRungs(l);
      const k = main.findIndex((m) => m.id === (r.kind === "variation" ? r.parentId : r.id));
      const lower = main[k - 1];
      let dials;
      if (model.n >= 3 && lower) {
        const target = (model.predict(lower.dials) + model.predict(main[k].dials)) / 2;
        dials = halfStepDials(model, lower.dials, main[k].dials, target);
      }
      const newId = await runnerFor(l).addHalfStep(main[k].id, dials);
      if (!newId) throw new Error("Couldn't add a step here.");
      setNewRungId(newId);
    } catch (e) {
      setDrawError((e as Error).message);
    } finally {
      setDrawing(null);
    }
  }

  async function drawVariation(l: Ladder, r: Rung) {
    setDrawing("variation");
    setDrawError(null);
    try {
      const parent = r.kind === "variation" ? r.parentId! : r.id;
      const vid = await runnerFor(l).addVariation(parent);
      if (!vid) throw new Error("Couldn't add a variation here.");
      setNewRungId(vid);
    } catch (e) {
      setDrawError((e as Error).message);
    } finally {
      setDrawing(null);
    }
  }

  // ── Loading / empty states ──
  if (ladder === undefined) {
    return (
      <SessionShell onPause={() => {}} showPause={false} ladderId={id}>
        <div className="flex flex-1 items-center justify-center gap-2 text-muted">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> Getting ready…
        </div>
      </SessionShell>
    );
  }
  if (ladder === null || readyMain.length === 0) {
    return (
      <SessionShell onPause={() => {}} showPause={false} ladderId={id}>
        <div className="mx-auto max-w-md flex-1 px-6 py-20 text-center">
          <p className="font-display text-[28px]">This ladder isn&rsquo;t ready yet.</p>
          <p className="mt-3 text-muted">Ask your therapist to finish building it first.</p>
          <Link href={ladder ? `/ladder/${id}` : "/"} className="mt-6 inline-block min-h-11 rounded-full border border-line px-5 py-2.5 text-ink">
            Back
          </Link>
        </div>
      </SessionShell>
    );
  }

  const newRung = newRungId ? ladder.rungs.find((r) => r.id === newRungId) : undefined;
  // Rung numbers shift when a half-step is inserted, so always read the next rung from the live ladder.
  const nextRung = last?.step.nextRung ? ladder.rungs.find((r) => r.id === last.step.nextRung!.id) : undefined;
  const exposuresSoFar = session?.exposures ?? [];
  const reachedTarget = lookMs >= ladder.settings.exposureSeconds * 1000;

  return (
    <SessionShell onPause={() => setPaused(true)} showPause={phase !== "welcome" && phase !== "summary"} ladderId={id}>
      {paused && <BreathePause onReturn={() => setPaused(false)} onEnd={endSession} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={phase + (rungId ?? "")}
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-1 flex-col"
        >
          {phase === "welcome" && (
            <div className="mx-auto w-full max-w-xl flex-1 px-6 pb-16 pt-8 sm:pt-16">
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted">Session · {ladder.alias}</p>
              <h1 className="font-display mt-4 text-[36px] leading-tight sm:text-[44px]">Take your time.</h1>
              <p className="mt-3 text-[18px] text-muted">You can stop whenever you want. Pause is always at the top of the screen.</p>

              {ladder.preset === "needles" && (
                <div className="mt-8 rounded-[14px] border border-accent/50 bg-surface p-5" role="note">
                  <p className="text-[16px] text-ink">
                    Sit down before you start. If you feel faint, use the applied-tension technique your therapist taught you.
                  </p>
                </div>
              )}

              <fieldset className="mt-10">
                <legend className="text-[15px] text-ink">Where would you like to start?</legend>
                <div className="mt-3 space-y-2">
                  {readyMain.map((r) => {
                    const checked = (startChoice ?? suggested?.id) === r.id;
                    return (
                      <label
                        key={r.id}
                        className={`flex min-h-12 cursor-pointer items-center gap-4 rounded-[12px] border px-4 py-2.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                          checked ? "border-primary bg-primary-soft" : "border-line"
                        }`}
                      >
                        <input type="radio" name="start" className="sr-only" checked={checked} onChange={() => setStartChoice(r.id)} />
                        <span className="font-display w-7 text-[22px] text-primary">{r.index}</span>
                        <span className="flex-1 text-[15px] text-ink">{r.title}</span>
                        {suggested?.id === r.id && <span className="font-mono text-[11px] uppercase text-muted">suggested</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <button
                type="button"
                className="mt-8 min-h-12 w-full rounded-full bg-primary px-6 text-[17px] font-medium text-bg"
                onClick={() => {
                  const s: Session = { id: newId("s"), ladderId: ladder.id, startedAt: new Date().toISOString(), exposures: [] };
                  setSession(s);
                  void saveSession(s);
                  beginRung(startChoice ?? suggested?.id ?? readyMain[0].id);
                }}
              >
                Begin
              </button>
              <p className="mt-6 text-center text-[13px] text-muted">
                Designed for use with a licensed therapist. Not a medical device. Not for emergencies. In crisis, call or text 988
                (US and Canada) or your local emergency number.
              </p>
            </div>
          )}

          {phase === "predict" && rung && (
            <div className="mx-auto w-full max-w-xl flex-1 px-6 pb-16 pt-6 sm:pt-12">
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted">
                Rung {rung.index}
                {rung.kind === "half-step" ? " · smaller step" : rung.kind === "variation" ? " · variation" : ""}
              </p>
              <h1 className="font-display mt-3 text-[30px] leading-tight sm:text-[36px]">{rung.title}</h1>
              <p className="mt-2 text-muted">Before you look, a few quick questions.</p>

              <div className="mt-8">
                <p id="pred-l" className="text-[16px] text-ink">
                  What do you think will happen when you look?
                </p>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="pred-l">
                  {PREDICTIONS.map((p) => (
                    <Chip key={p} on={predChips.includes(p)} onClick={() => setPredChips((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]))}>
                      {p}
                    </Chip>
                  ))}
                </div>
                <label htmlFor="pred-text" className="sr-only">
                  In your own words
                </label>
                <input
                  id="pred-text"
                  type="text"
                  value={predText}
                  onChange={(e) => setPredText(e.target.value)}
                  placeholder="Or in your own words…"
                  className="mt-3 w-full rounded-[12px] border border-line bg-surface px-4 py-3 text-[16px] text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="mt-8">
                <div className="flex items-baseline justify-between">
                  <label htmlFor="likelihood" className="text-[16px] text-ink">
                    How likely is that to happen?
                  </label>
                  <span className="font-mono text-ink">{likelihood}%</span>
                </div>
                <Range id="likelihood" value={likelihood} min={0} max={100} step={1} onChange={setLikelihood} label="How likely is that to happen?" valueText={`${likelihood} percent`} />
              </div>

              <div className="mt-6">
                <SudsSlider id="expected" value={expectedSuds} onChange={setExpectedSuds} label="How distressed do you expect to feel?" />
              </div>

              <button
                type="button"
                onClick={startExposure}
                disabled={predChips.length === 0 && !predText.trim()}
                className="mt-10 min-h-12 w-full rounded-full bg-primary px-6 text-[17px] font-medium text-bg disabled:opacity-40"
              >
                I&rsquo;m ready to look
              </button>
              {predChips.length === 0 && !predText.trim() && (
                <p className="mt-2 text-center text-[13px] text-muted">Choose or write a prediction first.</p>
              )}
            </div>
          )}

          {phase === "expose" && rung?.image && (
            <div className="flex flex-1 flex-col">
              <div className="flex flex-1 flex-col items-center justify-center px-4 pt-2">
                <HoldToView src={rung.image} alt={rung.title} mode={ladder.settings.view} active={!paused} onVisibleChange={onVisibleChange} />
                <p className="mt-4 min-h-[3rem] max-w-lg text-center font-display text-[20px] text-ink" aria-live="polite">
                  {rung.noticePrompts[promptIdx]}
                </p>
              </div>
              <div className="mx-auto w-full max-w-2xl space-y-3 px-4 pb-6">
                <SudsSlider value={suds} onChange={changeSuds} pulse={pulse} />
                <div className="flex items-center justify-between gap-4">
                  <p className="font-mono text-[14px] text-muted" aria-live="off">
                    Looked <span className="text-ink">{fmtDuration(lookMs)}</span>
                    {reachedTarget && <span className="ml-2 font-sans text-[13px]">· Finish whenever you&rsquo;re ready.</span>}
                  </p>
                  <button type="button" onClick={finishExposure} className="min-h-12 rounded-full bg-primary px-7 text-[16px] font-medium text-bg">
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {phase === "reflect" && rung && session && (
            <div className="mx-auto w-full max-w-xl flex-1 px-6 pb-16 pt-6 sm:pt-12">
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted">Rung {rung.index} · after</p>
              <h1 className="font-display mt-3 text-[30px] leading-tight sm:text-[36px]">Well done for looking.</h1>
              <div className="mt-8">
                <SudsSlider id="end-suds" value={endSuds} onChange={setEndSuds} label="How distressed do you feel now?" />
              </div>
              <div className="mt-8">
                <p id="happened-l" className="text-[16px] text-ink">
                  Did what you predicted happen?
                </p>
                {(predChips.length > 0 || predText.trim()) && (
                  <p className="mt-1 text-[14px] text-muted">You predicted: {[...predChips, predText.trim()].filter(Boolean).join("; ")}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="happened-l">
                  {(["yes", "partly", "no"] as const).map((h) => (
                    <Chip key={h} on={happened === h} onClick={() => setHappened(h)}>
                      {h === "yes" ? "Yes" : h === "partly" ? "Partly" : "No"}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <div className="flex items-baseline justify-between">
                  <label htmlFor="surprise" className="text-[16px] text-ink">
                    How surprised are you?
                  </label>
                  <span className="font-mono text-ink">{surprise}</span>
                </div>
                <Range id="surprise" value={surprise} min={0} max={100} step={1} onChange={setSurprise} label="How surprised are you?" valueText={`${surprise} out of 100`} />
                <div className="flex justify-between font-mono text-[11px] text-muted">
                  <span>not at all</span>
                  <span>very</span>
                </div>
              </div>
              <div className="mt-8">
                <p id="feel-l" className="text-[16px] text-ink">
                  Any feelings to name? <span className="text-muted">(optional)</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="feel-l">
                  {FEELINGS.map((f) => (
                    <Chip key={f} on={feelings.includes(f)} onClick={() => setFeelings((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]))}>
                      {f}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <label htmlFor="learned" className="text-[16px] text-ink">
                  What did you learn?
                </label>
                <textarea
                  id="learned"
                  rows={3}
                  value={learned}
                  onChange={(e) => setLearned(e.target.value)}
                  placeholder="e.g. It stayed still, and the feeling faded after a minute."
                  className="mt-3 w-full rounded-[12px] border border-line bg-surface px-4 py-3 text-[16px] text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
              <button
                type="button"
                disabled={!happened}
                onClick={() => saveReflection(ladder, rung, session)}
                className="mt-10 min-h-12 w-full rounded-full bg-primary px-6 text-[17px] font-medium text-bg disabled:opacity-40"
              >
                Save and continue
              </button>
            </div>
          )}

          {phase === "next" && rung && last && (
            <div className="mx-auto w-full max-w-xl flex-1 px-6 pb-16 pt-6 sm:pt-12">
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted">
                Rung {rung.index} · peak {last.exposure.peakSuds} → end {last.exposure.endSuds} · looked {fmtDuration(last.exposure.lookMs)}
              </p>
              <h1 className="font-display mt-3 text-[30px] leading-tight sm:text-[36px]">What next?</h1>
              <p className="mt-3 text-[17px] text-muted">{last.step.reason}</p>

              {drawing && (
                <div className="mt-8 flex items-center gap-4 rounded-[14px] border border-line bg-surface p-5" role="status" aria-live="polite">
                  <motion.span
                    className="block h-10 w-10 rounded-full bg-primary-soft"
                    animate={reduce ? { opacity: [0.5, 1, 0.5] } : { scale: [0.7, 1, 0.7] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden
                  />
                  <div>
                    <p className="text-ink">{drawing === "halfstep" ? "Drawing a smaller step" : "Drawing a new variation"}</p>
                    <p className="text-[14px] text-muted">The same subject, checked for safety before you see it. Breathe slowly while you wait.</p>
                  </div>
                </div>
              )}
              {drawError && <p className="mt-6 text-[15px] text-error">{drawError}</p>}

              {newRung && !drawing && (
                <div className="mt-8 rounded-[14px] border border-primary/50 bg-surface p-5">
                  {newRung.status === "ready" ? (
                    <>
                      <p className="text-ink">
                        {newRung.kind === "half-step" ? `A smaller step is ready: rung ${newRung.index}.` : "A new variation is ready."}
                      </p>
                      <MiniLadder ladder={ladder} highlight={newRung.id} />
                      <button
                        type="button"
                        onClick={() => beginRung(newRung.id)}
                        className="mt-4 min-h-12 w-full rounded-full bg-primary px-6 text-[16px] font-medium text-bg"
                      >
                        {newRung.kind === "half-step" ? "Try the smaller step" : "Try the variation"}
                      </button>
                    </>
                  ) : (
                    <p className="text-muted">{newRung.error ?? "That step couldn't be drawn. You can repeat this rung instead."}</p>
                  )}
                </div>
              )}

              {!drawing && (
                <div className="mt-8 grid gap-3">
                  {last.step.offerHalfStep && !newRung && (
                    <NextButton
                      primary={last.step.primary === "halfstep"}
                      icon={Sprout}
                      disabled={!live}
                      onClick={() => drawHalfStep(ladder, rung)}
                      title="Add a half-step"
                      sub={live ? "Generate a gentler rung between this one and the one below." : "Needs live generation, which is off on this deployment."}
                    />
                  )}
                  {nextRung && (
                    <NextButton
                      primary={last.step.primary === "climb"}
                      icon={ArrowUp}
                      onClick={() => beginRung(nextRung.id)}
                      title={`Climb to rung ${nextRung.index}`}
                      sub={nextRung.title}
                    />
                  )}
                  {last.step.criterionMet && rung.kind !== "half-step" && (
                    <NextButton
                      primary={last.step.primary === "variation"}
                      icon={Layers}
                      disabled={!live}
                      onClick={() => drawVariation(ladder, rung)}
                      title="Try a variation"
                      sub={live ? "Same intensity, a different individual or setting." : "Needs live generation, which is off on this deployment."}
                    />
                  )}
                  <NextButton primary={last.step.primary === "repeat"} icon={Repeat} onClick={() => beginRung(rung.id)} title="Repeat this rung" sub="Look again with a fresh prediction." />
                  <button type="button" onClick={endSession} className="mt-2 min-h-11 text-[15px] text-muted underline underline-offset-4 hover:text-ink">
                    End the session for today
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === "summary" && (
            <Summary exposures={exposuresSoFar} onReport={() => router.push(`/ladder/${id}/report`)} ladderId={id} />
          )}
        </motion.div>
      </AnimatePresence>
    </SessionShell>
  );
}

function NextButton({
  primary,
  icon: Icon,
  title,
  sub,
  onClick,
  disabled,
}: {
  primary: boolean;
  icon: typeof ArrowUp;
  title: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-14 items-center gap-4 rounded-[14px] border px-5 py-3.5 text-left transition-colors duration-200 disabled:opacity-45 ${
        primary ? "border-primary bg-primary-soft" : "border-line hover:border-primary/60"
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${primary ? "text-primary" : "text-muted"}`} aria-hidden />
      <span>
        <span className="block text-[16px] text-ink">
          {title}
          {primary && <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-primary">suggested</span>}
        </span>
        <span className="block text-[14px] text-muted">{sub}</span>
      </span>
    </button>
  );
}

function MiniLadder({ ladder, highlight }: { ladder: Ladder; highlight: string }) {
  const reduce = useReducedMotion();
  const main = [...mainRungs(ladder)].reverse();
  return (
    <ol className="relative mt-4 space-y-1 border-x-2 border-line px-3 py-2" aria-label="Ladder with the new step">
      {main.map((r) => (
        <motion.li
          key={r.id}
          layout={!reduce}
          initial={r.id === highlight && !reduce ? { opacity: 0, x: -20 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={`flex items-center gap-3 rounded-[8px] px-2 py-1 text-[13px] ${r.id === highlight ? "bg-primary-soft text-ink" : "text-muted"}`}
        >
          <span className="font-display w-5 text-[16px] text-primary">{r.index}</span>
          <span className="truncate">{r.title}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function Summary({ exposures, onReport, ladderId }: { exposures: Exposure[]; onReport: () => void; ladderId: string }) {
  const s = summarize(exposures);
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-6 pb-16 pt-10 text-center sm:pt-20">
      <LadderMark className="mx-auto h-10 w-10 text-primary" />
      <h1 className="font-display mt-6 text-[36px] leading-tight sm:text-[44px]">
        {exposures.length ? "You did the work today." : "That's okay. Stopping is always allowed."}
      </h1>
      {exposures.length > 0 && (
        <dl className="mt-10 grid grid-cols-3 gap-3 text-left">
          {[
            ["Rungs faced", String(s.rungs)],
            ["Time looked", fmtDuration(s.lookMs)],
            ["Biggest drop", `${s.biggestDrop} SUDS`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[14px] border border-line bg-surface p-4">
              <dt className="text-[13px] text-muted">{k}</dt>
              <dd className="mt-1 font-mono text-[22px] text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-8 text-muted">Your therapist will see these notes in the report.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onReport} className="min-h-12 rounded-full bg-primary px-6 text-[16px] font-medium text-bg">
          Open the report
        </button>
        <Link href={`/ladder/${ladderId}`} className="flex min-h-12 items-center rounded-full border border-line px-6 text-[16px] text-ink">
          Back to the ladder
        </Link>
      </div>
    </div>
  );
}

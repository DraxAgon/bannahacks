"use client";

import { Pause, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BreathePause } from "@/components/BreathePause";
import { HoldToView } from "@/components/HoldToView";
import { SudsSlider } from "@/components/SudsSlider";
import { AiLabel, Button, LinkButton } from "@/components/ui";
import { fmtDuration } from "@/lib/format";
import { runnerFor, useHealth, useLadder } from "@/lib/live";
import { fitFearModel, halfStepDials } from "@/lib/model/fearModel";
import { mainRungs, newId } from "@/lib/pipeline/buildLadder";
import { nextStep, suggestedStart, summarize, type NextStep } from "@/lib/session";
import { listSessions, saveSession } from "@/lib/store";
import type { Exposure, Ladder, Rung, Session } from "@/lib/types";

type Phase = "start" | "guess" | "look" | "after" | "smaller" | "summary";
type Happened = Exposure["happened"];

const ANSWERS: { happened: Happened; label: string }[] = [
  { happened: "no", label: "Easier" },
  { happened: "partly", label: "About the same" },
  { happened: "yes", label: "Worse" },
];

const titleClass = "text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[48px]";
const secondsSince = (start: number) => Math.round((Date.now() - start) / 1000);

/** "Step 3 of 9" among the planned steps; inserted half-steps are simply "Smaller step". */
function stepLabel(ladder: Ladder, rung: Rung | undefined): string | null {
  if (!rung) return null;
  if (rung.kind === "half-step") return "Smaller step";
  const planned = mainRungs(ladder).filter((r) => r.kind !== "half-step");
  const anchor = rung.kind === "variation" ? rung.parentId : rung.id;
  const i = planned.findIndex((r) => r.id === anchor);
  return i >= 0 ? `Step ${i + 1} of ${planned.length}` : null;
}

function TopBar({ ladderId, label, onPause }: { ladderId: string; label?: string | null; onPause?: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={`/ladder/${ladderId}`}
          aria-label="Leave session"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 ease-out hover:bg-subtle hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden />
        </Link>
        {label && <span className="tabular truncate text-[14px] text-muted">{label}</span>}
      </div>
      {onPause && (
        <button
          type="button"
          onClick={onPause}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-subtle px-4 text-[14px] font-medium text-ink transition-colors duration-150 ease-out hover:bg-line"
        >
          <Pause className="h-3.5 w-3.5" aria-hidden /> Pause
        </button>
      )}
    </header>
  );
}

/** A heavily blurred look at what's coming. It never sharpens here. */
function BlurredPreview({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`develop relative aspect-square overflow-hidden rounded-2xl bg-subtle ${className}`}>
      <img
        src={src}
        alt=""
        draggable={false}
        className="pointer-events-none h-full w-full select-none object-cover"
        style={{ filter: "blur(40px) saturate(0.6) brightness(0.75)", transform: "scale(1.2)" }}
      />
      <AiLabel className="absolute bottom-3 left-3" />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16 text-center">
      <div className="flex w-full max-w-md flex-col items-center">{children}</div>
    </div>
  );
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const ladder = useLadder(id);
  const live = useHealth();
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("start");
  const [paused, setPaused] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<Session[]>([]);
  const [rungId, setRungId] = useState<string | null>(null);

  // guess
  const [guess, setGuess] = useState(50);

  // look
  const [suds, setSuds] = useState(50);
  const [lookMs, setLookMs] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [promptIdx, setPromptIdx] = useState(0);
  const lookRef = useRef(0);
  const visibleRef = useRef(false);
  const everVisible = useRef(false);
  const releasesRef = useRef(0);
  const samplesRef = useRef<{ t: number; suds: number }[]>([]);
  const startedAtRef = useRef(0);
  const sudsRef = useRef(50);
  const lastSampleAt = useRef(0);

  // after
  const [pending, setPending] = useState<Omit<Exposure, "happened"> | null>(null);
  const [last, setLast] = useState<{ exposure: Exposure; step: NextStep } | null>(null);
  const answered = useRef(false);

  // smaller step
  const [drawing, setDrawing] = useState(false);
  const [drawFailed, setDrawFailed] = useState(false);
  const [newRungId, setNewRungId] = useState<string | null>(null);

  useEffect(() => {
    listSessions(id).then(setHistory);
  }, [id]);

  const rung = useMemo(() => ladder?.rungs.find((r) => r.id === rungId), [ladder, rungId]);
  const suggested = useMemo(() => (ladder ? suggestedStart(ladder, history) : undefined), [ladder, history]);
  const readyMain = useMemo(() => (ladder ? mainRungs(ladder).filter((r) => r.status === "ready" && r.image) : []), [ladder]);

  // Look timer: counts only while the image is actually in view.
  useEffect(() => {
    if (phase !== "look" || paused) return;
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

  // Every 30 s: record a sample and gently pulse the slider.
  useEffect(() => {
    if (phase !== "look" || paused) return;
    let off: ReturnType<typeof setTimeout> | undefined;
    const t = setInterval(() => {
      samplesRef.current.push({ t: secondsSince(startedAtRef.current), suds: sudsRef.current });
      setPulse(true);
      off = setTimeout(() => setPulse(false), 5000);
    }, 30_000);
    return () => {
      clearInterval(t);
      clearTimeout(off);
    };
  }, [phase, paused]);

  // One notice prompt at a time, rotating every 12 s.
  useEffect(() => {
    if (phase !== "look" || !rung || rung.noticePrompts.length < 2) return;
    const n = rung.noticePrompts.length;
    const t = setInterval(() => setPromptIdx((i) => (i + 1) % n), 12_000);
    return () => clearInterval(t);
  }, [phase, rung]);

  const changeSuds = useCallback((v: number) => {
    setSuds(v);
    sudsRef.current = v;
    setPulse(false);
    const now = Date.now();
    const sample = { t: Math.round((now - startedAtRef.current) / 1000), suds: v };
    const samples = samplesRef.current;
    // Collapse a quick run of changes (dragging, key repeat) into one sample.
    if (samples.length && now - lastSampleAt.current < 1000) samples[samples.length - 1] = sample;
    else samples.push(sample);
    lastSampleAt.current = now;
  }, []);

  // Arrow keys nudge the rating by 5 when the slider itself isn't focused.
  useEffect(() => {
    if (phase !== "look" || paused) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
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
  }, [phase, paused, changeSuds]);

  const onVisibleChange = useCallback((v: boolean) => {
    if (!v && visibleRef.current) releasesRef.current += 1;
    if (v && !everVisible.current) {
      everVisible.current = true;
      samplesRef.current.push({ t: secondsSince(startedAtRef.current), suds: sudsRef.current });
    }
    visibleRef.current = v;
  }, []);

  function go(next: Phase) {
    setPhase(next);
    window.scrollTo({ top: 0 });
  }

  function beginRung(target: string) {
    setRungId(target);
    setGuess(50);
    setPending(null);
    setLast(null);
    go("guess");
  }

  function begin(l: Ladder) {
    const s: Session = { id: newId("s"), ladderId: l.id, startedAt: new Date().toISOString(), exposures: [] };
    setSession(s);
    void saveSession(s);
    beginRung(suggested?.id ?? readyMain[0].id);
  }

  function startLook() {
    lookRef.current = 0;
    releasesRef.current = 0;
    samplesRef.current = [];
    everVisible.current = false;
    visibleRef.current = false;
    lastSampleAt.current = 0;
    startedAtRef.current = Date.now();
    sudsRef.current = guess;
    setSuds(guess);
    setLookMs(0);
    setPulse(false);
    setPromptIdx(0);
    go("look");
  }

  function finishLook(r: Rung) {
    visibleRef.current = false;
    const now = Date.now();
    const end = sudsRef.current;
    const samples = [...samplesRef.current, { t: Math.round((now - startedAtRef.current) / 1000), suds: end }];
    setPending({
      rungId: r.id,
      startedAt: new Date(startedAtRef.current).toISOString(),
      endedAt: new Date(now).toISOString(),
      lookMs: Math.round(lookRef.current),
      releases: releasesRef.current,
      samples,
      prediction: "",
      likelihood: 0,
      expectedSuds: guess,
      peakSuds: Math.max(end, ...samples.map((x) => x.suds)),
      endSuds: end,
      surprise: 0,
      learned: "",
      feelings: [],
    });
    setLast(null);
    answered.current = false;
    go("after");
  }

  async function answer(l: Ladder, r: Rung, s: Session, happened: Happened) {
    if (!pending || answered.current) return;
    answered.current = true;
    const exposure: Exposure = { ...pending, happened };
    const updated: Session = { ...s, exposures: [...s.exposures, exposure] };
    setSession(updated);
    setPending(null);
    setLast({ exposure, step: nextStep(l, r, exposure) });
    await saveSession(updated);
  }

  async function endSession() {
    setPaused(false);
    if (session) {
      const ended = { ...session, endedAt: new Date().toISOString() };
      setSession(ended);
      await saveSession(ended);
    }
    go("summary");
  }

  async function drawHalfStep(l: Ladder, r: Rung) {
    setNewRungId(null);
    setDrawFailed(false);
    setDrawing(true);
    go("smaller");
    try {
      const all = [...history.flatMap((s) => s.exposures), ...(session?.exposures ?? [])];
      const model = fitFearModel(l.rungs, all);
      const main = mainRungs(l);
      const k = main.findIndex((m) => m.id === (r.kind === "variation" ? r.parentId : r.id));
      if (k < 0) throw new Error("No step to split here.");
      const lower = main[k - 1];
      let dials;
      // With enough ratings, the fear model picks dials it predicts will land halfway.
      if (model.n >= 3 && lower) {
        const target = (model.predict(lower.dials) + model.predict(main[k].dials)) / 2;
        dials = halfStepDials(model, lower.dials, main[k].dials, target);
      }
      const made = await runnerFor(l).addHalfStep(main[k].id, dials);
      if (!made) throw new Error("No step was added.");
      setNewRungId(made);
    } catch {
      setDrawFailed(true);
    } finally {
      setDrawing(false);
    }
  }

  // ── Loading and empty states ──
  if (ladder === undefined) {
    return (
      <>
        <TopBar ladderId={id} />
        <Centered>
          <p className="text-[15px] text-faint" role="status">
            Getting ready…
          </p>
        </Centered>
      </>
    );
  }
  if (ladder === null || readyMain.length === 0) {
    return (
      <>
        <TopBar ladderId={id} />
        <Centered>
          <h1 className="text-[22px] font-semibold tracking-tight">This ladder isn&rsquo;t ready yet.</h1>
          <LinkButton variant="secondary" href={ladder ? `/ladder/${id}` : "/"} className="mt-8">
            Back
          </LinkButton>
        </Centered>
      </>
    );
  }

  const label = phase === "summary" ? null : stepLabel(ladder, phase === "start" ? suggested : rung);
  const shown = last?.exposure ?? pending;

  // Rung numbers shift when a half-step is inserted, so read rungs fresh from the live ladder by id.
  const nextId = last?.step.nextRung?.id;
  const next = nextId ? ladder.rungs.find((r) => r.id === nextId && r.status === "ready" && r.image) : undefined;
  const newRung = newRungId ? ladder.rungs.find((r) => r.id === newRungId) : undefined;
  const smaller: "drawing" | "ready" | "failed" =
    drawing
      ? "drawing"
      : drawFailed || (newRungId && !newRung) || newRung?.status === "error"
        ? "failed"
        : newRung?.status === "ready" && newRung.image
          ? "ready"
          : "drawing";

  return (
    <>
      <TopBar ladderId={id} label={label} onPause={phase === "summary" ? undefined : () => setPaused(true)} />
      {paused && <BreathePause onReturn={() => setPaused(false)} onEnd={endSession} />}

      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={phase + (rungId ?? "")}
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-1 flex-col"
        >
          {phase === "start" && (
            <>
              <Centered>
                <h1 className={titleClass}>Ready when you are.</h1>
                <p className="mt-4 text-[16px] text-muted">You choose when to look. You can stop any time.</p>
                {ladder.preset === "needles" && (
                  <p className="mt-2 text-[16px] text-muted">Sit down first. If you feel faint, tense your arm and leg muscles.</p>
                )}
                <Button className="mt-10 w-full max-w-xs" onClick={() => begin(ladder)}>
                  Begin
                </Button>
              </Centered>
              <p className="px-4 pb-6 text-center text-[13px] text-faint">
                Not a medical device. Best used with a therapist. In crisis, call or text 988.
              </p>
            </>
          )}

          {phase === "guess" && rung?.image && (
            <div className="flex flex-1 flex-col items-center px-4 pb-8 pt-2 text-center">
              <h1 className="max-w-md text-balance text-[24px] font-semibold leading-tight tracking-tight sm:text-[28px]">
                {rung.title}
              </h1>
              <BlurredPreview src={rung.image} className="mt-6 w-[min(calc(100svh-430px),80vw,400px)] min-w-[200px]" />
              <div className="mt-6 w-full max-w-md">
                <SudsSlider id="guess" value={guess} onChange={setGuess} label="How anxious do you think you’ll feel?" />
              </div>
              <Button className="mt-6 w-full max-w-xs" onClick={startLook}>
                Look
              </Button>
            </div>
          )}

          {phase === "look" && rung?.image && (
            <div className="flex flex-1 flex-col items-center px-4 pb-6">
              <div className="flex w-full flex-1 flex-col items-center justify-center pt-2">
                <HoldToView
                  key={rung.id}
                  src={rung.image}
                  alt={rung.title}
                  mode={ladder.settings.view}
                  active={!paused}
                  onVisibleChange={onVisibleChange}
                />
                <div className="mt-5 flex min-h-[44px] max-w-md items-start justify-center" aria-live="polite">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={promptIdx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="text-center text-[15px] text-muted"
                    >
                      {rung.noticePrompts[promptIdx % Math.max(1, rung.noticePrompts.length)]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
              <div className="mt-2 w-full max-w-md">
                <SudsSlider value={suds} onChange={changeSuds} pulse={pulse} label="How do you feel right now?" />
                <div className="mt-3 flex items-center justify-between gap-4 pl-4">
                  <span className="tabular text-[13px] text-faint">
                    <span className="sr-only">Looked for </span>
                    {fmtDuration(lookMs)}
                  </span>
                  <Button className="min-w-32" onClick={() => finishLook(rung)}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}

          {phase === "after" && rung && session && shown && (
            <Centered>
              <h1 className={`${titleClass} tabular`}>
                {shown.peakSuds === shown.endSuds
                  ? `It stayed at ${shown.endSuds}.`
                  : `Peak ${shown.peakSuds}. Now ${shown.endSuds}.`}
              </h1>
              <AnimatePresence mode="wait" initial={false}>
                {!last ? (
                  <motion.div
                    key="ask"
                    className="flex w-full flex-col items-center"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <p id="ask" className="mt-10 text-[17px] text-ink">
                      Was it as bad as you expected?
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2" role="group" aria-labelledby="ask">
                      {ANSWERS.map((a) => (
                        <Button key={a.happened} variant="secondary" onClick={() => answer(ladder, rung, session, a.happened)}>
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="next"
                    className="flex w-full flex-col items-center"
                    initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <p className="mt-5 max-w-sm text-[15px] text-muted">{last.step.reason}</p>
                    <NextButtons
                      step={last.step}
                      live={Boolean(live)}
                      hasNext={Boolean(next)}
                      onNext={() => next && beginRung(next.id)}
                      onStay={() => beginRung(rung.id)}
                      onSmaller={() => drawHalfStep(ladder, rung)}
                      onFinish={endSession}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </Centered>
          )}

          {phase === "smaller" && rung && (
            <Centered>
              {smaller === "drawing" && (
                <div role="status" className="flex flex-col items-center">
                  <motion.span
                    aria-hidden
                    className="block h-24 w-24 rounded-full border-[1.5px] border-ink"
                    animate={reduce ? { opacity: [0.3, 0.9, 0.3] } : { scale: [0.8, 1.08, 0.8], opacity: [0.5, 0.9, 0.5] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <p className="mt-8 text-[17px] text-ink">Drawing a smaller step…</p>
                </div>
              )}
              {smaller === "ready" && newRung?.image && (
                <>
                  <BlurredPreview src={newRung.image} className="w-[min(60vw,240px)]" />
                  <h1 className="mt-8 text-balance text-[24px] font-semibold leading-tight tracking-tight sm:text-[28px]">
                    {newRung.title}
                  </h1>
                  <Button className="mt-10 w-full max-w-xs" onClick={() => beginRung(newRung.id)}>
                    Try it
                  </Button>
                </>
              )}
              {smaller === "failed" && (
                <>
                  <p className="text-[17px] text-ink">A smaller step couldn&rsquo;t be drawn right now.</p>
                  <Button className="mt-10 w-full max-w-xs" onClick={() => beginRung(rung.id)}>
                    Stay on this step
                  </Button>
                </>
              )}
            </Centered>
          )}

          {phase === "summary" && <Summary exposures={session?.exposures ?? []} ladderId={id} />}
        </motion.main>
      </AnimatePresence>
    </>
  );
}

function NextButtons({
  step,
  live,
  hasNext,
  onNext,
  onStay,
  onSmaller,
  onFinish,
}: {
  step: NextStep;
  live: boolean;
  hasNext: boolean;
  onNext: () => void;
  onStay: () => void;
  onSmaller: () => void;
  onFinish: () => void;
}) {
  const primary =
    step.primary === "climb" && hasNext
      ? { label: "Next step", onClick: onNext }
      : step.primary === "halfstep"
        ? live
          ? { label: "Try a smaller step", onClick: onSmaller }
          : { label: "Stay on this step", onClick: onStay }
        : step.primary === "repeat"
          ? { label: "Stay on this step", onClick: onStay }
          : { label: "Finish", onClick: onFinish };

  return (
    <div className="mt-10 flex w-full max-w-xs flex-col gap-2">
      <Button onClick={primary.onClick}>{primary.label}</Button>
      {hasNext && primary.label !== "Next step" && (
        <Button variant="secondary" onClick={onNext}>
          Next step
        </Button>
      )}
      {primary.label !== "Finish" && (
        <Button variant="ghost" onClick={onFinish}>
          Finish
        </Button>
      )}
    </div>
  );
}

function Summary({ exposures, ladderId }: { exposures: Exposure[]; ladderId: string }) {
  if (exposures.length === 0) {
    return (
      <Centered>
        <h1 className={titleClass}>That&rsquo;s okay.</h1>
        <p className="mt-4 text-[16px] text-muted">Stopping is always allowed.</p>
        <LinkButton variant="secondary" href={`/ladder/${ladderId}`} className="mt-10 w-full max-w-xs">
          Back to ladder
        </LinkButton>
      </Centered>
    );
  }
  const s = summarize(exposures);
  const stats: [string, string][] = [
    ["Steps faced", String(s.rungs)],
    ["Time looking", fmtDuration(s.lookMs)],
    ["Biggest drop", String(s.biggestDrop)],
  ];
  return (
    <Centered>
      <h1 className={titleClass}>Nice work.</h1>
      <dl className="mt-12 grid w-full grid-cols-3 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="flex flex-col-reverse items-center gap-1">
            <dt className="text-[13px] text-muted">{k}</dt>
            <dd className="tabular text-[32px] font-semibold leading-none tracking-tight sm:text-[40px]">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-12 flex w-full max-w-xs flex-col gap-2">
        <LinkButton href={`/ladder/${ladderId}/report`}>See report</LinkButton>
        <LinkButton variant="secondary" href={`/ladder/${ladderId}`}>
          Back to ladder
        </LinkButton>
      </div>
    </Centered>
  );
}

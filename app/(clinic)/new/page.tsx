"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { inputClass } from "@/components/controls";
import { Button, LinkButton } from "@/components/ui";
import { DEMOS, demoId } from "@/lib/demo";
import { startBuild, useHealth } from "@/lib/live";
import { emptyLadder } from "@/lib/pipeline/buildLadder";
import { PRESETS } from "@/lib/presets";
import type { FearPreset, PlanRequest } from "@/lib/types";

const CHOICES: { id: FearPreset; label: string }[] = [
  { id: "spiders", label: "Spiders" },
  { id: "dogs", label: "Dogs" },
  { id: "snakes", label: "Snakes" },
  { id: "needles", label: "Needles" },
  { id: "birds", label: "Birds" },
  { id: "heights", label: "Heights" },
  { id: "other", label: "Something else" },
];

const OTHER_PLACEHOLDER = "What it is, what makes it worse, and what you can already handle.";

const presetInfo = (id: FearPreset) => PRESETS.find((p) => p.id === id);

/** A short title for a "Something else" ladder, taken from the first phrase the person wrote. */
function titleFrom(text: string) {
  const first = text.split(/[.,;:!?\n]/)[0].trim();
  if (!first) return "Something else";
  const short = first.length > 40 ? `${first.slice(0, 40).replace(/\s+\S*$/, "")}…` : first;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export default function BuilderPage() {
  const router = useRouter();
  const live = useHealth();
  const reduce = useReducedMotion();
  const [preset, setPreset] = useState<FearPreset | undefined>();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isOther = preset === "other";
  const example = preset ? (presetInfo(preset)?.example ?? "") : "";
  const trimmed = text.trim();
  const ready = preset !== undefined && (!isOther || trimmed.length >= 3);
  const canSubmit = live === true && ready && !submitting;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !preset) return;
    setSubmitting(true);
    // The planner needs at least a few characters; a stray letter falls back to the preset's example.
    const description = trimmed.length >= 3 ? trimmed : example;
    const request: PlanRequest = { preset, description, rungCount: 9, startWithWord: true };
    const ladder = emptyLadder({
      alias: "Me",
      fear: isOther ? titleFrom(trimmed) : (presetInfo(preset)?.label ?? "Specific phobia"),
      preset,
      description,
      settings: { view: "hold", exposureSeconds: 120, mode: "expectancy" },
      request,
    });
    startBuild(ladder, request);
    router.push(`/ladder/${ladder.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-24 pt-12 sm:px-6 sm:pt-20">
      <h1
        id="fear-title"
        className="text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[48px]"
      >
        What are you afraid of?
      </h1>

      <form onSubmit={submit} className="mt-10 sm:mt-12">
        <fieldset aria-labelledby="fear-title">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {CHOICES.map((c) => {
              const active = c.id === preset;
              return (
                <label
                  key={c.id}
                  className={`flex h-16 cursor-pointer select-none items-center rounded-2xl px-5 text-[17px] font-medium tracking-[-0.01em] transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg ${
                    c.id === "other" ? "col-span-2" : ""
                  } ${active ? "bg-primary text-on-primary" : "bg-subtle text-ink hover:bg-line"}`}
                >
                  <input
                    type="radio"
                    name="fear"
                    value={c.id}
                    className="sr-only"
                    checked={active}
                    onChange={() => setPreset(c.id)}
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        {preset && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            transition={{ duration: reduce ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-10">
              <label htmlFor="details" className="block text-[15px] font-medium text-ink">
                {isOther ? (
                  "Describe the fear"
                ) : (
                  <>
                    Anything specific? <span className="font-normal text-faint">(optional)</span>
                  </>
                )}
              </label>
              <textarea
                id="details"
                rows={3}
                maxLength={1200}
                required={isOther}
                placeholder={isOther ? OTHER_PLACEHOLDER : example}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={`${inputClass} mt-2.5 max-h-64 min-h-28 resize-none field-sizing-content`}
              />
            </div>
          </motion.div>
        )}

        <div className="mt-10">
          {live === false ? (
            <div role="status">
              <p className="text-[15px] text-muted">Building new ladders is off right now. Try a ready-made one.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {DEMOS.map((d) => (
                  <LinkButton
                    key={d.slug}
                    variant="secondary"
                    href={`/ladder/${demoId(d.slug)}`}
                    aria-label={`Open the ${d.label.toLowerCase()} ladder`}
                  >
                    {d.label}
                  </LinkButton>
                ))}
              </div>
            </div>
          ) : (
            <>
              <Button type="submit" disabled={!canSubmit} className="w-full px-7 sm:w-auto">
                {submitting ? "Starting…" : "Build my ladder"}
              </Button>
              <p className="mt-3 text-[13px] text-faint">
                Takes about a minute. Nothing leaves your browser except the request to draw.
              </p>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

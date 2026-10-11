"use client";

import { Bird, Bug, CircleHelp, Dog, Flower2, ImagePlus, Mountain, Syringe, Worm, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, Segmented, Toggle, inputClass } from "@/components/controls";
import { Button, Eyebrow, buttonClass } from "@/components/ui";
import { DEMOS, demoId } from "@/lib/demo";
import { startBuild, useHealth } from "@/lib/live";
import { emptyLadder } from "@/lib/pipeline/buildLadder";
import { PRESETS } from "@/lib/presets";
import type { FearPreset, PlanRequest, ProgressMode, ViewMode } from "@/lib/types";

const ICONS: Record<FearPreset, typeof Bug> = {
  spiders: Bug,
  dogs: Dog,
  snakes: Worm,
  needles: Syringe,
  birds: Bird,
  bees: Flower2,
  heights: Mountain,
  other: CircleHelp,
};

/** Downscale an uploaded photo in the browser so requests stay small; the server normalizes again. */
async function downscale(file: File, max = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function BuilderPage() {
  const router = useRouter();
  const live = useHealth();
  const [preset, setPreset] = useState<FearPreset>("spiders");
  const [alias, setAlias] = useState("");
  const [description, setDescription] = useState("");
  const [worst, setWorst] = useState("");
  const [okay, setOkay] = useState("");
  const [upload, setUpload] = useState<string | undefined>();
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [rungCount, setRungCount] = useState(9);
  const [startWithWord, setStartWithWord] = useState(true);
  const [view, setView] = useState<ViewMode>("hold");
  const [minutes, setMinutes] = useState(2);
  const [mode, setMode] = useState<ProgressMode>("expectancy");
  const [submitting, setSubmitting] = useState(false);

  const example = PRESETS.find((p) => p.id === preset)?.example ?? "";
  const aliasLooksLikeName = /[a-z]{3,}/i.test(alias.replace(/[^a-z]/gi, "")) && alias.trim().length > 4;
  const canSubmit = live === true && description.trim().length >= 3 && !submitting;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const request: PlanRequest = {
      preset,
      description: description.trim(),
      worst: worst.trim() || undefined,
      okay: okay.trim() || undefined,
      rungCount,
      startWithWord,
    };
    const ladder = emptyLadder({
      alias: alias.trim().toUpperCase() || "Patient",
      fear: PRESETS.find((p) => p.id === preset)?.label ?? "Specific phobia",
      preset,
      description: request.description,
      settings: { view, exposureSeconds: minutes * 60, mode },
      request,
    });
    startBuild(ladder, request, upload);
    router.push(`/ladder/${ladder.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-10 pt-12 sm:px-8 sm:pt-16">
      <Eyebrow>Ladder builder · for the therapist</Eyebrow>
      <h1 className="font-display mt-3 text-[38px] leading-tight sm:text-[48px]">Describe the fear.</h1>
      <p className="prose-measure mt-3 text-muted">
        Write it the way your patient said it. Fear Ladder plans the rungs, draws the same subject on each one, and checks
        every image before anyone sees it.
      </p>

      {live === false && (
        <div className="mt-8 rounded-[12px] border border-line bg-surface p-5" role="status">
          <p className="font-medium text-ink">Live generation isn&rsquo;t configured on this deployment.</p>
          <p className="mt-1 text-[15px] text-muted">
            Every screen works with a demo ladder, generated earlier by the same pipeline.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {DEMOS.map((d) => (
              <Link key={d.slug} href={`/ladder/${demoId(d.slug)}`} className={buttonClass("secondary")}>
                Demo: {d.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="mt-10 space-y-12">
        <section aria-labelledby="fear-h" className="space-y-6">
          <h2 id="fear-h" className="font-display text-[24px]">
            1 · The fear
          </h2>
          <fieldset>
            <legend className="sr-only">Fear preset</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((p) => {
                const Icon = ICONS[p.id];
                const active = p.id === preset;
                return (
                  <label
                    key={p.id}
                    className={`flex min-h-[88px] cursor-pointer flex-col justify-between rounded-[12px] border p-3.5 transition-colors duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                      active ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-primary/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="preset"
                      className="sr-only"
                      checked={active}
                      onChange={() => setPreset(p.id)}
                    />
                    <Icon className={`h-6 w-6 ${active ? "text-primary" : "text-muted"}`} aria-hidden />
                    <span className="flex items-baseline gap-1.5 text-[15px] font-medium text-ink">
                      {p.label}
                      {p.beta && <span className="font-mono text-[11px] font-normal text-muted">beta</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {preset === "other" && (
              <p className="mt-3 text-[14px] text-muted">
                Other fears go through a scope check: Fear Ladder is for specific phobias suitable for image exposure, not
                trauma memories, self-harm, eating, real people or sexual content.
              </p>
            )}
          </fieldset>

          <Field
            label="Patient alias"
            htmlFor="alias"
            hint="Initials only. Please don't enter a real name; everything stays in this browser."
          >
            <input
              id="alias"
              className={`${inputClass} max-w-[220px] font-mono uppercase`}
              value={alias}
              maxLength={6}
              placeholder="e.g. J.M."
              autoComplete="off"
              onChange={(e) => setAlias(e.target.value)}
            />
            {aliasLooksLikeName && (
              <p className="mt-2 text-[13px] text-error">That looks like a name. Initials are safer.</p>
            )}
          </Field>

          <Field label="What the patient fears" htmlFor="desc" hint="Plain words. Include what makes it worse and what is fine.">
            <textarea
              id="desc"
              required
              rows={4}
              className={inputClass}
              placeholder={example}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {!description && (
              <button
                type="button"
                className="mt-2 min-h-11 text-[14px] text-primary underline underline-offset-4"
                onClick={() => setDescription(example)}
              >
                Use the example
              </button>
            )}
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Worst image (optional)" htmlFor="worst" hint="Becomes the top rung.">
              <input
                id="worst"
                className={inputClass}
                value={worst}
                placeholder="e.g. on my hand, moving"
                onChange={(e) => setWorst(e.target.value)}
              />
            </Field>
            <Field label="Already okay with (optional)" htmlFor="okay" hint="Keeps the bottom rungs gentle.">
              <input
                id="okay"
                className={inputClass}
                value={okay}
                placeholder="e.g. cartoon spiders"
                onChange={(e) => setOkay(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Use a photo of the actual trigger (optional)"
            htmlFor="upload"
            hint="For example, the neighbour's dog. It becomes the identity reference and is never shown as a rung."
          >
            {upload ? (
              <div className="flex items-center gap-4">
                <img src={upload} alt="Reference photo" className="h-20 w-20 rounded-[10px] border border-line object-cover" />
                <Button variant="ghost" onClick={() => setUpload(undefined)}>
                  <X className="h-4 w-4" aria-hidden /> Remove
                </Button>
              </div>
            ) : (
              <label
                htmlFor="upload"
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-line bg-surface px-4 text-[15px] text-muted hover:border-primary hover:text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
              >
                <ImagePlus className="h-5 w-5" aria-hidden />
                Choose a photo
                <input
                  id="upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploadError(undefined);
                    try {
                      setUpload(await downscale(f));
                    } catch {
                      setUploadError("That file couldn't be read as an image.");
                    }
                  }}
                />
              </label>
            )}
            {uploadError && <p className="mt-2 text-[13px] text-error">{uploadError}</p>}
          </Field>
        </section>

        <section aria-labelledby="ladder-h" className="space-y-6">
          <h2 id="ladder-h" className="font-display text-[24px]">
            2 · The ladder
          </h2>
          <Segmented
            name="rungs"
            label="Rungs"
            value={rungCount}
            onChange={setRungCount}
            options={[6, 7, 8, 9, 10].map((n) => ({ value: n, label: <span className="font-mono">{n}</span> }))}
          />
          <Toggle
            label="Start with the word"
            description="Rung 1 is the word itself, printed on a plain card."
            checked={startWithWord}
            onChange={setStartWithWord}
          />
        </section>

        <section aria-labelledby="session-h" className="space-y-6">
          <h2 id="session-h" className="font-display text-[24px]">
            3 · Session settings
          </h2>
          <Segmented
            name="view"
            label="Viewing"
            value={view}
            onChange={setView}
            options={[
              { value: "hold", label: "Hold to view" },
              { value: "steady", label: "Steady view" },
            ]}
          />
          <p className="-mt-3 text-[13px] text-muted">
            Hold-to-view lets the patient look only while pressing; each release is counted as an avoidance signal. Switch to
            steady view to remove that safety signal later in treatment.
          </p>
          <Segmented
            name="minutes"
            label="Exposure length"
            value={minutes}
            onChange={setMinutes}
            options={[1, 2, 3, 5].map((m) => ({ value: m, label: `${m} min` }))}
          />
          <Segmented
            name="mode"
            label="Progress mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "expectancy", label: "Expectancy" },
              { value: "habituation", label: "Habituation" },
            ]}
          />
          <p className="-mt-3 text-[13px] text-muted">
            {mode === "expectancy"
              ? "Suggest climbing when the predicted outcome didn't happen and the patient is willing."
              : "Suggest climbing when distress falls to half its peak, or to 30 or below."}
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-8">
          <Button type="submit" disabled={!canSubmit} className="h-12 px-7 text-[16px]">
            {submitting ? "Starting…" : "Generate ladder"}
          </Button>
          <p className="text-[13px] text-muted">
            {live === undefined
              ? "Checking live generation…"
              : live
                ? "About a minute. Rungs appear one by one."
                : "Live generation is off here; try a demo ladder above."}
          </p>
        </div>
      </form>
    </div>
  );
}

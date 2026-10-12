"use client";

import { ArrowRight, Cpu, Download, FileBarChart, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Segmented } from "@/components/controls";
import { Ladder } from "@/components/Ladder";
import { PipelineInspector } from "@/components/PipelineInspector";
import { RungDrawer } from "@/components/RungDrawer";
import { Sheet } from "@/components/Sheet";
import { Button, Eyebrow, LinkButton, buttonClass } from "@/components/ui";
import { DEMOS, demoId } from "@/lib/demo";
import { preloadImages } from "@/lib/images";
import { commitLadder, runnerFor, useHealth, useLadder } from "@/lib/live";
import { ensureDataUrl, mainRungs } from "@/lib/pipeline/buildLadder";
import type { Dials, Ladder as LadderT } from "@/lib/types";

function statusLine(l: LadderT): string | null {
  const main = mainRungs(l);
  const ready = main.filter((r) => r.status === "ready").length;
  switch (l.status) {
    case "planning":
      return "Planning the ladder: choosing one subject and spacing the rungs evenly…";
    case "anchoring":
      return "Creating the identity anchor so every rung shows the same subject…";
    case "rendering":
      return `Rendering and checking rungs · ${ready} of ${main.length} ready`;
    default:
      return null;
  }
}

async function exportLadder(l: LadderT) {
  const withImages: LadderT = {
    ...l,
    anchorImage: await ensureDataUrl(l.anchorImage, {}),
    rungs: await Promise.all(l.rungs.map(async (r) => ({ ...r, image: await ensureDataUrl(r.image, {}) }))),
  };
  const blob = new Blob([JSON.stringify(withImages, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `fear-ladder-${l.alias.replace(/\W+/g, "") || "patient"}-${l.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function LadderPage() {
  const { id } = useParams<{ id: string }>();
  const ladder = useLadder(id);
  const live = useHealth();
  const [openId, setOpenId] = useState<string | null>(null);
  const [inspector, setInspector] = useState(false);
  const [exporting, setExporting] = useState(false);
  const close = useCallback(() => setOpenId(null), []);
  const closeInspector = useCallback(() => setInspector(false), []);

  const openRung = useMemo(() => ladder?.rungs.find((r) => r.id === openId), [ladder, openId]);

  // Cards only load thumbnails; fetch the full-size images the drawer and session need in the background, rung 1 first.
  useEffect(() => {
    if (ladder) preloadImages([...mainRungs(ladder).map((r) => r.image), ladder.anchorImage]);
  }, [ladder]);

  if (ladder === undefined) {
    return (
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-24 text-muted sm:px-8">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> Opening ladder…
      </div>
    );
  }

  if (ladder === null) {
    const isDemo = id.startsWith("demo-");
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 sm:px-8">
        <h1 className="font-display text-[34px]">{isDemo ? "This demo ladder isn't available yet." : "Ladder not found."}</h1>
        <p className="mt-3 text-muted">
          {isDemo
            ? "The demo ladders are generated ahead of time by the same pipeline. Try another one, or build a new ladder."
            : "Ladders live only in the browser that created them. It may have been deleted, or created on another device."}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {DEMOS.filter((d) => demoId(d.slug) !== id).map((d) => (
            <Link key={d.slug} href={`/ladder/${demoId(d.slug)}`} className={buttonClass("secondary")}>
              Demo: {d.label}
            </Link>
          ))}
          <LinkButton href="/new">Build a ladder</LinkButton>
        </div>
      </div>
    );
  }

  const runner = () => runnerFor(ladder);
  const busy = ["planning", "anchoring", "rendering"].includes(ladder.status ?? "");
  const line = statusLine(ladder);
  const main = mainRungs(ladder);
  const readyCount = main.filter((r) => r.status === "ready").length;
  const failed = main.filter((r) => r.status === "error");

  const regenerate = (rid: string, dials: Dials) => {
    const r = runner();
    r.patchRung(rid, { dials });
    void r.renderRung(rid);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-10 sm:px-8 sm:pt-14">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Eyebrow>
            {ladder.source === "demo" ? "Demo ladder" : "Live ladder"} · patient {ladder.alias}
          </Eyebrow>
          <h1 className="font-display mt-3 text-[36px] leading-tight sm:text-[48px]">
            {ladder.subject.name ? `${ladder.subject.name[0].toUpperCase()}${ladder.subject.name.slice(1)}` : ladder.fear}{" "}
            <span className="text-muted">ladder</span>
          </h1>
          <p className="prose-measure mt-2 text-[15px] text-muted">&ldquo;{ladder.description}&rdquo;</p>
        </div>
        <div className="no-print flex flex-wrap gap-2 lg:max-w-[520px] lg:justify-end">
          <LinkButton href={`/ladder/${ladder.id}/session`} className={readyCount < 1 ? "pointer-events-none opacity-50" : ""} aria-disabled={readyCount < 1}>
            Start session <ArrowRight className="h-4 w-4" aria-hidden />
          </LinkButton>
          <LinkButton href={`/ladder/${ladder.id}/report`} variant="secondary">
            <FileBarChart className="h-4 w-4" aria-hidden /> Report
          </LinkButton>
          <Button variant="secondary" onClick={() => setInspector(true)}>
            <Cpu className="h-4 w-4" aria-hidden /> Under the hood
          </Button>
          <Button
            variant="ghost"
            disabled={exporting || busy}
            onClick={async () => {
              setExporting(true);
              try {
                await exportLadder(ladder);
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download className="h-4 w-4" aria-hidden /> {exporting ? "Exporting…" : "Export"}
          </Button>
        </div>
      </div>

      {line && (
        <p className="mt-6 flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-[14px] text-ink" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
          {line}
        </p>
      )}

      {(ladder.status === "error" || ladder.status === "refused") && (
        <div className="mt-6 rounded-[12px] border border-line bg-surface p-5" role="alert">
          <p className="font-medium text-ink">
            {ladder.status === "refused" ? "This request is outside what Fear Ladder is for." : "The ladder couldn't be finished."}
          </p>
          <p className="mt-1 text-[15px] text-muted">{ladder.error}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href="/new" variant="secondary">
              Back to the builder
            </LinkButton>
            {DEMOS.map((d) => (
              <Link key={d.slug} href={`/ladder/${demoId(d.slug)}`} className={buttonClass("ghost")}>
                Demo: {d.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          {main.length === 0 && busy ? (
            <div className="space-y-3 px-3 sm:px-6" aria-hidden>
              {Array.from({ length: ladder.request?.rungCount ?? 9 }, (_, i) => (
                <div key={i} className="loading-sheen h-[104px] rounded-[12px] sm:h-[152px]" />
              ))}
            </div>
          ) : (
            <Ladder ladder={ladder} onOpen={setOpenId} />
          )}
          {failed.length > 0 && !busy && live && (
            <div className="mt-4 flex flex-wrap items-center gap-3 px-3 text-[14px] text-muted sm:px-6">
              {failed.length} rung{failed.length > 1 ? "s" : ""} need{failed.length > 1 ? "" : "s"} another try.
              <Button
                variant="secondary"
                onClick={() => {
                  const r = runner();
                  failed.forEach((f) => void r.renderRung(f.id));
                }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden /> Regenerate failed rungs
              </Button>
            </div>
          )}
        </div>

        <aside className="no-print space-y-8 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[12px] border border-line bg-surface p-5">
            <Eyebrow>Subject on every rung</Eyebrow>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              {ladder.subject.canonical || <span className="text-muted">Chosen by the planner…</span>}
            </p>
          </div>
          <div className="space-y-5 rounded-[12px] border border-line bg-surface p-5">
            <Eyebrow>Session settings</Eyebrow>
            <Segmented
              name="view"
              label="Viewing"
              value={ladder.settings.view}
              onChange={(v) => commitLadder({ ...ladder, settings: { ...ladder.settings, view: v } })}
              options={[
                { value: "hold", label: "Hold" },
                { value: "steady", label: "Steady" },
              ]}
            />
            <Segmented
              name="mode"
              label="Progress mode"
              value={ladder.settings.mode}
              onChange={(v) => commitLadder({ ...ladder, settings: { ...ladder.settings, mode: v } })}
              options={[
                { value: "expectancy", label: "Expectancy" },
                { value: "habituation", label: "Habituation" },
              ]}
            />
            <p className="text-[13px] text-muted">
              Exposure length: <span className="font-mono">{Math.round(ladder.settings.exposureSeconds / 60)} min</span>, shown
              as time looked, never a countdown.
            </p>
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            Tap any image to reveal it. Open a rung to adjust its dials, regenerate it, or add a variation at the same intensity.
          </p>
        </aside>
      </div>

      <Sheet open={Boolean(openRung)} onClose={close} title={openRung ? `Rung ${openRung.index} · ${openRung.title}` : ""}>
        {openRung && (
          <RungDrawer
            key={openRung.id + openRung.status}
            ladder={ladder}
            rung={openRung}
            live={Boolean(live)}
            onRegenerate={(d) => regenerate(openRung.id, d)}
            onVariation={(ctx) => void runner().addVariation(openRung.id, ctx)}
            onDelete={() => {
              runner().deleteRung(openRung.id);
              setOpenId(null);
            }}
          />
        )}
      </Sheet>

      <Sheet open={inspector} onClose={closeInspector} title="Under the hood · Pipeline Inspector" wide>
        <PipelineInspector ladder={ladder} />
      </Sheet>
    </div>
  );
}

"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Ladder } from "@/components/Ladder";
import { PipelineInspector } from "@/components/PipelineInspector";
import { RungDrawer } from "@/components/RungDrawer";
import { Sheet } from "@/components/Sheet";
import { Button, LinkButton } from "@/components/ui";
import { DEMOS, demoId } from "@/lib/demo";
import { runnerFor, useHealth, useLadder } from "@/lib/live";
import { mainRungs, variationsOf } from "@/lib/pipeline/buildLadder";
import type { Ladder as LadderT } from "@/lib/types";

const TITLE = "text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[48px]";
const PAGE = "mx-auto w-full max-w-[1100px] px-4 pb-24 pt-4 sm:px-8 sm:pt-8";

/** One quiet line and a progress fraction while the ladder is being built. */
function buildProgress(l: LadderT): { label: string; value: number } | null {
  const main = mainRungs(l);
  switch (l.status) {
    case "planning":
      return { label: "Planning your ladder…", value: 0.06 };
    case "anchoring":
      return { label: "Setting up the subject…", value: 0.14 };
    case "rendering": {
      const total = main.length || 1;
      const done = main.filter((r) => r.status === "ready" || r.status === "error").length;
      return { label: `Drawing step ${Math.min(done + 1, total)} of ${total}…`, value: 0.18 + 0.82 * (done / total) };
    }
    default:
      return null;
  }
}

function BackLink() {
  return (
    <Link
      href="/"
      className="-ml-1 inline-flex h-10 items-center gap-1.5 px-1 text-[15px] text-muted transition-colors duration-150 hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Home
    </Link>
  );
}

export default function LadderPage() {
  const { id } = useParams<{ id: string }>();
  const ladder = useLadder(id);
  const live = useHealth() === true;
  const [openId, setOpenId] = useState<string | null>(null);
  // Keeps the lightbox content in place while it animates closed.
  const [shownId, setShownId] = useState<string | null>(null);
  const [inspector, setInspector] = useState(false);
  const open = useCallback((rid: string) => {
    setOpenId(rid);
    setShownId(rid);
  }, []);
  const close = useCallback(() => setOpenId(null), []);
  const closeInspector = useCallback(() => setInspector(false), []);

  if (ladder === undefined) {
    return (
      <div className={PAGE} aria-busy="true">
        <BackLink />
        <div className="loading-sheen mt-8 h-10 w-44 rounded-xl sm:h-12" />
        <div className="loading-sheen mt-4 h-4 w-64 max-w-full rounded-full" />
        <div className="mt-12 grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="loading-sheen aspect-square w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (ladder === null) {
    const isDemo = id.startsWith("demo-");
    return (
      <div className={PAGE}>
        <BackLink />
        <h1 className={`mt-8 ${TITLE}`}>{isDemo ? "This demo isn’t ready." : "This ladder isn’t here."}</h1>
        <p className="mt-3 text-[16px] text-muted">
          {isDemo ? "Try another one, or build your own." : "Ladders stay in the browser that made them."}
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <LinkButton href="/new">Build your own</LinkButton>
          {DEMOS.filter((d) => demoId(d.slug) !== id).map((d) => (
            <LinkButton key={d.slug} href={`/ladder/${demoId(d.slug)}`} variant="secondary">
              {d.label}
            </LinkButton>
          ))}
        </div>
      </div>
    );
  }

  const runner = () => runnerFor(ladder);
  const main = mainRungs(ladder);
  const progress = buildProgress(ladder);
  const failed = ladder.status === "error" || ladder.status === "refused";
  const ready = main.some((r) => r.status === "ready");
  const steps = main.length || ladder.request?.rungCount || 9;
  const showGrid = !failed || main.some((r) => r.image);
  // A build that failed before any step was drawn: show only the calm error block.
  const empty = failed && !showGrid;
  const shownRung = shownId ? ladder.rungs.find((r) => r.id === shownId) : undefined;
  const isOpen = Boolean(openId && shownRung);

  return (
    <div className={PAGE}>
      <BackLink />

      <div className="mt-6 flex flex-col gap-7 sm:mt-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className={`min-w-0 break-words ${TITLE}`}>{ladder.fear}</h1>
            {ladder.source === "demo" && (
              <span className="rounded-full bg-subtle px-2.5 py-1 text-[13px] font-medium text-muted">Demo</span>
            )}
          </div>
          {!empty && (
            <p className="mt-3 text-[16px] text-muted">
              <span className="tabular">{steps}</span> steps, from a word to the real thing.
            </p>
          )}
        </div>

        <div className={`no-print flex flex-wrap items-center gap-2 ${empty ? "hidden" : ""}`}>
          {ready ? (
            <LinkButton href={`/ladder/${ladder.id}/session`}>Start</LinkButton>
          ) : (
            <Button disabled>Start</Button>
          )}
          <LinkButton href={`/ladder/${ladder.id}/report`} variant="secondary">
            Report
          </LinkButton>
          <Button variant="ghost" onClick={() => setInspector(true)}>
            How it was made
          </Button>
        </div>
      </div>

      {progress && (
        <div className="mt-10" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-[14px] text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
            {progress.label}
          </p>
          <div className="mt-3 h-[2px] w-full overflow-hidden rounded-full bg-subtle">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out"
              style={{ width: `${Math.round(progress.value * 100)}%` }}
            />
          </div>
        </div>
      )}

      {failed && (
        <div className="mt-10 rounded-3xl bg-subtle p-6 sm:p-8" role="alert">
          <p className="text-[17px] font-medium text-ink">
            {ladder.status === "refused" ? "This one is outside what Fear Ladder can draw." : "We couldn’t build this ladder."}
          </p>
          {ladder.error && <p className="mt-1.5 max-w-[60ch] text-[15px] text-muted">{ladder.error}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            <LinkButton href="/new">Try again</LinkButton>
            {DEMOS.map((d) => (
              <LinkButton
                key={d.slug}
                href={`/ladder/${demoId(d.slug)}`}
                variant="ghost"
                aria-label={`Open the ${d.label.toLowerCase()} demo`}
              >
                {d.label} demo
              </LinkButton>
            ))}
          </div>
        </div>
      )}

      {showGrid && (
        <div className={progress ? "mt-8" : "mt-12"}>
          <Ladder
            ladder={ladder}
            live={live}
            placeholders={progress ? (ladder.request?.rungCount ?? 9) : 0}
            onOpen={open}
            onRetry={(rid) => void runner().renderRung(rid)}
          />
        </div>
      )}

      <Sheet
        open={isOpen}
        onClose={close}
        title={shownRung ? `Step ${shownRung.index}: ${shownRung.title}` : "Step"}
        reserve={shownRung && variationsOf(ladder, shownRung.id).length > 0 ? 410 : 340}
      >
        {shownRung && (
          <RungDrawer
            key={shownRung.id}
            ladder={ladder}
            rung={shownRung}
            live={live}
            onRedraw={(rid) => void runner().renderRung(rid)}
            onVariation={(pid) => void runner().addVariation(pid)}
          />
        )}
      </Sheet>

      <Sheet open={inspector} onClose={closeInspector} title="How it was made" variant="panel">
        <PipelineInspector ladder={ladder} />
      </Sheet>
    </div>
  );
}

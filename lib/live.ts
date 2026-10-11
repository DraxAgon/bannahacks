"use client";

import { useEffect, useState } from "react";
import { demoId, fetchDemoLadder } from "./demo";
import { LadderRunner } from "./pipeline/buildLadder";
import { getLadder, saveLadder } from "./store";
import type { Ladder, PlanRequest } from "./types";

/**
 * Module-level registry so generation keeps running across client-side navigation
 * (the builder starts a build, the ladder view watches it fill in).
 */
const runners = new Map<string, LadderRunner>();
const subs = new Map<string, Set<(l: Ladder) => void>>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function persist(l: Ladder, immediate = false) {
  const t = saveTimers.get(l.id);
  if (t) clearTimeout(t);
  if (immediate) {
    saveTimers.delete(l.id);
    void saveLadder(l);
    return;
  }
  saveTimers.set(
    l.id,
    setTimeout(() => {
      saveTimers.delete(l.id);
      void saveLadder(l);
    }, 350),
  );
}

function emit(l: Ladder) {
  const settled = l.status === "ready" || l.status === "error" || l.status === "refused";
  persist(l, settled);
  subs.get(l.id)?.forEach((fn) => fn(l));
}

export function runnerFor(ladder: Ladder): LadderRunner {
  let r = runners.get(ladder.id);
  if (!r) {
    r = new LadderRunner(ladder, {}, emit);
    runners.set(ladder.id, r);
  }
  return r;
}

export function startBuild(ladder: Ladder, request: PlanRequest, upload?: string) {
  const runner = new LadderRunner(ladder, {}, emit);
  runners.set(ladder.id, runner);
  persist(ladder, true);
  void runner.build(request, upload);
  return runner;
}

/** Replace a ladder from outside the runner (settings edits, dial edits). */
export function commitLadder(l: Ladder) {
  const r = runners.get(l.id);
  if (r) r.ladder = l;
  emit(l);
}

export function subscribe(id: string, fn: (l: Ladder) => void) {
  if (!subs.has(id)) subs.set(id, new Set());
  subs.get(id)!.add(fn);
  return () => {
    subs.get(id)?.delete(fn);
  };
}

export function isRunning(id: string) {
  return runners.has(id);
}

/** Load a ladder: live runner state → IndexedDB → bundled demo. */
export async function loadLadder(id: string): Promise<Ladder | null> {
  const live = runners.get(id);
  if (live) return live.ladder;
  const stored = await getLadder(id);
  if (stored) {
    // A build that was interrupted by a reload can't resume mid-request; mark it for regeneration.
    const interrupted = stored.rungs.some((r) => r.status === "generating" || r.status === "pending");
    if (interrupted || ["planning", "anchoring", "rendering"].includes(stored.status ?? "")) {
      const fixed: Ladder = {
        ...stored,
        status: stored.rungs.length ? "ready" : "error",
        error: stored.rungs.length ? undefined : "This build was interrupted. Please build the ladder again.",
        rungs: stored.rungs.map((r) =>
          r.status === "generating" || r.status === "pending"
            ? { ...r, status: "error", error: "Generation was interrupted. Regenerate this rung." }
            : r,
        ),
      };
      await saveLadder(fixed);
      return fixed;
    }
    return stored;
  }
  if (id.startsWith("demo-")) {
    const demo = await fetchDemoLadder(id.slice(5));
    if (demo) {
      const l = { ...demo, id: demoId(id.slice(5)), createdAt: new Date().toISOString() };
      await saveLadder(l);
      return l;
    }
  }
  return null;
}

export function useLadder(id: string) {
  const [ladder, setLadder] = useState<Ladder | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadLadder(id).then((l) => alive && setLadder(l));
    const off = subscribe(id, (l) => alive && setLadder(l));
    return () => {
      alive = false;
      off();
    };
  }, [id]);
  return ladder;
}

let healthCache: Promise<{ live: boolean }> | null = null;
export function useHealth() {
  const [live, setLive] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    healthCache ??= fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => ({ live: false }));
    let alive = true;
    healthCache.then((h) => alive && setLive(Boolean(h.live)));
    return () => {
      alive = false;
    };
  }, []);
  return live;
}

/**
 * Client-side orchestrator. The browser (or the seed script) drives generation:
 * /api/plan once, /api/anchor once, then /api/rung + /api/critique per rung with a
 * concurrency limit of 3. Each route makes one model call, so functions stay short and
 * rungs appear one by one.
 */
import type { Attempt, Critique, Dials, Ladder, LadderSettings, PlanRequest, PostParams, Rung } from "../types";
import { midDials } from "./dials";

export type Api = { base?: string; fetch?: typeof fetch };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public payload: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function postJson<T>(api: Api, path: string, body: unknown): Promise<T> {
  const f = api.fetch ?? fetch;
  let res: Response;
  try {
    res = await f(`${api.base ?? ""}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check the connection and try again.", 0, "network", {});
  }
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON (e.g. platform timeout page)
  }
  if (!res.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : res.status === 504
          ? "This step took too long. Please try again."
          : "Something went wrong.";
    throw new ApiError(message, res.status, String(data.error ?? "error"), data);
  }
  return data as T;
}

export function newId(prefix = ""): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix + rnd;
}

/** Ensure an image reference is a base64 data URL (demo ladders store public paths). */
export async function ensureDataUrl(src: string | undefined, api: Api): Promise<string | undefined> {
  if (!src || src.startsWith("data:")) return src;
  const f = api.fetch ?? fetch;
  const res = await f(src.startsWith("http") ? src : `${api.base ?? ""}${src}`);
  const buf = await res.arrayBuffer();
  const type = res.headers.get("content-type") || "image/jpeg";
  if (typeof Buffer !== "undefined") return `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}

export const mainRungs = (l: Ladder) => l.rungs.filter((r) => r.kind !== "variation");
export const variationsOf = (l: Ladder, id: string) => l.rungs.filter((r) => r.kind === "variation" && r.parentId === id);

function renumber(rungs: Rung[]): Rung[] {
  let i = 0;
  const idx = new Map<string, number>();
  const out = rungs.map((r) => {
    if (r.kind === "variation") return r;
    i += 1;
    idx.set(r.id, i);
    return { ...r, index: i };
  });
  return out.map((r) => (r.kind === "variation" && r.parentId ? { ...r, index: idx.get(r.parentId) ?? r.index } : r));
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

type RungResponse = { image: string; prompt: string; post: PostParams; attempts: Attempt[] };
type CritiqueResponse = { critique: Critique; model: string; attempts: Attempt[] };
type PlanResponse = {
  refused: boolean;
  reason?: string;
  subject: { name: string; canonical: string };
  rungs: Omit<Rung, "id" | "index" | "attempts" | "status" | "kind">[];
  warnings?: string[];
  raw?: string;
  retried?: boolean;
  attempts: Attempt[];
};

export class LadderRunner {
  constructor(
    public ladder: Ladder,
    private api: Api,
    private emit: (l: Ladder) => void,
  ) {}

  update(fn: (l: Ladder) => Ladder) {
    this.ladder = fn(this.ladder);
    this.emit(this.ladder);
  }

  patchRung(id: string, patch: Partial<Rung> | ((r: Rung) => Partial<Rung>)) {
    this.update((l) => ({
      ...l,
      rungs: l.rungs.map((r) => (r.id === id ? { ...r, ...(typeof patch === "function" ? patch(r) : patch) } : r)),
    }));
  }

  rung(id: string) {
    return this.ladder.rungs.find((r) => r.id === id);
  }

  /** Full build: plan → anchor → rungs. */
  async build(request: PlanRequest, upload?: string) {
    this.update((l) => ({ ...l, status: "planning", error: undefined }));
    let plan: PlanResponse;
    try {
      plan = await postJson<PlanResponse>(this.api, "/api/plan", request);
    } catch (e) {
      const err = e as ApiError;
      this.update((l) => ({
        ...l,
        status: "error",
        error: err.message,
        planAttempts: (err.payload?.attempts as Attempt[]) ?? l.planAttempts,
      }));
      return;
    }
    if (plan.refused) {
      this.update((l) => ({ ...l, status: "refused", error: plan.reason, planAttempts: plan.attempts }));
      return;
    }
    this.update((l) => ({
      ...l,
      subject: plan.subject,
      plan: { subject: plan.subject, rungs: plan.rungs, warnings: plan.warnings, retried: plan.retried },
      planAttempts: plan.attempts,
      status: "anchoring",
      rungs: renumber(
        plan.rungs.map((r) => ({
          ...r,
          id: newId("r"),
          index: 0,
          attempts: [],
          status: "pending" as const,
          kind: "planned" as const,
        })),
      ),
    }));

    try {
      const anchor = await postJson<{ image: string; source: "generated" | "upload"; attempts: Attempt[] }>(
        this.api,
        "/api/anchor",
        { subject: plan.subject, preset: request.preset, upload },
      );
      this.update((l) => ({
        ...l,
        anchorImage: anchor.image,
        anchorSource: anchor.source,
        anchorAttempts: anchor.attempts,
        status: "rendering",
      }));
    } catch (e) {
      const err = e as ApiError;
      this.update((l) => ({
        ...l,
        status: "error",
        error: `Couldn't create the identity anchor: ${err.message}`,
        anchorAttempts: (err.payload?.attempts as Attempt[]) ?? [],
      }));
      return;
    }

    await pool(
      this.ladder.rungs.map((r) => r.id),
      3,
      (id) => this.renderRung(id),
    );
    this.update((l) => ({ ...l, status: "ready" }));
  }

  /** Neighbour targets used for the order check. */
  private bounds(r: Rung): { prev: number; next: number } {
    const main = mainRungs(this.ladder);
    const ref = r.kind === "variation" ? main.find((m) => m.id === r.parentId) ?? r : r;
    const p = main.findIndex((m) => m.id === ref.id);
    return { prev: main[p - 1]?.targetSuds ?? 0, next: main[p + 1]?.targetSuds ?? 100 };
  }

  /**
   * Stages 3–5 for one rung, with auto-repair:
   * unsafe → regenerate with stronger safety wording (drop after 2 unsafe drafts);
   * identity < 0.6 or intensity out of order by > 10 → regenerate once, keep the better draft.
   */
  async renderRung(id: string, opts: { individual?: string } = {}) {
    const start = this.rung(id);
    if (!start) return;
    this.patchRung(id, { status: "generating", error: undefined });

    const anchor = await ensureDataUrl(this.ladder.anchorImage, this.api).catch(() => undefined);
    const fear = `fear of ${this.ladder.subject.name || this.ladder.fear}`;
    let safetyBoost = false;
    let unsafeCount = 0;
    let repairUsed = false;
    let hint: "gentler" | "stronger" | undefined;
    let best: { image: string; critique: Critique; prompt: string; post: PostParams; score: number } | null = null;

    for (let round = 0; round < 5; round++) {
      const r = this.rung(id);
      if (!r) return; // deleted while generating
      const wordCard = r.dials.realism < 0.125;

      let gen: RungResponse;
      try {
        gen = await postJson<RungResponse>(this.api, "/api/rung", {
          subject: this.ladder.subject,
          dials: r.dials,
          scene: r.scene,
          anchor: wordCard ? undefined : anchor,
          preset: this.ladder.preset,
          safetyBoost,
          intensityHint: hint,
          individual: opts.individual,
        });
      } catch (e) {
        const err = e as ApiError;
        this.patchRung(id, (cur) => ({
          status: best ? "ready" : "error",
          error: best ? undefined : err.message,
          attempts: [...cur.attempts, ...((err.payload?.attempts as Attempt[]) ?? [])],
          ...(best ? { image: best.image, critique: best.critique, prompt: best.prompt, post: best.post } : {}),
        }));
        return;
      }
      this.patchRung(id, (cur) => ({ attempts: [...cur.attempts, ...gen.attempts] }));

      let crit: CritiqueResponse;
      try {
        crit = await postJson<CritiqueResponse>(this.api, "/api/critique", {
          subject: this.ladder.subject,
          fear,
          anchor: wordCard ? undefined : anchor,
          image: gen.image,
          targetSuds: r.targetSuds,
          mode: opts.individual ? "kind" : "identity",
          isWordCard: wordCard,
        });
      } catch (e) {
        const err = e as ApiError;
        // Unsafe images are never shown, so an unchecked image is not shown either.
        this.patchRung(id, (cur) => ({
          status: best ? "ready" : "error",
          error: best ? undefined : `The safety check couldn't run (${err.message}). Regenerate to try again.`,
          attempts: [...cur.attempts, ...((err.payload?.attempts as Attempt[]) ?? [])],
          ...(best ? { image: best.image, critique: best.critique, prompt: best.prompt, post: best.post } : {}),
        }));
        return;
      }
      const c = crit.critique;
      const critAttempts = crit.attempts.map((a, i) => (i === crit.attempts.length - 1 ? { ...a, critique: c } : a));
      this.patchRung(id, (cur) => ({ attempts: [...cur.attempts, ...critAttempts] }));

      if (c.unsafe) {
        unsafeCount += 1;
        if (unsafeCount >= 2) {
          this.patchRung(id, {
            status: "error",
            error: "Dropped after two drafts failed the safety check. Adjust the scene or dials, then regenerate.",
            image: undefined,
            critique: undefined,
          });
          return;
        }
        safetyBoost = true;
        continue;
      }

      const { prev, next } = this.bounds(r);
      const tooGentle = c.intensity < prev - 10;
      const tooStrong = c.intensity > next + 10;
      const identityLow = !c.subjectPresent || (!wordCard && c.identityMatch < 0.6);
      const score = (identityLow ? 40 : 0) + Math.max(0, prev - 10 - c.intensity) + Math.max(0, c.intensity - next - 10);
      const candidate = { image: gen.image, critique: c, prompt: gen.prompt, post: gen.post, score };

      if ((identityLow || tooGentle || tooStrong) && !repairUsed) {
        repairUsed = true;
        best = candidate;
        hint = tooStrong ? "gentler" : tooGentle ? "stronger" : undefined;
        continue;
      }
      const chosen = best && best.score < candidate.score ? best : candidate;
      this.patchRung(id, {
        status: "ready",
        image: chosen.image,
        critique: chosen.critique,
        prompt: chosen.prompt,
        post: chosen.post,
        error: undefined,
      });
      return;
    }
    // Ran out of rounds (only reachable through repeated repairs): keep the best safe draft.
    this.patchRung(id, best ? { status: "ready", ...best } : { status: "error", error: "Couldn't produce a usable image." });
  }

  /** Stage 6: insert a half-step rung below the rung where the patient got stuck. */
  async addHalfStep(stuckId: string, dialsOverride?: Dials): Promise<string | undefined> {
    const main = mainRungs(this.ladder);
    const k = main.findIndex((r) => r.id === stuckId);
    if (k < 0) return;
    const stuck = main[k];
    const lower = main[k - 1];
    const dials =
      dialsOverride ??
      (lower
        ? midDials(lower.dials, stuck.dials)
        : { ...stuck.dials, clarity: stuck.dials.clarity * 0.6, size: stuck.dials.size * 0.6, proximity: stuck.dials.proximity * 0.6 });
    const target = Math.round(((lower?.targetSuds ?? 0) + stuck.targetSuds) / 2);
    const rung: Rung = {
      id: newId("h"),
      index: 0,
      title: `A smaller step toward “${stuck.title}”`,
      rationale: dialsOverride
        ? `Added live: distress stayed high on rung ${stuck.index}; the fear model chose dials it predicts will land near SUDS ${target}.`
        : `Added live: distress stayed high on rung ${stuck.index}; this step sits halfway between rung ${lower?.index ?? 0} and ${stuck.index}.`,
      targetSuds: target,
      dials,
      scene: stuck.scene,
      noticePrompts: stuck.noticePrompts,
      attempts: [],
      status: "pending",
      kind: "half-step",
      parentId: stuck.id,
    };
    this.update((l) => {
      const at = l.rungs.findIndex((r) => r.id === stuckId);
      const rungs = [...l.rungs];
      rungs.splice(at, 0, rung);
      return { ...l, rungs: renumber(rungs) };
    });
    await this.renderRung(rung.id);
    return rung.id;
  }

  /** Stage 6: same intensity, different individual and setting (stimulus variability, multiple contexts). */
  async addVariation(parentId: string, context?: string): Promise<string | undefined> {
    const parent = this.rung(parentId);
    if (!parent) return;
    const placeholderId = newId("v");
    const placeholder: Rung = {
      ...parent,
      id: placeholderId,
      title: `${parent.title} · variation`,
      rationale: `Same intensity as rung ${parent.index}, different individual${context ? ` in a ${context}` : " and setting"}, for generalization.`,
      image: undefined,
      critique: undefined,
      prompt: undefined,
      post: undefined,
      attempts: [],
      status: "generating",
      kind: "variation",
      parentId: parent.id,
    };
    this.update((l) => {
      const siblings = variationsOf(l, parent.id);
      const anchorId = siblings.length ? siblings[siblings.length - 1].id : parent.id;
      const at = l.rungs.findIndex((r) => r.id === anchorId);
      const rungs = [...l.rungs];
      rungs.splice(at + 1, 0, placeholder);
      return { ...l, rungs: renumber(rungs) };
    });
    try {
      const avoid = [parent.scene, ...variationsOf(this.ladder, parent.id).map((v) => v.scene)].slice(0, 10);
      const v = await postJson<{ individual: string; scene: string; noticePrompts: string[]; attempts: Attempt[] }>(
        this.api,
        "/api/variation",
        {
          subject: this.ladder.subject,
          fear: `fear of ${this.ladder.subject.name}`,
          scene: parent.scene,
          title: parent.title,
          avoid,
          context,
        },
      );
      this.patchRung(placeholderId, {
        scene: v.scene,
        noticePrompts: v.noticePrompts.slice(0, 3),
        attempts: v.attempts,
        rationale: `${placeholder.rationale} Individual: ${v.individual}.`,
      });
      await this.renderRung(placeholderId, { individual: v.individual });
    } catch (e) {
      this.patchRung(placeholderId, { status: "error", error: (e as Error).message });
    }
    return placeholderId;
  }

  deleteRung(id: string) {
    this.update((l) => ({
      ...l,
      rungs: renumber(l.rungs.filter((r) => r.id !== id && !(r.kind === "variation" && r.parentId === id))),
    }));
  }
}

export function emptyLadder(opts: {
  id?: string;
  alias: string;
  fear: string;
  preset: PlanRequest["preset"];
  description: string;
  settings: LadderSettings;
  request: PlanRequest;
}): Ladder {
  return {
    id: opts.id ?? newId("l"),
    createdAt: new Date().toISOString(),
    alias: opts.alias,
    fear: opts.fear,
    preset: opts.preset,
    description: opts.description,
    subject: { name: "", canonical: "" },
    rungs: [],
    settings: opts.settings,
    source: "live",
    request: opts.request,
    status: "planning",
  };
}

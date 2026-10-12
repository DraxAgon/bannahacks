/**
 * Builds the demo ladders through the real pipeline (plan → anchor → rungs → critic)
 * and writes them to public/demo/{slug}/: ladder.json, anchor.jpg, rung-N.jpg, plus a
 * rung-N.thumb.webp beside each image for the cards.
 *
 * The script calls the app's own API routes, so it needs a running server with a key:
 *   npm run dev            # with GEMINI_API_KEY in .env.local
 *   npm run seed           # all three demos
 *   npm run seed -- spiders
 * Or point it at a deployment whose env has the key (the key never touches this machine):
 *   SEED_BASE_URL=https://your-app.vercel.app npm run seed -- spiders
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CritiqueSchema } from "../lib/ai/schemas";
import { DEMOS } from "../lib/demo";
import { emptyLadder, LadderRunner } from "../lib/pipeline/buildLadder";
import type { Ladder, PlanRequest } from "../lib/types";
import { writeThumbs } from "./thumbs";

const BASE = process.env.SEED_BASE_URL ?? "http://localhost:3000";
const LABELS: Record<string, string> = { spiders: "Spiders", dogs: "Dogs", needles: "Needles" };

function writeDataUrl(path: string, dataUrl: string) {
  const b64 = dataUrl.split(",")[1];
  writeFileSync(path, Buffer.from(b64, "base64"));
}

async function seed(slug: "spiders" | "dogs" | "needles", description: string) {
  const request: PlanRequest = {
    preset: slug,
    description,
    rungCount: 9,
    startWithWord: true,
  };
  const ladder = emptyLadder({
    id: `demo-${slug}`,
    alias: "Demo",
    fear: LABELS[slug],
    preset: slug,
    description,
    settings: { view: "hold", exposureSeconds: 120, mode: "expectancy" },
    request,
  });

  let lastLine = "";
  const runner = new LadderRunner(ladder, { base: BASE }, (l) => {
    const line = `${slug}: ${l.status} · ${l.rungs.map((r) => (r.status === "ready" ? "■" : r.status === "error" ? "×" : r.status === "generating" ? "◐" : "□")).join("")}`;
    if (line !== lastLine) console.log(line);
    lastLine = line;
  });
  const t0 = Date.now();
  await runner.build(request);
  const built = runner.ladder;
  if (built.status !== "ready") throw new Error(`${slug}: ${built.status} — ${built.error}`);

  // Retry any rung that failed once more before giving up.
  for (const r of built.rungs.filter((x) => x.status === "error")) {
    console.log(`${slug}: retrying rung ${r.index} (${r.error})`);
    await runner.renderRung(r.id);
  }
  const final = runner.ladder;

  // Every critic response must validate.
  for (const r of final.rungs) {
    if (r.status !== "ready") continue;
    const ok = CritiqueSchema.safeParse(r.critique).success;
    if (!ok) throw new Error(`${slug}: rung ${r.index} critique failed validation`);
  }

  const dir = join("public", "demo", slug);
  mkdirSync(dir, { recursive: true });
  const out: Ladder = { ...final, source: "demo", alias: "Demo" };
  if (final.anchorImage) {
    writeDataUrl(join(dir, "anchor.jpg"), final.anchorImage);
    out.anchorImage = `/demo/${slug}/anchor.jpg`;
  }
  out.rungs = final.rungs.map((r) => {
    if (!r.image) return r;
    const file = `rung-${r.index}${r.kind === "variation" ? `-${r.id}` : ""}.jpg`;
    writeDataUrl(join(dir, file), r.image);
    return { ...r, image: `/demo/${slug}/${file}` };
  });
  writeFileSync(join(dir, "ladder.json"), JSON.stringify(out, null, 2));
  await writeThumbs(dir);

  const ready = out.rungs.filter((r) => r.status === "ready").length;
  console.log(`${slug}: saved ${ready}/${out.rungs.length} rungs to ${dir} in ${Math.round((Date.now() - t0) / 1000)}s`);
  for (const r of out.rungs) {
    console.log(
      `  ${String(r.index).padStart(2)} target ${String(r.targetSuds).padStart(3)} · est ${String(r.critique?.intensity ?? "—").padStart(3)} · id ${r.critique ? Math.round(r.critique.identityMatch * 100) + "%" : "—"} · ${r.status} · ${r.title}`,
    );
  }
}

async function main() {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health?.live) {
    console.error(`No live pipeline at ${BASE} (health: ${JSON.stringify(health)}). Start the app with GEMINI_API_KEY set.`);
    process.exit(1);
  }
  const only = process.argv.slice(2);
  for (const d of DEMOS) {
    if (only.length && !only.includes(d.slug)) continue;
    await seed(d.slug, d.description);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

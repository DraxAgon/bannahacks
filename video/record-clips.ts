/**
 * Records real app clips at phone size for the promo reel (video/out/clips/*.webm)
 * plus a timing log, so the composition can cut on real events.
 * Usage: BASE_URL=http://localhost:3000 PW_CHROMIUM=/opt/pw-browsers/chromium npx tsx video/record-clips.ts [clip...]
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "video/out/clips";
mkdirSync(OUT, { recursive: true });

// Visible touch indicator so viewers can see presses (recording only, not part of the app).
const touchScript = () => {
  const add = () => {
    const s = document.createElement("style");
    s.textContent = `.__t{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,253,248,.35);border:2px solid rgba(255,253,248,.9);box-shadow:0 2px 12px rgba(0,0,0,.25);pointer-events:none;z-index:2147483647;opacity:0;transition:opacity .18s, transform .18s}`;
    document.head.appendChild(s);
    const d = document.createElement("div");
    d.className = "__t";
    document.body.appendChild(d);
    const at = (e: PointerEvent) => { d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; };
    addEventListener("pointerdown", (e) => { at(e); d.style.opacity = "1"; d.style.transform = "scale(.82)"; }, true);
    addEventListener("pointermove", at, true);
    addEventListener("pointerup", () => { d.style.opacity = "0"; d.style.transform = "scale(1)"; }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", add); else add();
};

type Marks = Record<string, number>;

/**
 * Records via Chrome's screencast (CDP): each frame arrives with a timestamp, and ffmpeg
 * turns the timed frames into a constant-30fps video.
 */
async function record(
  browser: Browser,
  name: string,
  run: (page: Page, mark: (k: string) => void) => Promise<void>,
  touch = false,
) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: touch });
  await ctx.addInitScript(touchScript);
  const page = await ctx.newPage();
  const dir = `${OUT}/${name}-frames`;
  mkdirSync(dir, { recursive: true });
  const frames: { file: string; ts: number }[] = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", (f) => {
    const file = `${dir}/${String(frames.length).padStart(5, "0")}.jpg`;
    writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, ts: f.metadata.timestamp ?? Date.now() / 1000 });
    void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  const marks: Marks = {};
  const mark = (k: string) => { marks[k] = Date.now() / 1000 - t0; console.log(name, k, marks[k].toFixed(2)); };
  await run(page, mark);
  mark("end");
  await page.waitForTimeout(300);
  const stopAt = Date.now() / 1000; // the screencast only sends frames on change, so hold the last one until here
  await cdp.send("Page.stopScreencast").catch(() => {});
  await ctx.close();
  // Concat list with real per-frame durations; times are relative to the first frame.
  const start = frames[0]?.ts ?? t0;
  const lines: string[] = [];
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.ts ?? Math.max(f.ts + 0.5, stopAt);
    lines.push(`file '${f.file.split("/").pop()}'`, `duration ${Math.max(0.001, next - f.ts).toFixed(4)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file.split("/").pop()}'`);
  writeFileSync(`${dir}/list.txt`, lines.join("\n"));
  execSync(
    `ffmpeg -y -loglevel error -f concat -safe 0 -i list.txt -vf "fps=30,scale=780:1688:flags=lanczos,format=yuv420p" -c:v libx264 -crf 18 -preset medium ../${name}.mp4`,
    { cwd: dir },
  );
  const offset = start - t0; // marks are relative to t0; video time = mark - offset
  const rel = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, Math.round((v - offset) * 100) / 100]));
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(rel, null, 2));
  console.log(name, "frames", frames.length, "->", `${OUT}/${name}.mp4`, rel);
}

async function tap(page: Page, locator: ReturnType<Page["locator"]>, hold = 120) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const b = await locator.boundingBox();
  if (!b) throw new Error("no box");
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.down();
  await page.waitForTimeout(hold);
  await page.mouse.up();
}

/** A finger tap (pointerType "touch"), so tiles reveal instead of reacting to hover. */
async function touchTap(page: Page, locator: ReturnType<Page["locator"]>) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const b = await locator.boundingBox();
  if (!b) throw new Error("no box");
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

async function smoothScroll(page: Page, dy: number, ms: number) {
  const steps = Math.max(1, Math.round(ms / 16));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await page.waitForTimeout(16);
  }
}

/** Mark earlier steps as done so a session opens on a chosen step (recording setup only). */
async function primeSessions(page: Page, doneSteps: number) {
  await page.goto(`${BASE}/ladder/demo-spiders`, { waitUntil: "load" });
  await page.locator("img").first().waitFor();
  await page.waitForTimeout(800);
  await page.evaluate("globalThis.__name = (f) => f"); // tsx adds __name() calls inside evaluated functions
  await page.evaluate(async (n) => {
    const open = (name: string) =>
      new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(name);
        r.onupgradeneeded = () => r.result.createObjectStore("sessions"); // same layout idb-keyval creates
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    const ladder = (await (await fetch("/demo/spiders/ladder.json")).json()) as { rungs: { id: string; kind: string }[] };
    const main = ladder.rungs.filter((r) => r.kind !== "variation").slice(0, n);
    const now = new Date(Date.now() - 86400000).toISOString();
    const session = {
      id: "s-prime",
      ladderId: "demo-spiders",
      startedAt: now,
      endedAt: now,
      exposures: main.map((r, i) => ({
        rungId: r.id, startedAt: now, endedAt: now, lookMs: 60000, releases: 1,
        samples: [{ t: 0, suds: 30 + i * 6 }, { t: 60, suds: 15 + i * 4 }],
        prediction: "", likelihood: 0, expectedSuds: 40 + i * 5, peakSuds: 30 + i * 6, endSuds: 15 + i * 4,
        happened: "no", surprise: 0, learned: "", feelings: [],
      })),
    };
    const sessions = await open("fear-ladder-sessions");
    await new Promise<void>((res) => {
      const tx = sessions.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put(session, session.id);
      tx.oncomplete = () => res();
    });
  }, doneSteps);
}

async function dragSlider(page: Page, sel: string, from: number, to: number, steps = 22) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) return;
  await page.mouse.move(b.x + b.width * from, b.y + b.height / 2, { steps: 8 });
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * to, b.y + b.height / 2, { steps });
  await page.mouse.up();
}

const CLIPS: Record<string, (b: Browser) => Promise<void>> = {
  // Builder: pick a fear, type a line, build, watch the first steps appear.
  builder: (b) =>
    record(b, "builder", async (page, mark) => {
      await page.goto(`${BASE}/new`, { waitUntil: "load" });
      await page.getByRole("button", { name: /Build my ladder/ }).waitFor({ timeout: 20000 });
      await page.waitForTimeout(900);
      mark("start");
      await tap(page, page.getByText("Spiders", { exact: true }));
      await page.waitForTimeout(500);
      await tap(page, page.getByRole("textbox").first());
      await page.keyboard.type("Big hairy ones, worst when they walk toward me.", { delay: 45 });
      mark("typed");
      await page.waitForTimeout(700);
      await tap(page, page.getByRole("button", { name: /Build my ladder/ }));
      mark("generate");
      await page.waitForURL(/\/ladder\//);
      await page.waitForTimeout(6000);
      mark("planning");
      await page.locator("img.develop, img[src^='data:image']").first().waitFor({ timeout: 90000 }).catch(() => {});
      mark("firstImage");
      await page.waitForTimeout(12000);
      mark("developed");
    }),

  // Ladder: reveal a few steps, open one big.
  ladder: (b) =>
    record(b, "ladder", async (page, mark) => {
      await page.goto(`${BASE}/ladder/demo-spiders`, { waitUntil: "load" });
      await page.locator("img").first().waitFor();
      await page.waitForTimeout(1200);
      mark("start");
      for (const n of [4, 6, 9]) {
        await touchTap(page, page.getByRole("button", { name: `Look at step ${n}` }));
        await page.waitForTimeout(1900);
      }
      mark("revealed");
      await page.waitForTimeout(600);
      mark("end");
    }, true),

  // Session on the top step: guess, hold to look, let go, rate.
  hold: (b) =>
    record(b, "hold", async (page, mark) => {
      await primeSessions(page, 8);
      await page.goto(`${BASE}/ladder/demo-spiders/session`, { waitUntil: "load" });
      await page.getByRole("button", { name: "Begin" }).waitFor();
      await page.waitForTimeout(900);
      await tap(page, page.getByRole("button", { name: "Begin" }));
      await page.getByRole("button", { name: "Look" }).waitFor();
      mark("guess");
      await page.waitForTimeout(900);
      await dragSlider(page, "input[type=range]", 0.5, 0.82);
      await page.waitForTimeout(900);
      await tap(page, page.getByRole("button", { name: "Look" }));
      await page.waitForTimeout(800);
      mark("look");
      const img = page.locator("main img").first();
      const box = (await img.boundingBox())!;
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.waitForTimeout(1300);
      await page.mouse.move(cx, cy, { steps: 12 });
      mark("hold1");
      await page.mouse.down();
      await page.waitForTimeout(3200);
      await page.mouse.up();
      mark("release1");
      await page.waitForTimeout(1600);
      await page.mouse.down();
      mark("hold2");
      await page.waitForTimeout(2200);
      await page.mouse.up();
      mark("release2");
      await page.waitForTimeout(500);
      await dragSlider(page, "input[type=range]", 0.75, 0.4, 30);
      await page.waitForTimeout(900);
      await tap(page, page.getByRole("button", { name: "Done" }));
      await page.waitForTimeout(1200);
      mark("after");
      await tap(page, page.getByRole("button", { name: "Easier" }));
      await page.waitForTimeout(2000);
      mark("end");
    }),

  // Live smaller step: distress stays high on step 3, a new step is drawn and slides in.
  halfstep: (b) =>
    record(b, "halfstep", async (page, mark) => {
      await primeSessions(page, 2);
      await page.goto(`${BASE}/ladder/demo-spiders/session`, { waitUntil: "load" });
      await tap(page, page.getByRole("button", { name: "Begin" }));
      await tap(page, page.getByRole("button", { name: "Look" }));
      await page.waitForTimeout(800);
      await page.keyboard.down("Space");
      await page.waitForTimeout(1200);
      for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowUp");
      await page.keyboard.up("Space");
      await page.waitForTimeout(400);
      await tap(page, page.getByRole("button", { name: "Done" }));
      await page.getByRole("button", { name: "Worse" }).waitFor();
      await page.waitForTimeout(700);
      await tap(page, page.getByRole("button", { name: "Worse" }));
      await page.waitForTimeout(1500);
      mark("after");
      await tap(page, page.getByRole("button", { name: /smaller step/i }));
      mark("drawing");
      await page.getByRole("button", { name: "Try it" }).waitFor({ timeout: 180000 });
      mark("ready");
      await page.waitForTimeout(4000);
    }),

  // Report: three real looks with the keyboard, then the report.
  report: (b) =>
    record(b, "report", async (page, mark) => {
      await page.goto(`${BASE}/ladder/demo-spiders/session`, { waitUntil: "load" });
      await page.getByRole("button", { name: "Begin" }).click();
      const peaks = [0.45, 0.66, 0.82];
      const ends = [0.28, 0.34, 0.46];
      for (let n = 0; n < 3; n++) {
        await page.getByRole("button", { name: "Look" }).click();
        await page.waitForTimeout(500);
        await page.keyboard.down("Space");
        await page.waitForTimeout(600);
        await dragSlider(page, "input[type=range]", 0.5, peaks[n], 10);
        await page.waitForTimeout(1300); // ratings within a second collapse into one sample
        await dragSlider(page, "input[type=range]", peaks[n], ends[n], 10);
        await page.keyboard.up("Space");
        await page.getByRole("button", { name: "Done" }).click();
        await page.getByRole("button", { name: "Easier" }).click();
        if (n < 2) await page.getByRole("button", { name: "Next step" }).first().click();
      }
      await page.getByRole("button", { name: "Finish" }).click();
      await page.getByRole("link", { name: "See report" }).or(page.getByRole("button", { name: "See report" })).first().click();
      await page.getByText(/Based on 3 rating/).waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1500);
      mark("report");
      await smoothScroll(page, 900, 2600);
      await page.waitForTimeout(1500);
      await smoothScroll(page, 900, 2600);
      await page.waitForTimeout(2000);
      mark("end");
    }),
};

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const only = process.argv.slice(2);
  for (const [name, fn] of Object.entries(CLIPS)) {
    if (only.length && !only.includes(name)) continue;
    await fn(browser);
  }
  await browser.close();
})();

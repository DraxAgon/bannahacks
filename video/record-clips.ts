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
async function record(browser: Browser, name: string, run: (page: Page, mark: (k: string) => void) => Promise<void>) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
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
  await cdp.send("Page.stopScreencast").catch(() => {});
  await ctx.close();
  // Concat list with real per-frame durations; times are relative to the first frame.
  const start = frames[0]?.ts ?? t0;
  const lines: string[] = [];
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.ts ?? f.ts + 0.5;
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

async function smoothScroll(page: Page, dy: number, ms: number) {
  const steps = Math.max(1, Math.round(ms / 16));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await page.waitForTimeout(16);
  }
}

const CLIPS: Record<string, (b: Browser) => Promise<void>> = {
  // Patient session: predict, then hold-to-view reveal on the open-palm rung.
  hold: (b) =>
    record(b, "hold", async (page, mark) => {
      await page.goto(`${BASE}/ladder/demo-spiders/session`, { waitUntil: "load" });
      await page.getByText("Calm Contact on an Open Hand").waitFor();
      await page.waitForTimeout(600);
      await tap(page, page.getByText("Calm Contact on an Open Hand"));
      await page.waitForTimeout(300);
      await tap(page, page.getByRole("button", { name: "Begin" }));
      await page.getByRole("button", { name: "I'll panic" }).waitFor();
      mark("predict");
      await page.waitForTimeout(500);
      await tap(page, page.getByRole("button", { name: "I'll panic" }));
      await page.waitForTimeout(400);
      // drag likelihood slider to ~80%
      const sl = await page.locator("#likelihood").boundingBox();
      if (sl) {
        await page.mouse.move(sl.x + sl.width * 0.5, sl.y + sl.height / 2, { steps: 6 });
        await page.mouse.down();
        await page.mouse.move(sl.x + sl.width * 0.8, sl.y + sl.height / 2, { steps: 14 });
        await page.mouse.up();
      }
      await page.waitForTimeout(400);
      await tap(page, page.getByRole("button", { name: "I’m ready to look" }));
      await page.waitForTimeout(900);
      mark("expose");
      const img = page.locator("[aria-label*='Press and hold']");
      const box = (await img.boundingBox())!;
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.waitForTimeout(900);
      await page.mouse.move(cx, cy, { steps: 10 });
      mark("hold1");
      await page.mouse.down();
      await page.waitForTimeout(2600);
      await page.mouse.up();
      mark("release1");
      await page.waitForTimeout(1200);
      await page.mouse.down();
      mark("hold2");
      await page.waitForTimeout(1500);
      // nudge SUDS down with keys while still holding
      await page.mouse.up();
      mark("release2");
      const suds = await page.locator("#suds").boundingBox();
      if (suds) {
        await page.mouse.move(suds.x + suds.width * 0.75, suds.y + suds.height / 2, { steps: 8 });
        await page.mouse.down();
        await page.mouse.move(suds.x + suds.width * 0.42, suds.y + suds.height / 2, { steps: 24 });
        await page.mouse.up();
        mark("suds");
      }
      await page.waitForTimeout(1500);
    }),

  // Therapist ladder view on a phone: scroll from the word card up, tapping to reveal.
  ladder: (b) =>
    record(b, "ladder", async (page, mark) => {
      await page.goto(`${BASE}/ladder/demo-spiders`, { waitUntil: "load" });
      await page.getByText("Calm Contact on an Open Hand").waitFor();
      await page.waitForTimeout(800);
      mark("top");
      await smoothScroll(page, 1500, 2200);
      await page.waitForTimeout(400);
      mark("bottom");
      const reveal = async (title: string) => {
        const card = page.locator("li", { hasText: title });
        await card.scrollIntoViewIfNeeded();
        await tap(page, card.getByRole("button", { name: /Reveal image/ }));
        await page.waitForTimeout(900);
      };
      await reveal("Written Word Card");
      await reveal("Minimalist Line Drawing");
      await smoothScroll(page, -330, 700);
      await reveal("Distant Soft-Focus Photograph");
      await smoothScroll(page, -330, 700);
      await reveal("Closer View of Characteristic Hairiness");
      await smoothScroll(page, -500, 900);
      await reveal("Resting Near a Person");
      await reveal("Calm Contact on an Open Hand");
      mark("revealed");
      await page.waitForTimeout(1200);
    }),

  // Builder: type the fear, generate, watch planning begin.
  builder: (b) =>
    record(b, "builder", async (page, mark) => {
      await page.goto(`${BASE}/new`, { waitUntil: "load" });
      await page.getByText("About a minute. Rungs appear one by one.").waitFor({ timeout: 20000 });
      await page.waitForTimeout(500);
      mark("start");
      await tap(page, page.getByText("Spiders", { exact: true }));
      await page.locator("#desc").scrollIntoViewIfNeeded();
      await tap(page, page.locator("#desc"));
      await page.keyboard.type("Big hairy spiders, worst when they move toward me. Tiny ones far away are fine.", { delay: 28 });
      mark("typed");
      await page.waitForTimeout(500);
      const gen = page.getByRole("button", { name: "Generate ladder" });
      await gen.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await tap(page, gen);
      mark("generate");
      await page.waitForURL(/\/ladder\//);
      await page.waitForTimeout(5000);
      mark("planning");
      // Let the anchor and first rungs develop, then show the bottom of the ladder.
      await page.getByText(/Rendering and checking rungs/).waitFor({ timeout: 60000 });
      mark("rendering");
      await smoothScroll(page, 1300, 1500);
      await page.waitForTimeout(16000);
      mark("developed");
    }),

  // Report: three quick keyboard-rated exposures, then scroll the clinician report.
  report: (b) =>
    record(b, "report", async (page, mark) => {
      await page.goto(`${BASE}/ladder/demo-spiders/session`, { waitUntil: "load" });
      await page.getByRole("button", { name: "Begin" }).click();
      const peaks = [6, 8, 9];
      const ends = [12, 18, 20];
      for (let n = 0; n < 3; n++) {
        await page.getByRole("button", { name: "I'll panic" }).click();
        await page.getByRole("button", { name: "I’m ready to look" }).click();
        await page.waitForTimeout(600);
        await page.keyboard.down("Space");
        await page.waitForTimeout(900);
        for (let i = 0; i < peaks[n]; i++) await page.keyboard.press("ArrowUp");
        await page.waitForTimeout(400);
        await page.keyboard.up("Space");
        await page.getByRole("button", { name: "Done" }).click();
        await page.locator("#end-suds").focus();
        for (let i = 0; i < ends[n] + n * 3; i++) await page.keyboard.press("ArrowLeft");
        await page.getByRole("button", { name: "No", exact: true }).click();
        await page.getByLabel("What did you learn?").fill(["It stayed still. The feeling faded.", "I could keep looking longer than I thought.", "It's just a picture. My heart slowed down."][n]);
        await page.getByRole("button", { name: "Save and continue" }).click();
        await page.getByRole("heading", { name: "What next?" }).waitFor();
        if (n < 2) await page.getByRole("button", { name: /Climb to rung/ }).click();
      }
      await page.getByRole("button", { name: "End the session for today" }).click();
      await page.getByRole("button", { name: "Open the report" }).click();
      await page.getByText(/Exploratory: based on 3 ratings/).waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(800);
      mark("report");
      await smoothScroll(page, 1450, 3200);
      await page.waitForTimeout(600);
      mark("charts");
      await smoothScroll(page, 1700, 3200);
      await page.waitForTimeout(2200);
      mark("fingerprint");
      await smoothScroll(page, 700, 1400);
      await page.waitForTimeout(800);
    }),

  // Live half-step: high distress on rung 3, then a smaller step is drawn and slides in.
  halfstep: (b) =>
    record(b, "halfstep", async (page, mark) => {
      await page.goto(`${BASE}/ladder/demo-spiders/session`, { waitUntil: "load" });
      await page.getByText("Stylized Color Illustration").waitFor();
      await tap(page, page.getByText("Stylized Color Illustration"));
      await tap(page, page.getByRole("button", { name: "Begin" }));
      await tap(page, page.getByRole("button", { name: "I'll panic" }));
      await tap(page, page.getByRole("button", { name: "I’m ready to look" }));
      await page.waitForTimeout(700);
      await page.keyboard.down("Space");
      await page.waitForTimeout(1200);
      for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowUp");
      await page.keyboard.up("Space");
      await tap(page, page.getByRole("button", { name: "Done" }));
      await page.locator("#end-suds").focus();
      for (let i = 0; i < 25; i++) await page.keyboard.press("ArrowLeft");
      await tap(page, page.getByRole("button", { name: "Yes", exact: true }));
      const save = page.getByRole("button", { name: "Save and continue" });
      await save.scrollIntoViewIfNeeded();
      await tap(page, save);
      await page.getByRole("heading", { name: "What next?" }).waitFor();
      await page.waitForTimeout(1200);
      mark("next");
      await tap(page, page.getByRole("button", { name: /Add a half-step/ }));
      mark("drawing");
      await page.getByRole("button", { name: "Try the smaller step" }).waitFor({ timeout: 180000 });
      mark("ready");
      await page.waitForTimeout(2800);
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

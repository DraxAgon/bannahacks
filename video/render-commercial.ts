/**
 * Renders video/commercial.html (1080x1920, 30fps) and mixes the Gemini TTS voiceover over the
 * Lyria music bed (ducked under the voice) into video/out/fear-ladder-commercial.mp4.
 * Prereqs: video/prep-frames.py, video/make-audio.mjs, and a static server on :3300 at the repo root.
 * Usage: PW_CHROMIUM=/opt/pw-browsers/chromium npx tsx video/render-commercial.ts [--preview 1,5,9]
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

const BASE = "http://localhost:3300/video/commercial.html";
const FPS = 30;
const OUT = "video/out";
const A = `${OUT}/audio`;
const BPM_PERIOD = 60 / 122.25;
const MUSIC_START = 0.05 + 24 * BPM_PERIOD; // the track's drop lands on the second scene's first beat

(async () => {
  const mixOnly = process.argv.includes("--mix-only"); // reuse rendered frames, redo only the audio
  const previewArg = process.argv.indexOf("--preview");
  const preview = previewArg > -1 ? process.argv[previewArg + 1].split(",").map(Number) : null;
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.goto(BASE, { waitUntil: "load" });
  await page.evaluate(() => (window as unknown as { ready: Promise<boolean> }).ready);
  const { duration, vo } = await page.evaluate(() => {
    const w = window as unknown as { DURATION: number; VO: number[] };
    return { duration: w.DURATION, vo: w.VO };
  });
  const render = (tt: number) => page.evaluate((x) => (window as unknown as { renderAt: (t: number) => Promise<void> }).renderAt(x), tt);

  if (preview) {
    mkdirSync(`${OUT}/preview-c`, { recursive: true });
    for (const t of preview) {
      await render(t);
      await page.screenshot({ path: `${OUT}/preview-c/t${t}.jpg`, type: "jpeg", quality: 85 });
    }
    await browser.close();
    return;
  }

  const dir = `${OUT}/commercial-frames`;
  const n = mixOnly ? 0 : Math.round(duration * FPS);
  if (!mixOnly) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  for (let i = 0; i < n; i++) {
    await render(i / FPS);
    await page.screenshot({ path: `${dir}/${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 });
    if (i % 150 === 0) console.log(`frame ${i}/${n}`);
  }
  await browser.close();

  // Music from the drop-aligned offset, ducked under the voice; voice lines placed at the page's VO times.
  const d = duration.toFixed(3);
  const voInputs = vo.flatMap((_, i) => ["-i", `${A}/vo-${i}.wav`]);
  const voChains = vo.map((t, i) => `[${i + 1}:a]adelay=${Math.round(t * 1000)}:all=1[v${i}]`).join(";");
  const filter = [
    `[0:a]atrim=start=${MUSIC_START.toFixed(3)},asetpts=PTS-STARTPTS,atrim=duration=${d},afade=t=in:d=0.05,afade=t=out:st=${(duration - 1.4).toFixed(3)}:d=1.4,volume=0.5[m]`,
    voChains,
    `${vo.map((_, i) => `[v${i}]`).join("")}amix=inputs=${vo.length}:normalize=0:duration=longest,highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2,aformat=channel_layouts=stereo,apad=whole_dur=${d},asplit=2[voice][key]`,
    `[m][key]sidechaincompress=threshold=0.03:ratio=4:attack=20:release=500[duck]`,
    `[duck][voice]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[mix]`,
  ].join(";");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${A}/music-raw.mp3`, ...voInputs, "-filter_complex", filter, "-map", "[mix]", "-t", d, `${A}/mix.wav`]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${dir}/%05d.jpg`, "-i", `${A}/mix.wav`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-profile:v", "high", "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "192k", "-shortest", `${OUT}/fear-ladder-commercial.mp4`]);
  console.log(`wrote ${OUT}/fear-ladder-commercial.mp4`);
})();

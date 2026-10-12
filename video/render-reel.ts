/**
 * Renders video/reel.html frame by frame (1080x1920, 30fps) and encodes video/out/fear-ladder-reel.mp4
 * with a generated ambient soundtrack.
 * Prereqs: video/record-clips.ts has produced clips; a static server serves the repo root on :3300
 *   (python3 -m http.server 3300).
 * Usage: PW_CHROMIUM=/opt/pw-browsers/chromium npx tsx video/render-reel.ts [--preview 1.5,6,12]
 */
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

const BASE = "http://localhost:3300/video/reel.html";
const FPS = 30;
const OUT = "video/out";

(async () => {
  const previewArg = process.argv.indexOf("--preview");
  const preview = previewArg > -1 ? process.argv[previewArg + 1].split(",").map(Number) : null;
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.goto(BASE, { waitUntil: "load" });
  await page.evaluate(() => (window as unknown as { ready: Promise<boolean> }).ready);
  const duration = await page.evaluate(() => (window as unknown as { DURATION: number }).DURATION);

  if (preview) {
    mkdirSync(`${OUT}/preview`, { recursive: true });
    for (const t of preview) {
      await page.evaluate((tt) => (window as unknown as { renderAt: (t: number) => Promise<void> }).renderAt(tt), t);
      await page.screenshot({ path: `${OUT}/preview/t${t}.jpg`, type: "jpeg", quality: 85 });
    }
    await browser.close();
    return;
  }

  const dir = `${OUT}/reel-frames`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const n = Math.round(duration * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((tt) => (window as unknown as { renderAt: (t: number) => Promise<void> }).renderAt(tt), i / FPS);
    await page.screenshot({ path: `${dir}/${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 });
    if (i % 150 === 0) console.log(`frame ${i}/${n}`);
  }
  await browser.close();

  // Ambient pad: A-major-ish chord with slow swells, soft and royalty-free (generated here).
  const d = duration.toFixed(2);
  execSync(
    `ffmpeg -y -loglevel error -f lavfi -i "aevalsrc='0.10*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.07*t))+0.07*sin(2*PI*164.81*t)*(0.6+0.4*sin(2*PI*0.05*t+1))+0.05*sin(2*PI*277.18*t)*(0.5+0.5*sin(2*PI*0.09*t+2))+0.035*sin(2*PI*329.63*t)*(0.5+0.5*sin(2*PI*0.11*t+3))+0.02*sin(2*PI*659.25*t)*(0.5+0.5*sin(2*PI*0.13*t))':s=48000:d=${d}" ` +
      `-af "lowpass=f=1800,aecho=0.8:0.7:120|260:0.25|0.18,afade=t=in:d=1.5,afade=t=out:st=${(duration - 2.2).toFixed(2)}:d=2.2,volume=1.6" ${OUT}/pad.wav`,
  );
  execSync(
    `ffmpeg -y -loglevel error -framerate ${FPS} -i ${dir}/%05d.jpg -i ${OUT}/pad.wav -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow -profile:v high -movflags +faststart -c:a aac -b:a 160k -shortest ${OUT}/fear-ladder-reel.mp4`,
  );
  console.log(`wrote ${OUT}/fear-ladder-reel.mp4`);
})();

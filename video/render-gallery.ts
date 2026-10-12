/** Renders video/gallery.html slides to docs/gallery/*.png (1500x1000) for the Devpost image gallery. */
import { chromium } from "@playwright/test";
import { copyFileSync } from "node:fs";

const NAMES = ["", "02-ladder", "03-hold-to-look", "04-smaller-step", "05-report", "06-three-fears", "07-home"];
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
  for (let n = 1; n <= 6; n++) {
    await p.goto(`http://localhost:3300/video/gallery.html?n=${n}`, { waitUntil: "load" });
    await p.evaluate(() => (window as unknown as { ready: Promise<boolean> }).ready);
    await p.screenshot({ path: `docs/gallery/${NAMES[n]}.png` });
  }
  await b.close();
  copyFileSync("docs/thumbnail.png", "docs/gallery/01-cover.png");
})();

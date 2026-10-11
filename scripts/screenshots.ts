/**
 * Screenshots every screen at 1440px and 390px into docs/screenshots/.
 * Usage: BASE_URL=http://localhost:3000 npm run screenshots [-- name1 name2]
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots";

type Shot = { name: string; path: string; prepare?: (page: Page) => Promise<void> };

const SHOTS: Shot[] = [
  { name: "landing", path: "/" },
  { name: "builder", path: "/new" },
  { name: "ladder", path: "/ladder/demo-spiders", prepare: (p) => p.waitForTimeout(2500) },
  { name: "session", path: "/ladder/demo-spiders/session", prepare: (p) => p.waitForTimeout(1500) },
  { name: "report", path: "/ladder/demo-spiders/report", prepare: (p) => p.waitForTimeout(2500) },
  { name: "ladders", path: "/ladders", prepare: (p) => p.waitForTimeout(1000) },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  );
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const s of SHOTS) {
      if (only.length && !only.includes(s.name)) continue;
      await page.goto(BASE + s.path, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      if (s.prepare) await s.prepare(page);
      const file = `${OUT}/${s.name}-${width}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log("saved", file);
    }
    await ctx.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

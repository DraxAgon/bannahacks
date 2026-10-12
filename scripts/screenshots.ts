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
  { name: "landing", path: "/", prepare: (p) => p.waitForTimeout(2500) },
  { name: "builder", path: "/new" },
  { name: "ladder", path: "/ladder/demo-spiders", prepare: (p) => p.waitForTimeout(2500) },
  { name: "session", path: "/ladder/demo-spiders/session", prepare: (p) => p.waitForTimeout(1500) },
  {
    name: "session-look",
    path: "/ladder/demo-spiders/session",
    prepare: async (p) => {
      await p.getByRole("button", { name: "Begin" }).click();
      await p.getByRole("button", { name: /^look$/i }).click();
      await p.waitForTimeout(1500);
    },
  },
  {
    name: "report",
    path: "/ladder/demo-spiders/report",
    prepare: async (p) => {
      await seedRatings(p);
      await p.reload({ waitUntil: "load" });
      await p.waitForTimeout(2500);
    },
  },
  { name: "ladders", path: "/ladders", prepare: (p) => p.waitForTimeout(1000) },
];

/** Writes one finished session (six rated looks) so the report has something to show. */
async function seedRatings(page: Page) {
  await page.evaluate("globalThis.__name = (f) => f"); // tsx adds __name() calls inside evaluated functions
  await page.evaluate(async () => {
    const open = (name: string) =>
      new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(name);
        r.onupgradeneeded = () => r.result.createObjectStore("sessions"); // same layout idb-keyval creates
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    const ladder = (await (await fetch("/demo/spiders/ladder.json")).json()) as { rungs: { id: string; kind: string }[] };
    const peaks = [12, 20, 34, 46, 58, 72];
    const ends = [4, 8, 15, 22, 30, 44];
    const at = new Date(Date.now() - 3600000).toISOString();
    const session = {
      id: "s-screenshot",
      ladderId: "demo-spiders",
      startedAt: at,
      endedAt: at,
      exposures: ladder.rungs
        .filter((r) => r.kind !== "variation")
        .slice(0, peaks.length)
        .map((r, i) => ({
          rungId: r.id, startedAt: at, endedAt: at, lookMs: 45000 + i * 9000, releases: i > 3 ? 2 : 0,
          samples: [{ t: 0, suds: peaks[i] }, { t: 40, suds: ends[i] }],
          prediction: "", likelihood: 0, expectedSuds: peaks[i] + 10, peakSuds: peaks[i], endSuds: ends[i],
          happened: "no", surprise: 0, learned: "", feelings: [],
        })),
    };
    const sdb = await open("fear-ladder-sessions");
    await new Promise<void>((res) => {
      const tx = sdb.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put(session, session.id);
      tx.oncomplete = () => res();
    });
  });
}

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

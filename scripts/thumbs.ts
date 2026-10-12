/**
 * Writes a small WebP thumbnail next to every demo image (rung-3.jpg → rung-3.thumb.webp)
 * so ladder cards and the landing strip don't download the 1024 px originals.
 * seed-demo runs this for each ladder it writes; to regenerate by hand:
 *   npx tsx scripts/thumbs.ts            # all demos
 *   npx tsx scripts/thumbs.ts spiders
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// Cards show images at up to ~150 CSS px; 320 covers 2× screens.
const SIZE = 320;

export async function writeThumbs(dir: string) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".jpg"));
  await Promise.all(
    files.map((f) =>
      sharp(join(dir, f))
        .resize(SIZE, SIZE, { fit: "cover" })
        .webp({ quality: 72 })
        .toFile(join(dir, f.replace(/\.jpg$/, ".thumb.webp"))),
    ),
  );
  return files.length;
}

if (process.argv[1]?.endsWith("thumbs.ts")) {
  const root = join("public", "demo");
  const only = process.argv.slice(2);
  const slugs = only.length ? only : readdirSync(root);
  (async () => {
    for (const slug of slugs) {
      const dir = join(root, slug);
      if (!existsSync(dir)) continue;
      console.log(`${slug}: ${await writeThumbs(dir)} thumbnails`);
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

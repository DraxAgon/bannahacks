/** Demo images ship with a small sibling thumbnail (rung-3.jpg → rung-3.thumb.webp); generated data URLs don't. */
export function thumbOf(src: string): string {
  return src.startsWith("/demo/") && src.endsWith(".jpg") ? src.replace(/\.jpg$/, ".thumb.webp") : src;
}

const seen = new Set<string>();
const queue: string[] = [];
let active = 0;
const CONCURRENCY = 2;

const whenIdle = (fn: () => void) =>
  typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200);

/**
 * Warm the cache for images the user is likely to open next, a couple at a time and only
 * when the main thread is idle, so they never compete with what's on screen.
 * Data URLs are already in memory and are skipped.
 */
export function preloadImages(srcs: (string | undefined)[]) {
  if (typeof window === "undefined") return;
  for (const s of srcs) {
    if (!s || s.startsWith("data:") || seen.has(s)) continue;
    seen.add(s);
    queue.push(s);
  }
  pump();
}

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const src = queue.shift()!;
    active++;
    whenIdle(() => {
      const img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = () => {
        active--;
        pump();
      };
      img.src = src;
    });
  }
}

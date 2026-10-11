import "server-only";

// Best-effort, in-memory spend guard. Each serverless instance keeps its own counters,
// which is enough to stop casual overuse of a hackathon demo key.
const HOUR = 60 * 60 * 1000;
const LADDERS_PER_IP_PER_HOUR = 3;
const IMAGES_PER_IP_PER_HOUR = 150;

const ladderHits = new Map<string, number[]>();
const imageHits = new Map<string, number[]>();
let day = new Date().toISOString().slice(0, 10);
let dayCount = 0;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
}

function recent(map: Map<string, number[]>, ip: string): number[] {
  const now = Date.now();
  const list = (map.get(ip) ?? []).filter((t) => now - t < HOUR);
  map.set(ip, list);
  return list;
}

export type GuardResult = { ok: true } | { ok: false; message: string };

export function checkLadderQuota(ip: string): GuardResult {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  const max = Number(process.env.MAX_LIVE_LADDERS_PER_DAY || 30);
  if (dayCount >= max) {
    return { ok: false, message: "Today's live ladders have all been used. The demo ladders show the full experience." };
  }
  const list = recent(ladderHits, ip);
  if (list.length >= LADDERS_PER_IP_PER_HOUR) {
    return {
      ok: false,
      message: "You've built three live ladders this hour. Please try again later, or open a demo ladder.",
    };
  }
  list.push(Date.now());
  dayCount++;
  return { ok: true };
}

export function checkImageQuota(ip: string): GuardResult {
  const list = recent(imageHits, ip);
  if (list.length >= IMAGES_PER_IP_PER_HOUR) {
    return { ok: false, message: "Image limit reached for this hour. The demo ladders still work." };
  }
  list.push(Date.now());
  return { ok: true };
}

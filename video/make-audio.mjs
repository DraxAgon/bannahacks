/**
 * Generates the commercial's voiceover (Gemini TTS, one file per line) and music bed (Lyria)
 * into video/out/audio/. Reads GEMINI_API_KEY from .env.local; nothing is printed or saved besides audio.
 * Usage: node video/make-audio.mjs [vo] [music]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const key = readFileSync(".env.local", "utf8").match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error("GEMINI_API_KEY missing from .env.local");
const OUT = "video/out/audio";
mkdirSync(OUT, { recursive: true });
const API = "https://generativelanguage.googleapis.com/v1beta/models";

export const LINES = [
  "One in eleven adults has a phobia.",
  "Fear Ladder turns yours into nine small steps.",
  "Just pick your fear.",
  "AI draws it, from a word on a card... all the way to the real thing.",
  "Every image gets checked before you see it.",
  "You decide when to look. Let go, and it blurs.",
  "Too much? It draws you a smaller step. Live.",
  "Then it shows you what actually scares you.",
  "Spiders. Dogs. Needles. Whatever yours is.",
  "Fear Ladder. Face your fear, one step at a time.",
];

const VOICE = process.env.VOICE ?? "Despina";
const STYLE = process.env.STYLE ?? "";

async function post(model, body) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const r = await fetch(`${API}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (r.ok) return j;
    console.error(model, r.status, JSON.stringify(j).slice(0, 120));
    await new Promise((res) => setTimeout(res, 4000 * attempt));
  }
  throw new Error(`${model} failed`);
}

const inline = (j) => j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;

async function vo(i, text) {
  const j = await post("gemini-3.8-flash-tts", {
    // This model speaks any style text it is given and rejects system instructions, so the voice carries the tone.
    contents: [{ parts: [{ text: STYLE ? `${STYLE} ${text}` : text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    },
  });
  const d = inline(j);
  if (!d) throw new Error(`no audio for line ${i}: ${JSON.stringify(j).slice(0, 200)}`);
  // TTS returns either a WAV file or raw 16-bit PCM; both become a 48 kHz WAV with the silence trimmed.
  const isWav = /wav/.test(d.mimeType);
  const raw = `${OUT}/vo-${i}.${isWav ? "src.wav" : "pcm"}`;
  writeFileSync(raw, Buffer.from(d.data, "base64"));
  const input = isWav ? ["-i", raw] : ["-f", "s16le", "-ar", d.mimeType.match(/rate=(\d+)/)?.[1] ?? "24000", "-ac", "1", "-i", raw];
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...input,
    "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
    "-ar", "48000", "-ac", "1", `${OUT}/vo-${i}.wav`]);
  const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", `${OUT}/vo-${i}.wav`]).toString().trim();
  console.log(`vo-${i}`, d.mimeType, dur, text);
  return Number(dur);
}

async function music() {
  const j = await post(process.env.MUSIC_MODEL ?? "lyria-3.5", {
    contents: [{ parts: [{ text:
      "Upbeat modern pop instrumental for a 45 second tech product commercial. 122 BPM, four-on-the-floor kick, crisp claps, " +
      "shimmering hi-hats, bright plucky synth chords, bouncy bass, feel-good and confident, builds in the first 4 seconds and " +
      "stays energetic, clean ending. No vocals." }] }],
    generationConfig: { responseModalities: ["AUDIO"] },
  });
  const d = inline(j);
  if (!d) throw new Error(`no music: ${JSON.stringify(j).slice(0, 300)}`);
  const ext = /mpeg|mp3/.test(d.mimeType) ? "mp3" : /wav/.test(d.mimeType) ? "wav" : "bin";
  writeFileSync(`${OUT}/music-raw.${ext}`, Buffer.from(d.data, "base64"));
  console.log("music", d.mimeType, `${OUT}/music-raw.${ext}`);
}

const want = process.argv.slice(2);
const jobs = [];
if (!want.length || want.includes("vo")) {
  const only = process.env.ONLY ? process.env.ONLY.split(",").map(Number) : null;
  const durs = await Promise.all(LINES.map((t, i) => (only && !only.includes(i) ? 0 : vo(i, t))));
  writeFileSync(`${OUT}/vo.json`, JSON.stringify(LINES.map((text, i) => ({ text, dur: durs[i] })), null, 2));
}
if (!want.length || want.includes("music")) jobs.push(music());
await Promise.all(jobs);

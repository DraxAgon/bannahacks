import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { hasKey } from "./models";

/** Hard ceiling for one model call, well inside the route's 60 s maxDuration. */
const CALL_TIMEOUT_MS = 55_000;
const MAX_ATTEMPTS = 3;

export class NoKeyError extends Error {
  constructor() {
    super("Live generation is not configured on this server.");
  }
}

export class ModelError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryable = false,
  ) {
    super(message);
  }
}

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!hasKey()) throw new NoKeyError();
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function statusOf(err: unknown): number | undefined {
  const e = err as { status?: unknown; statusCode?: unknown; code?: unknown; message?: unknown };
  for (const v of [e?.status, e?.statusCode, e?.code]) {
    if (typeof v === "number") return v;
  }
  const msg = String(e?.message ?? "");
  const m = msg.match(/\b(429|500|502|503|504)\b/);
  if (m) return Number(m[1]);
  if (/RESOURCE_EXHAUSTED/.test(msg)) return 429;
  if (/UNAVAILABLE|INTERNAL|DEADLINE/.test(msg)) return 503;
  return undefined;
}

function isRetryable(err: unknown): boolean {
  const s = statusOf(err);
  if (s === 429 || (s !== undefined && s >= 500)) return true;
  const name = (err as { name?: string })?.name ?? "";
  return /Timeout|Connection/i.test(name);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retries 429 and 5xx with exponential backoff (3 attempts) inside a 55 s overall budget.
 * `onAttempt` reports every try so the Pipeline Inspector can show it.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  onAttempt?: (info: { attempt: number; ms: number; ok: boolean; error?: string }) => void,
): Promise<T> {
  const deadline = Date.now() + CALL_TIMEOUT_MS;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 4_000) break;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), remaining);
    const t0 = Date.now();
    try {
      const out = await fn(ctrl.signal);
      onAttempt?.({ attempt, ms: Date.now() - t0, ok: true });
      return out;
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      onAttempt?.({ attempt, ms: Date.now() - t0, ok: false, error: message.slice(0, 300) });
      if (!isRetryable(err) || attempt === MAX_ATTEMPTS) break;
      const backoff = 1000 * 2 ** (attempt - 1) + Math.random() * 400;
      if (Date.now() + backoff > deadline - 4_000) break;
      await sleep(backoff);
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastErr instanceof NoKeyError) throw lastErr;
  const status = statusOf(lastErr);
  const message = lastErr instanceof Error ? lastErr.message : "Model call failed";
  throw new ModelError(message.slice(0, 400), status, isRetryable(lastErr));
}

export type ImageInput = { mimeType: string; data: string };

/** Parse a data URL into base64 + mime type. */
export function parseDataUrl(url: string): ImageInput {
  const m = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new ModelError("Expected a base64 data URL", 400);
  return { mimeType: m[1], data: m[2] };
}

type Content =
  | { type: "text"; text: string }
  | { type: "image"; mime_type: string; data: string };

function toInput(text: string, images: ImageInput[]): Content[] {
  return [
    { type: "text", text },
    ...images.map((img) => ({ type: "image" as const, mime_type: img.mimeType, data: img.data })),
  ];
}

/** One image call through the Interactions API. Returns base64 JPEG. */
export async function generateImage(opts: {
  model: string;
  prompt: string;
  references?: ImageInput[];
  onAttempt?: Parameters<typeof withRetry>[1];
}): Promise<string> {
  return withRetry(async (signal) => {
    const interaction = await ai().interactions.create(
      {
        model: opts.model,
        input: toInput(opts.prompt, opts.references ?? []),
        response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "1:1", image_size: "1K" },
        store: false,
      },
      { signal, timeout_ms: CALL_TIMEOUT_MS, retries: { strategy: "none" } },
    );
    const b64 = interaction.output_image?.data;
    if (!b64) {
      const text = interaction.output_text?.slice(0, 200);
      throw new ModelError(text ? `No image returned: ${text}` : "No image returned", 502, true);
    }
    return b64;
  }, opts.onAttempt);
}

/**
 * One structured-output call: JSON schema in the request, zod validation on the way out.
 * Returns the raw text too so the inspector can show exactly what came back.
 */
export async function generateJson<S extends z.ZodType>(opts: {
  model: string;
  system: string;
  prompt: string;
  images?: ImageInput[];
  jsonSchema: Record<string, unknown>;
  zod: S;
  onAttempt?: Parameters<typeof withRetry>[1];
}): Promise<{ data: z.infer<S>; raw: string } | { error: string; raw: string }> {
  const raw = await withRetry(async (signal) => {
    const interaction = await ai().interactions.create(
      {
        model: opts.model,
        system_instruction: opts.system,
        input: toInput(opts.prompt, opts.images ?? []),
        response_format: { type: "text", mime_type: "application/json", schema: opts.jsonSchema },
        generation_config: { thinking_level: "low" },
        store: false,
      },
      { signal, timeout_ms: CALL_TIMEOUT_MS, retries: { strategy: "none" } },
    );
    const text = interaction.output_text;
    if (!text) throw new ModelError("Empty response", 502, true);
    return text;
  }, opts.onAttempt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return { error: "Response was not valid JSON.", raw };
  }
  const result = opts.zod.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 12)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { error: issues, raw };
  }
  return { data: result.data, raw };
}

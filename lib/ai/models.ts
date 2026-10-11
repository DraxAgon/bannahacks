// Model IDs checked against the @google/genai 2.28 model list and Google's models page (Oct 2026).
// Each can be overridden with an env var without a code change.
export const MODELS = {
  /** Nano Banana 2.1: image generation and reference-locked editing. */
  image: process.env.IMAGE_MODEL || "gemini-nano-banana-2.1",
  /** Planner: fast multimodal model with structured JSON output. */
  text: process.env.TEXT_MODEL || "gemini-3.8-flash",
  /** Vision critic. */
  critic: process.env.CRITIC_MODEL || "gemini-3.8-flash",
  /** Cheaper critic used when the main critic is rate limited. */
  criticFallback: process.env.CRITIC_FALLBACK_MODEL || "gemini-3.5-flash-lite",
} as const;

export function hasKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10);
}

import { generateJson, ModelError, parseDataUrl } from "@/lib/ai/client";
import { errorResponse, json, readBody } from "@/lib/ai/http";
import { MODELS } from "@/lib/ai/models";
import { criticPrompt, criticSystem } from "@/lib/ai/prompts";
import { CritiqueJsonSchema, CritiqueRequestSchema, CritiqueSchema } from "@/lib/ai/schemas";
import type { Attempt } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Stage 5: vision critic. Falls back to the lite model when the main critic is rate limited. */
export async function POST(req: Request) {
  const body = await readBody(req, CritiqueRequestSchema);
  if (body instanceof Response) return body;

  const images = [...(body.anchor ? [parseDataUrl(body.anchor)] : []), parseDataUrl(body.image)];
  const prompt = criticPrompt({ ...body, hasAnchor: Boolean(body.anchor) });
  const attempts: Attempt[] = [];

  const run = (model: string) =>
    generateJson({
      model,
      system: criticSystem(),
      prompt,
      images,
      jsonSchema: CritiqueJsonSchema,
      zod: CritiqueSchema,
      onAttempt: (i) =>
        attempts.push({
          stage: "critique",
          prompt,
          params: { model, images: images.length, mode: body.mode ?? "identity" },
          ms: i.ms,
          ok: i.ok,
          error: i.error,
          model,
          at: new Date().toISOString(),
        }),
    });

  try {
    let result;
    let model: string = MODELS.critic;
    try {
      result = await run(model);
      if ("error" in result) {
        attempts[attempts.length - 1].error = `Validation: ${result.error}`;
        result = await run(model);
      }
    } catch (err) {
      if (!(err instanceof ModelError) || MODELS.criticFallback === MODELS.critic) throw err;
      model = MODELS.criticFallback;
      result = await run(model);
    }
    if ("error" in result) {
      return json({ error: "invalid", message: "The critic's answer didn't validate.", detail: result.error, attempts }, 502);
    }
    const critique = { ...result.data, intensity: Math.round(result.data.intensity) };
    return json({ critique, model, raw: result.raw, attempts });
  } catch (err) {
    const res = errorResponse(err);
    const data = await res.json();
    return json({ ...data, attempts }, res.status);
  }
}

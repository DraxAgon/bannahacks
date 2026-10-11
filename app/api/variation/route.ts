import { generateJson } from "@/lib/ai/client";
import { errorResponse, json, readBody } from "@/lib/ai/http";
import { MODELS } from "@/lib/ai/models";
import { VARIATION_SYSTEM, variationPrompt } from "@/lib/ai/prompts";
import { VariationJsonSchema, VariationRequestSchema, VariationSchema } from "@/lib/ai/schemas";
import type { Attempt } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Stage 6 (variation): a short planner call for a different individual and a new context. */
export async function POST(req: Request) {
  const body = await readBody(req, VariationRequestSchema);
  if (body instanceof Response) return body;
  const prompt = variationPrompt(body);
  const attempts: Attempt[] = [];
  try {
    const result = await generateJson({
      model: MODELS.text,
      system: VARIATION_SYSTEM,
      prompt,
      jsonSchema: VariationJsonSchema,
      zod: VariationSchema,
      onAttempt: (i) =>
        attempts.push({
          stage: "variation",
          prompt,
          params: { model: MODELS.text, context: body.context ?? null },
          ms: i.ms,
          ok: i.ok,
          error: i.error,
          model: MODELS.text,
          at: new Date().toISOString(),
        }),
    });
    if ("error" in result) return json({ error: "invalid", message: "Variation plan didn't validate.", attempts }, 502);
    return json({ ...result.data, attempts });
  } catch (err) {
    return errorResponse(err);
  }
}

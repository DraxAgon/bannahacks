import { generateImage, NoKeyError, parseDataUrl } from "@/lib/ai/client";
import { errorResponse, json, readBody } from "@/lib/ai/http";
import { hasKey, MODELS } from "@/lib/ai/models";
import { isWordCard, rungPrompt } from "@/lib/ai/prompts";
import { RungRequestSchema } from "@/lib/ai/schemas";
import { checkImageQuota, clientIp } from "@/lib/guard";
import { clampDials, postParams } from "@/lib/pipeline/dials";
import { postprocess, toDataUrl } from "@/lib/pipeline/postprocess";
import type { Attempt } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Stage 3 + 4: reference-locked edit from deterministic dial prompt, then sharp post-processing. */
export async function POST(req: Request) {
  const body = await readBody(req, RungRequestSchema);
  if (body instanceof Response) return body;

  if (!hasKey()) return errorResponse(new NoKeyError());
  const quota = checkImageQuota(clientIp(req));
  if (!quota.ok) return json({ error: "limit", message: quota.message }, 429);

  const dials = clampDials(body.dials);
  const prompt = rungPrompt({ ...body, dials });
  // The word card is pure typography: no identity reference.
  const references = !isWordCard(dials) && body.anchor ? [parseDataUrl(body.anchor)] : [];
  const post = postParams(dials);
  const attempts: Attempt[] = [];

  try {
    const t0 = Date.now();
    const b64 = await generateImage({
      model: MODELS.image,
      prompt,
      references,
      onAttempt: (i) =>
        attempts.push({
          stage: "rung",
          prompt,
          params: {
            model: MODELS.image,
            references: references.length,
            safetyBoost: Boolean(body.safetyBoost),
            intensityHint: body.intensityHint ?? null,
          },
          ms: i.ms,
          ok: i.ok,
          error: i.error,
          model: MODELS.image,
          at: new Date().toISOString(),
        }),
    });
    const tp = Date.now();
    const out = await postprocess(Buffer.from(b64, "base64"), post);
    return json({
      image: toDataUrl(out),
      prompt,
      post,
      postMs: Date.now() - tp,
      ms: Date.now() - t0,
      attempts,
    });
  } catch (err) {
    const res = errorResponse(err);
    const data = await res.json();
    return json({ ...data, prompt, attempts }, res.status);
  }
}

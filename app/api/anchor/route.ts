import { generateImage, parseDataUrl } from "@/lib/ai/client";
import { errorResponse, json, readBody } from "@/lib/ai/http";
import { MODELS } from "@/lib/ai/models";
import { anchorPrompt } from "@/lib/ai/prompts";
import { AnchorRequestSchema } from "@/lib/ai/schemas";
import { checkImageQuota, clientIp } from "@/lib/guard";
import { normalizeJpeg, toDataUrl } from "@/lib/pipeline/postprocess";
import type { Attempt } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Stage 2: identity anchor. Uploaded reference photo (resized) or a neutral generated photo. */
export async function POST(req: Request) {
  const body = await readBody(req, AnchorRequestSchema);
  if (body instanceof Response) return body;

  try {
    if (body.upload) {
      const t0 = Date.now();
      const buf = await normalizeJpeg(Buffer.from(parseDataUrl(body.upload).data, "base64"));
      const attempts: Attempt[] = [
        { stage: "anchor", prompt: "(therapist upload, resized to 1024px)", params: { source: "upload" }, ms: Date.now() - t0, ok: true },
      ];
      return json({ image: toDataUrl(buf), source: "upload", attempts });
    }

    const quota = checkImageQuota(clientIp(req));
    if (!quota.ok) return json({ error: "limit", message: quota.message }, 429);

    const prompt = anchorPrompt(body.subject, body.preset);
    const attempts: Attempt[] = [];
    const b64 = await generateImage({
      model: MODELS.image,
      prompt,
      onAttempt: (i) =>
        attempts.push({
          stage: "anchor",
          prompt,
          params: { model: MODELS.image, aspect_ratio: "1:1", image_size: "1K" },
          ms: i.ms,
          ok: i.ok,
          error: i.error,
          model: MODELS.image,
          at: new Date().toISOString(),
        }),
    });
    const buf = await normalizeJpeg(Buffer.from(b64, "base64"));
    return json({ image: toDataUrl(buf), source: "generated", prompt, attempts });
  } catch (err) {
    return errorResponse(err);
  }
}

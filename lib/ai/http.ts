import "server-only";
import type { z } from "zod";
import { ModelError, NoKeyError } from "./client";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad-request", message: "Request body must be JSON." }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "bad-request",
        message: parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      400,
    );
  }
  return parsed.data;
}

/** Map pipeline errors to calm, typed JSON responses. Never logs prompts or images. */
export function errorResponse(err: unknown) {
  if (err instanceof NoKeyError) {
    return json({ error: "no-key", message: "Live generation isn't configured here. The demo ladders work fully." }, 503);
  }
  if (err instanceof ModelError) {
    const status = err.status === 429 ? 429 : 502;
    return json(
      {
        error: err.status === 429 ? "rate-limited" : "model",
        message:
          err.status === 429
            ? "The image service is busy right now. Please try again in a minute."
            : "The model couldn't complete this step.",
        detail: err.message,
        retryable: err.retryable,
      },
      status,
    );
  }
  return json({ error: "server", message: "Something went wrong on the server." }, 500);
}

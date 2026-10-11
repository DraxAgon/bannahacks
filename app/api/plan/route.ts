import { generateJson, NoKeyError } from "@/lib/ai/client";
import { errorResponse, json, readBody } from "@/lib/ai/http";
import { hasKey, MODELS } from "@/lib/ai/models";
import { PLANNER_SYSTEM, plannerPrompt, plannerRetryPrompt } from "@/lib/ai/prompts";
import { PlannedLadderSchema, PlannerJsonSchema, PlannerOutputSchema, PlanRequestSchema } from "@/lib/ai/schemas";
import { checkLadderQuota, clientIp } from "@/lib/guard";
import { clampDials } from "@/lib/pipeline/dials";
import { dialChangeWarnings, hierarchyProblems, respaceSuds } from "@/lib/pipeline/hierarchy";
import type { Attempt } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await readBody(req, PlanRequestSchema);
  if (body instanceof Response) return body;

  if (!hasKey()) return errorResponse(new NoKeyError());
  const quota = checkLadderQuota(clientIp(req));
  if (!quota.ok) return json({ error: "limit", message: quota.message }, 429);

  const attempts: Attempt[] = [];
  const record = (prompt: string) => (info: { ms: number; ok: boolean; error?: string }) =>
    attempts.push({
      stage: "plan",
      prompt,
      params: { model: MODELS.text, rungCount: body.rungCount, startWithWord: body.startWithWord },
      ms: info.ms,
      ok: info.ok,
      error: info.error,
      model: MODELS.text,
      at: new Date().toISOString(),
    });

  try {
    let prompt = plannerPrompt(body);
    let result = await generateJson({
      model: MODELS.text,
      system: PLANNER_SYSTEM,
      prompt,
      jsonSchema: PlannerJsonSchema,
      zod: PlannerOutputSchema,
      onAttempt: record(prompt),
    });

    // Validate structure + hierarchy rules; on failure retry once with the errors appended.
    const problemsOf = (r: typeof result): string | null => {
      if ("error" in r) return r.error;
      if (r.data.refused) return null;
      const strict = PlannedLadderSchema.safeParse(r.data);
      if (!strict.success) {
        return strict.error.issues
          .slice(0, 12)
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ");
      }
      const p = hierarchyProblems(strict.data.rungs, body.rungCount, body.startWithWord);
      return p.length ? p.join("\n") : null;
    };

    let problems = problemsOf(result);
    let retried = false;
    if (problems) {
      const last = attempts[attempts.length - 1];
      if (last) last.error = `Validation: ${problems}`.slice(0, 600);
      retried = true;
      prompt = plannerRetryPrompt(body, problems);
      result = await generateJson({
        model: MODELS.text,
        system: PLANNER_SYSTEM,
        prompt,
        jsonSchema: PlannerJsonSchema,
        zod: PlannerOutputSchema,
        onAttempt: record(prompt),
      });
      problems = problemsOf(result);
    }

    if ("error" in result) {
      return json({ error: "invalid", message: "The planner's answer didn't validate twice.", detail: result.error, attempts }, 502);
    }
    const out = result.data;
    if (!out.refused && problems && !PlannedLadderSchema.safeParse(out).success) {
      return json({ error: "invalid", message: "The planner's answer didn't validate twice.", detail: problems, attempts }, 502);
    }
    if (out.refused) {
      return json({
        refused: true,
        reason:
          out.reason ||
          "Fear Ladder is designed for specific phobias that are suitable for image exposure, so it can't build this ladder.",
        attempts,
      });
    }
    const ladder = PlannedLadderSchema.parse(out);

    const warnings: string[] = [];
    let rungs = ladder.rungs.slice(0, body.rungCount).map((r) => ({
      ...r,
      targetSuds: Math.round(r.targetSuds),
      dials: clampDials(r.dials),
      noticePrompts: r.noticePrompts.slice(0, 3),
    }));
    if (body.startWithWord && rungs[0]) rungs[0].dials = { ...rungs[0].dials, realism: 0 };

    // Deterministic repair if the planner still broke the SUDS rules after its retry.
    const remaining = hierarchyProblems(rungs, rungs.length, body.startWithWord);
    if (remaining.length) {
      const spaced = respaceSuds(rungs.length);
      rungs = rungs.map((r, i) => ({ ...r, targetSuds: spaced[i] }));
      warnings.push(`Target SUDS re-spaced evenly after planner retry: ${remaining.join(" ")}`);
    }
    warnings.push(...dialChangeWarnings(rungs));

    return json({
      refused: false,
      subject: ladder.subject,
      rungs,
      warnings,
      retried,
      raw: result.raw,
      attempts,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

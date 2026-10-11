# Fear Ladder — build plan

Hard stop: **11:59 PM EDT, Sun Oct 11 2026** (03:59 UTC). Started 16:30 EDT.

## Phases (each ends green: typecheck, lint, build, commit)
1. **Skeleton** — Next 16 App Router, tokens, fonts, landing with real copy, empty routes.
2. **Pipeline** — `lib/ai/*` (models, client w/ retry+timeout, prompts, zod schemas), `/api/{plan,anchor,rung,critique,health}`, sharp post-process, browser orchestrator (concurrency 3, critic auto-repair), `scripts/seed-demo.ts`.
3. **Ladder view** — builder, live-filling ladder, develop animation, rung drawer + dials, regenerate / variation, Pipeline Inspector.
4. **Session** — prediction, hold-to-view (Space / press), SUDS sampling, breathe pause, reflection, next-step card, live half-steps.
5. **Fear model + report** — ridge regression w/ planner prior, radar, recharts, print CSS.
6. **Seed, harden, deploy** — demo ladders, spend guard, error/empty states, Vercel.
7. **Submission** — README, DEVPOST.md, DEMO_SCRIPT.md, screenshots, Playwright golden path.

Cut order if late: variations → radar (keep model) → extra report charts → photo upload.

## File tree
```
app/  page.tsx · new/ · ladder/[id]/{page,session/page,report/page}.tsx · api/{plan,anchor,rung,critique,health}/route.ts
lib/  types.ts · ai/{models,client,prompts,schemas}.ts · pipeline/{buildLadder,postprocess,dials}.ts
      model/fearModel.ts · store.ts · demo.ts · guard.ts
components/  Ladder, RungCard, RungDrawer, DialEditor, PipelineInspector, SudsSlider, HoldToView, BreathePause, FearFingerprint, …
public/demo/{spiders,dogs,needles}/  ladder.json + jpgs
scripts/seed-demo.ts · tests/golden.spec.ts · docs/screenshots/
```

## Decisions & doc deltas (docs win)
- **SDK verified from installed `@google/genai@2.28` types:** `ai.interactions.create({ model, input: [{type:"text"},{type:"image",mime_type,data}], response_format })`. Image: `response_format: {type:"image", mime_type:"image/jpeg", aspect_ratio:"1:1", image_size:"1K"}` → `interaction.output_image.data`. JSON: `response_format: {type:"text", mime_type:"application/json", schema}` → `interaction.output_text`. Timeout via request option `timeout_ms`.
- Model IDs: `gemini-nano-banana-2.1` ✓ (GA, recommended), `gemini-3.8-flash` ✓, `gemini-3.5-flash-lite` ✓ (in docs, not yet in the SDK's literal union — the field accepts any string). ai.google.dev is blocked by this container's egress proxy, so model facts come from the SDK types/changelog plus search snippets; the Gemini API host itself is reachable.
- Use the Interactions API (the `generateContent` route is labelled legacy and can't return JPEG with an API key).
- `cacheComponents` turned **off**: the app is client-heavy (IndexedDB), so PPR adds no value and forces Suspense around `useParams`.
- **Repo:** this session is scoped to `DraxAgon/bannahacks` on branch `claude/fear-ladder-web-app-fo4jiq`, so code ships there (not a new `fear-ladder` repo).
- **Key:** cloud container → key comes from env (environment settings or Vercel env), never chat. The seed script can run against a deployed URL (`SEED_BASE_URL`) so the key never needs to be local.
- Orchestration runs in the browser (and in the seed script via the same module), one model call per route, `maxDuration = 60`.

## Open risks
- No key yet → demo ladders can't be seeded until one is available. Demo mode never shows placeholder art; until seeded, demo buttons explain that.
- Image-model rate limits → concurrency 3 + backoff; critic falls back to lite model.
- Vercel body limit (4.5 MB) → images travel as 1K JPEG q85 (~150–300 KB).
- Next 16 is newer than training data → read `node_modules/next/dist/docs` before using APIs.

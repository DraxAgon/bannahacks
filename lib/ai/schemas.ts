import { z } from "zod";

const unit = z.number().min(0).max(1);

export const DialsSchema = z.object({
  realism: unit,
  proximity: unit,
  size: unit,
  contact: unit,
  count: z.number().min(1).max(6),
  clarity: unit,
  color: unit,
  motion: unit,
});

export const PlannedRungSchema = z.object({
  title: z.string().min(2).max(90),
  rationale: z.string().min(4).max(400),
  targetSuds: z.number().min(0).max(100),
  dials: DialsSchema,
  scene: z.string().min(3).max(400),
  noticePrompts: z.array(z.string().min(3).max(160)).min(2).max(3),
});

export const SubjectSchema = z.object({
  name: z.string().min(2).max(60),
  canonical: z.string().min(10).max(500),
});

/**
 * Raw planner output: either a refusal or a ladder. Structured output only fills required
 * fields, so every field is required in the JSON schema; a refusal returns an empty subject
 * and rungs. When not refused, the strict schema below validates the ladder.
 */
export const PlannerOutputSchema = z.object({
  refused: z.boolean(),
  reason: z.string().nullish(),
  subject: z.object({ name: z.string(), canonical: z.string() }).nullish(),
  rungs: z.array(z.unknown()).nullish(),
});
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

export const PlannedLadderSchema = z.object({
  subject: SubjectSchema,
  rungs: z.array(PlannedRungSchema).min(1),
});

export const CritiqueSchema = z.object({
  subjectPresent: z.boolean(),
  identityMatch: unit,
  intensity: z.number().min(0).max(100),
  unsafe: z.boolean(),
  unsafeReason: z.string().nullable(),
  note: z.string().max(400),
});

export const VariationSchema = z.object({
  individual: z.string().min(3).max(200),
  scene: z.string().min(3).max(300),
  noticePrompts: z.array(z.string().min(3).max(160)).min(2).max(3),
});

// ── JSON schemas sent as response_format (kept simple: the Gemini schema subset) ──
const num = (min: number, max: number, description?: string) => ({
  type: "number",
  minimum: min,
  maximum: max,
  ...(description ? { description } : {}),
});

const dialsJson = {
  type: "object",
  properties: {
    realism: num(0, 1, "0 word on a card, 0.25 line drawing, 0.5 friendly illustration, 0.75 painterly, 1 photo"),
    proximity: num(0, 1, "0 far across a room, 1 macro close-up"),
    size: num(0, 1, "share of the frame: 0 tiny, 1 fills the frame"),
    contact: num(0, 1, "0 contained (jar, glass, leash), 0.5 near a person, 1 calm contact (on an open hand)"),
    count: { type: "integer", minimum: 1, maximum: 6, description: "number of subjects, 1 to 6" },
    clarity: num(0, 1, "0 heavily blurred, 1 sharp"),
    color: num(0, 1, "0 grayscale, 1 full colour"),
    motion: num(0, 1, "0 still, 1 implied movement toward the viewer"),
  },
  required: ["realism", "proximity", "size", "contact", "count", "clarity", "color", "motion"],
};

export const PlannerJsonSchema = {
  type: "object",
  properties: {
    refused: { type: "boolean" },
    reason: { type: "string", description: "When refused: one calm sentence explaining why. Otherwise an empty string." },
    subject: {
      type: "object",
      properties: {
        name: { type: "string", description: "short noun, e.g. 'house spider'" },
        canonical: {
          type: "string",
          description: "precise visual identity: species or object, colours, markings, proportions",
        },
      },
      required: ["name", "canonical"],
    },
    rungs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          rationale: { type: "string", description: "one clinician-facing sentence" },
          targetSuds: { type: "integer", minimum: 0, maximum: 100 },
          dials: dialsJson,
          scene: { type: "string", description: "short setting description, no people's faces" },
          noticePrompts: { type: "array", items: { type: "string" }, description: "2 to 3 prompts" },
        },
        required: ["title", "rationale", "targetSuds", "dials", "scene", "noticePrompts"],
      },
      description: "Exactly N rungs, bottom (calmest) first. Empty only when refused.",
    },
  },
  required: ["refused", "reason", "subject", "rungs"],
};

export const CritiqueJsonSchema = {
  type: "object",
  properties: {
    subjectPresent: { type: "boolean" },
    identityMatch: num(0, 1, "how closely the subject matches the reference identity"),
    intensity: { type: "integer", minimum: 0, maximum: 100, description: "estimated SUDS for this phobia" },
    unsafe: { type: "boolean" },
    unsafeReason: { type: ["string", "null"] },
    note: { type: "string", description: "one short sentence for the clinician" },
  },
  required: ["subjectPresent", "identityMatch", "intensity", "unsafe", "unsafeReason", "note"],
};

export const VariationJsonSchema = {
  type: "object",
  properties: {
    individual: {
      type: "string",
      description: "a different individual of the same kind: colours, markings, size differences",
    },
    scene: { type: "string" },
    noticePrompts: { type: "array", items: { type: "string" } },
  },
  required: ["individual", "scene", "noticePrompts"],
};

// ── Request bodies (validated in routes) ──
export const PlanRequestSchema = z.object({
  preset: z.enum(["spiders", "dogs", "snakes", "needles", "birds", "bees", "heights", "other"]),
  description: z.string().min(3).max(1200),
  worst: z.string().max(600).optional(),
  okay: z.string().max(600).optional(),
  rungCount: z.number().int().min(6).max(10),
  startWithWord: z.boolean(),
});

const dataUrl = z.string().startsWith("data:image/").max(6_000_000);

export const AnchorRequestSchema = z.object({
  subject: SubjectSchema,
  preset: z.string().optional(),
  upload: dataUrl.optional(),
});

export const RungRequestSchema = z.object({
  subject: SubjectSchema,
  dials: DialsSchema,
  scene: z.string().min(1).max(400),
  anchor: dataUrl.optional(),
  preset: z.string().optional(),
  safetyBoost: z.boolean().optional(),
  intensityHint: z.enum(["gentler", "stronger"]).optional(),
  individual: z.string().max(200).optional(),
});

export const CritiqueRequestSchema = z.object({
  subject: SubjectSchema,
  fear: z.string().max(200),
  anchor: dataUrl.optional(),
  image: dataUrl,
  targetSuds: z.number().min(0).max(100),
  mode: z.enum(["identity", "kind"]).optional(),
  isWordCard: z.boolean().optional(),
});

export const VariationRequestSchema = z.object({
  subject: SubjectSchema,
  fear: z.string().max(200),
  scene: z.string().max(400),
  title: z.string().max(120),
  avoid: z.array(z.string().max(400)).max(12).optional(),
  context: z.string().max(80).optional(),
});

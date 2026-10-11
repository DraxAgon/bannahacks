import type { Dials, PlanRequest } from "../types";

/** Planner system prompt (Stage 1). */
export const PLANNER_SYSTEM = `You help a licensed therapist design a graded exposure hierarchy of IMAGES for one patient with a specific phobia. Return JSON only, matching the schema.
(1) Choose ONE concrete subject and describe it precisely in subject.canonical: species or object, colours, markings, proportions. Every rung shows this same subject.
(2) Produce N rungs whose target SUDS rise monotonically from 5 to 15 up to 85 to 95, with no gap above 15.
(3) Express each rung as dial values (realism, proximity, size, contact, count, clarity, color, motion; ranges in the schema) plus a short scene. Change at most two dials between neighbours. Use low clarity mainly on the first photographic rungs.
(4) Personalize: put the patient's named triggers in the top third. If startWithWord is true, rung 1 is the word itself printed on a plain card (realism 0).
(5) Never depict blood, injury, aggression, attacks, death, children in danger, or identifiable real people. Contact rungs show calm contact only.
(6) Give each rung a one-sentence clinician-facing rationale and 2 to 3 noticePrompts that direct attention to visible details.
(7) If the request is not a specific phobia suitable for image exposure (trauma memories, self-harm, eating, real people, sexual content), return { "refused": true, "reason": "..." }.
Otherwise return refused: false with subject and rungs.`;

const PRESET_NOTES: Record<string, string> = {
  heights:
    "This is a fear of HEIGHTS. The subject is a PLACE (for example a balcony or a glass bridge), not a creature. proximity means closeness to the edge; contact means how exposed the edge is (0 behind a high solid wall, 1 at a low glass barrier); size means how much of the frame the drop occupies; count stays 1; motion means a sense of leaning or looking down.",
  needles:
    "This is a blood-injection-injury fear. Never show blood, skin puncture or injury. contact 1 means an uncapped needle held close to a relaxed upper arm, not piercing. count is the number of syringes.",
  dogs: "Contained (contact 0) means on a leash behind a fence. Motion means trotting toward the viewer; never snarling or bared teeth.",
};

export function plannerPrompt(req: PlanRequest): string {
  const lines = [
    `Fear preset: ${req.preset}`,
    `Patient's fear, in the therapist's words: "${req.description.trim()}"`,
    req.worst?.trim() ? `Worst image (use for the top rung): "${req.worst.trim()}"` : "",
    req.okay?.trim() ? `Already okay with (stay at or below this at the bottom): "${req.okay.trim()}"` : "",
    `N (number of rungs): ${req.rungCount}`,
    `startWithWord: ${req.startWithWord}`,
    PRESET_NOTES[req.preset] ?? "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function plannerRetryPrompt(req: PlanRequest, errors: string): string {
  return `${plannerPrompt(req)}\n\nYour previous answer failed validation. Fix these problems and return the full JSON again:\n${errors}`;
}

// ── Stage 3: deterministic rung prompt from dials ──

export function styleFor(realism: number, name: string): string {
  if (realism < 0.125) return `the word "${name}" in plain black type on a white card`;
  if (realism < 0.375) return "a simple black ink line drawing on white paper";
  if (realism < 0.625) return "a soft, friendly flat illustration with rounded shapes and gentle colours";
  if (realism < 0.875) return "a detailed painterly illustration";
  return "a realistic photograph";
}

export const isWordCard = (d: Dials) => d.realism < 0.125;

const CARD_WORDS: Record<string, string> = {
  spiders: "spider",
  dogs: "dog",
  snakes: "snake",
  needles: "needle",
  birds: "bird",
  bees: "wasp",
  heights: "heights",
};

/** Rung 1 shows the everyday word for the fear, not the planner's precise species name. */
export function cardWord(preset: string | undefined, name: string): string {
  return CARD_WORDS[preset ?? ""] ?? name;
}

function distancePhrase(p: number, heights: boolean): string {
  if (heights) {
    if (p < 0.2) return "from well back, far from the edge";
    if (p < 0.45) return "from a few steps back from the edge";
    if (p < 0.7) return "from close to the edge";
    if (p < 0.9) return "from right at the edge, looking over";
    return "from right at the edge, looking straight down";
  }
  if (p < 0.15) return "from far across a large room";
  if (p < 0.35) return "from across the room";
  if (p < 0.55) return "from a few metres away";
  if (p < 0.75) return "from about an arm's length away";
  if (p < 0.9) return "up close";
  return "in a macro close-up";
}

function countPhrase(n: number, name: string): string {
  const c = Math.max(1, Math.min(6, Math.round(n)));
  if (c === 1) return `There is exactly one ${name}.`;
  const words = ["", "", "two", "three", "four", "five", "six"];
  return `There are exactly ${words[c]} of them, the same kind of ${name}.`;
}

const CONTAINERS: Record<string, string> = {
  spiders: "inside a closed clear glass jar",
  bees: "inside a closed clear glass jar",
  snakes: "behind glass in a terrarium",
  dogs: "on a leash behind a low garden fence",
  needles: "capped, inside its sealed packaging",
  birds: "inside a roomy wire cage",
  heights: "behind a high, solid wall",
};

const CONTACT_TOP: Record<string, string> = {
  spiders: "It rests calmly on an open, relaxed palm; only the hand is visible, no face.",
  bees: "It rests calmly on the back of a relaxed hand; only the hand is visible, no face.",
  snakes: "It rests calmly across a relaxed forearm; only the arm is visible, no face.",
  dogs: "A relaxed hand gently rests on its back; only the hand is visible, no face.",
  needles:
    "The uncapped needle is held close to a relaxed bare upper arm, not touching the skin; only the arm and a gloved hand are visible.",
  birds: "It perches calmly on a relaxed open hand; only the hand is visible, no face.",
  heights: "Only a low glass barrier separates the viewer from the drop.",
};

function contactPhrase(c: number, preset: string): string {
  const key = CONTAINERS[preset] ? preset : "spiders";
  if (c < 0.2) return `It is safely contained, ${CONTAINERS[key]}.`;
  if (c < 0.4) return preset === "heights" ? "A sturdy chest-high railing runs along the edge." : "Nothing else is near it.";
  if (c < 0.65)
    return preset === "heights"
      ? "A waist-high railing runs along the edge."
      : "It is near a person; only a calm hand or forearm is visible at the edge of the frame, no face.";
  if (c < 0.85)
    return preset === "heights"
      ? "A thin railing is the only barrier."
      : "It is close to a calm person's relaxed hand or arm, no face visible.";
  return CONTACT_TOP[key];
}

function motionPhrase(m: number, preset: string): string {
  if (m < 0.2) return preset === "heights" ? "" : "It is completely still.";
  if (m < 0.6) {
    if (preset === "needles") return "The syringe is being moved slowly.";
    if (preset === "heights") return "The view tilts slightly downward.";
    return "It appears to be moving slowly, mid-step.";
  }
  if (preset === "needles") return "The syringe is being brought toward the viewer, with a slight motion blur.";
  if (preset === "heights") return "The view leans forward over the edge, looking down.";
  if (preset === "dogs") return "It is trotting toward the viewer in a friendly way, with a slight motion blur on the legs.";
  return "It is moving toward the viewer, with a slight sense of motion.";
}

export function rungPrompt(opts: {
  subject: { name: string; canonical: string };
  dials: Dials;
  scene: string;
  preset?: string;
  safetyBoost?: boolean;
  intensityHint?: "gentler" | "stronger";
  individual?: string;
}): string {
  const { subject, dials: d, scene } = opts;
  const preset = opts.preset ?? "spiders";
  const heights = preset === "heights";

  if (isWordCard(d)) {
    return [
      `The single word "${cardWord(preset, subject.name)}" in plain black sans-serif type, centred on a plain white index card lying flat on a light wooden table.`,
      "Nothing else in the image: no pictures, no drawings, no other text.",
      "Calm, even lighting. Square image.",
    ].join("\n");
  }

  const identity = opts.individual
    ? `Use the reference image only as a guide to the kind of subject: show a different individual ${subject.name} of the same kind (${opts.individual}).`
    : `Use the reference image only to keep the subject's identity: the exact same ${subject.name} (${subject.canonical}).`;
  const sizePct = Math.round(5 + d.size * 85);
  const lines = [
    identity,
    `Style: ${styleFor(d.realism, subject.name)}. Framing: it fills about ${sizePct}% of the frame, seen ${distancePhrase(d.proximity, heights)}.`,
    `Setting: ${scene.trim().replace(/\.$/, "")}. ${countPhrase(d.count, subject.name)} ${contactPhrase(d.contact, preset)} ${motionPhrase(d.motion, preset)}`.trim(),
    "Calm, even lighting. No text unless asked. No blood, injury, aggression or human faces. Square image.",
  ];
  if (opts.intensityHint === "gentler")
    lines.push("Make the subject a little less prominent and calmer than you otherwise would.");
  if (opts.intensityHint === "stronger") lines.push("Make the subject a little more noticeable and detailed, still calm.");
  if (opts.safetyBoost)
    lines.push(
      "Strictly: absolutely no blood, wounds, injury, skin puncture, bared teeth, aggression, attack, death, children, or any person's face. Keep the mood calm, neutral and documentary.",
    );
  return lines.join("\n");
}

export function anchorPrompt(subject: { name: string; canonical: string }, preset?: string): string {
  if (preset === "heights") {
    return `A realistic, evenly lit photograph of ${subject.canonical}. Show the place itself from a safe distance, daytime, no people, no text. Calm and neutral, documentary style. Square image.`;
  }
  return `A realistic, neutral, evenly lit photograph of a single ${subject.name}: ${subject.canonical}. Centred on a plain light-grey seamless background, whole subject visible, no people, no text. Calm and neutral, documentary style. Square image.`;
}

// ── Stage 5: vision critic ──

export function criticSystem(): string {
  return `You are a careful visual safety and quality reviewer for exposure-therapy images that a licensed therapist will show a patient. Return JSON only, matching the schema.
- subjectPresent: is the intended subject clearly present? (For a word card: is the word clearly printed?)
- identityMatch (0 to 1): how well the subject matches the reference image's identity: kind, species or breed, colours, markings, proportions. For a word card, return 1 if the word is correct. For drawings and illustrations judge whether a viewer would recognise the same subject.
- intensity (0 to 100): the SUDS this image would likely provoke in an adult with a moderate phobia of this subject, considering realism, size in frame, proximity, number, implied motion and contact with a person. Calibrate: a word on a card is 5 to 10; a small friendly illustration 15 to 25; a clear photo at a few metres 40 to 55; a close, sharp photo 70 to 80; a sharp close-up with calm contact 85 to 95.
- unsafe: true if there is ANY blood, wound, injury, skin puncture, gore, aggression or attack, bared teeth or snarling, death, a child in danger, sexual content, or an identifiable human face. unsafeReason: short reason, or null.
- note: one short, neutral sentence for the clinician about the image.`;
}

export function criticPrompt(opts: {
  subject: { name: string; canonical: string };
  fear: string;
  targetSuds: number;
  mode?: "identity" | "kind";
  hasAnchor: boolean;
  isWordCard?: boolean;
}): string {
  return [
    `Phobia: ${opts.fear}. Subject: ${opts.subject.name} (${opts.subject.canonical}).`,
    opts.hasAnchor
      ? "Image 1 is the identity reference. Image 2 is the candidate rung to review."
      : "The only image is the candidate rung to review.",
    opts.mode === "kind"
      ? "This rung is a deliberate variation: score identityMatch on whether it is the same KIND of subject, not the same individual."
      : "",
    opts.isWordCard ? "This rung is meant to be the word printed on a card." : "",
    `The therapist planned this rung at about SUDS ${Math.round(opts.targetSuds)}; estimate intensity independently.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Stage 6: variation planner ──

export const VARIATION_SYSTEM = `You help a licensed therapist add stimulus variability to an image exposure ladder. Return JSON only. Describe a DIFFERENT individual of the same kind as the ladder's subject (natural variation in colour, markings or build, similar size class) and a new everyday setting, keeping the same distance, framing and level of contact so the intensity stays the same. Never include blood, injury, aggression, children in danger or identifiable people. Give 2 to 3 notice prompts about visible details.`;

export function variationPrompt(opts: {
  subject: { name: string; canonical: string };
  fear: string;
  title: string;
  scene: string;
  avoid?: string[];
  context?: string;
}): string {
  return [
    `Phobia: ${opts.fear}. Ladder subject: ${opts.subject.name} (${opts.subject.canonical}).`,
    `Rung: "${opts.title}". Current scene: "${opts.scene}".`,
    opts.context ? `Place the new scene in this context: ${opts.context}.` : "Choose a new everyday context.",
    opts.avoid?.length ? `Avoid repeating these scenes: ${opts.avoid.map((s) => `"${s}"`).join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

import type { FearPreset } from "./types";

export type PresetInfo = {
  id: FearPreset;
  label: string;
  /** Shown as the description placeholder in the builder. */
  example: string;
  beta?: boolean;
};

export const PRESETS: PresetInfo[] = [
  {
    id: "spiders",
    label: "Spiders",
    example: "Big hairy spiders, worst when they move toward me; tiny ones far away are fine.",
  },
  {
    id: "dogs",
    label: "Dogs",
    example: "Big dogs, especially barking or jumping up. Small calm dogs on a leash across the street are fine.",
  },
  {
    id: "snakes",
    label: "Snakes",
    example: "Snakes on the ground near my feet; a snake behind glass at the zoo is manageable.",
  },
  {
    id: "needles",
    label: "Needles",
    example: "Vaccination needles, worst when uncapped and close to my arm. A capped syringe in a photo is okay.",
  },
  {
    id: "birds",
    label: "Birds",
    example: "Pigeons flapping near my face. Birds sitting still far away on a wire are okay.",
  },
  {
    id: "bees",
    label: "Bees and wasps",
    example: "Wasps buzzing near my food or landing on me. A bee on a flower across the garden is fine.",
  },
  {
    id: "heights",
    label: "Heights",
    example: "Looking down from a high glass balcony. Standing well back from a railing on a low terrace is okay.",
    beta: true,
  },
  {
    id: "other",
    label: "Other",
    example: "Describe the specific thing the patient fears, what makes it worse, and what is already manageable.",
  },
];

export function presetLabel(id: FearPreset | undefined): string {
  return PRESETS.find((p) => p.id === id)?.label ?? "Specific phobia";
}

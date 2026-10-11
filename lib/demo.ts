import type { Ladder } from "./types";

export type DemoInfo = { slug: "spiders" | "dogs" | "needles"; label: string; description: string };

export const DEMOS: DemoInfo[] = [
  {
    slug: "spiders",
    label: "Spiders",
    description:
      "Large hairy spiders, worst when they move toward me or sit on a person. Tiny spiders far away are okay.",
  },
  {
    slug: "dogs",
    label: "Dogs",
    description:
      "Big dogs, especially barking or jumping up. Small calm dogs on a leash across the street are fine.",
  },
  {
    slug: "needles",
    label: "Needles",
    description:
      "Vaccination needles, worst when the needle is uncapped and close to my arm. A capped syringe in a photo is okay.",
  },
];

export const demoId = (slug: string) => `demo-${slug}`;

/** Fetch a pre-generated demo ladder from /public/demo. Returns null if it has not been seeded. */
export async function fetchDemoLadder(slug: string): Promise<Ladder | null> {
  try {
    const res = await fetch(`/demo/${slug}/ladder.json`, { cache: "force-cache" });
    if (!res.ok) return null;
    const ladder = (await res.json()) as Ladder;
    return { ...ladder, id: demoId(slug), source: "demo" };
  } catch {
    return null;
  }
}

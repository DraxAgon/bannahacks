export type Evidence = { stat: string; text: string; source: string; href: string };

export const EVIDENCE: Evidence[] = [
  {
    stat: "9.1%",
    text: "of U.S. adults had a specific phobia in the past year; 12.5% will at some point in their lives.",
    source: "NIMH",
    href: "https://www.nimh.nih.gov/health/statistics/specific-phobia",
  },
  {
    stat: "~11%",
    text: "of people with a specific phobia receive minimally adequate treatment in a year.",
    source: "NCS-R data, NIMH",
    href: "https://www.nimh.nih.gov/sites/default/files/documents/health/statistics/prevalence/file_12.pdf",
  },
  {
    stat: "7%",
    text: "Exposure therapy is highly effective but underused: in some surveys as few as 7% of therapists and patients report providing or receiving it.",
    source: "Kemp et al., 2023 (PMC)",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9975163/",
  },
  {
    stat: "8 stages",
    text: "An online hierarchy of spider images reduced fear, and generalizing across multiple images predicted improvement.",
    source: "Matthews, Naran & Kirkby",
    href: "https://doi.org/10.1016/j.jbtep.2014.12.003",
  },
  {
    stat: "66 people",
    text: "In a randomized trial, six 30-minute sessions with the Phobys AR app reduced fear of real spiders versus no intervention.",
    source: "University of Basel",
    href: "https://www.unibas.ch/en/News-Events/News/Uni-Research/Augmented-reality-helps-tackle-fear-of-spiders.html",
  },
];

export const SOURCES = {
  craske2014: "https://doi.org/10.1016/j.brat.2014.04.006",
  optexNexus: "https://doi.org/10.1016/j.brat.2022.104069",
  therapistAidHierarchy: "https://www.therapistaid.com/therapy-guide/creating-an-exposure-hierarchy-guide",
  therapistAidLog: "https://www.therapistaid.com/therapy-worksheet/exposure-tracking-log",
  phobysPaper: "https://doi.org/10.1016/j.janxdis.2021.102442",
  feardrop: "https://doi.org/10.3233/978-1-60750-561-7-73",
};

export const STRATEGIES: { strategy: string; feature: string }[] = [
  {
    strategy: "Expectancy violation",
    feature: "Before each exposure the patient names the feared outcome and rates its likelihood; afterwards, whether it happened and how surprised they are.",
  },
  {
    strategy: "Attention to the stimulus",
    feature: "Every rung carries notice prompts (“How many legs can you count?”) shown during exposure.",
  },
  {
    strategy: "Removing safety signals",
    feature: "Switch from hold-to-view to steady view; every release is counted as an avoidance signal.",
  },
  {
    strategy: "Stimulus variability",
    feature: "“New variation” renders the same intensity with a different individual, angle or setting.",
  },
  { strategy: "Multiple contexts", feature: "Variations can move the subject to a kitchen, garden or bathroom." },
  { strategy: "Affect labelling", feature: "Optional feeling chips after exposure: scared, disgusted, tense, okay." },
  { strategy: "Mental rehearsal", feature: "“What did you learn?” after each rung, collected in the report." },
];

export const SAFETY: { title: string; body: string }[] = [
  {
    title: "Specific phobias only",
    body: "The planner declines trauma imagery, self-harm, eating-related content, sexual content and real people, and says why in one calm sentence.",
  },
  {
    title: "Checked three times",
    body: "No blood, injury, aggression or children in danger: enforced in the planner, the image prompt and a vision critic. Unsafe images are never shown.",
  },
  {
    title: "The patient stays in control",
    body: "Images start blurred, the patient chooses when to look, Pause is one tap away, and nothing advances on its own.",
  },
  {
    title: "Private by default",
    body: "No accounts, aliases only. Everything lives in this browser’s storage; the server keeps no prompts or images.",
  },
];

export type Dials = {
  /** 0 the word on a card, 0.25 line drawing, 0.5 friendly illustration, 0.75 painterly, 1 photo */
  realism: number;
  /** 0 far across a room, 1 macro close-up */
  proximity: number;
  /** share of the frame, 0 tiny, 1 fills the frame */
  size: number;
  /** 0 contained (jar, glass, leash), 0.5 near a person, 1 calm contact (on an open hand) */
  contact: number;
  /** 1 to 6 subjects */
  count: number;
  /** 0 heavily blurred, 1 sharp */
  clarity: number;
  /** 0 grayscale, 1 full colour */
  color: number;
  /** 0 still, 1 implied movement toward the viewer */
  motion: number;
};

export type DialKey = keyof Dials;

export type Critique = {
  subjectPresent: boolean;
  identityMatch: number;
  intensity: number;
  unsafe: boolean;
  unsafeReason: string | null;
  note: string;
};

export type AttemptStage = "plan" | "anchor" | "rung" | "critique" | "variation";

export type Attempt = {
  stage: AttemptStage;
  prompt: string;
  params: Record<string, unknown>;
  critique?: Critique;
  ms: number;
  ok: boolean;
  error?: string;
  model?: string;
  at?: string;
};

export type RungStatus = "pending" | "generating" | "ready" | "error";
export type RungKind = "planned" | "half-step" | "variation";

export type Rung = {
  id: string;
  index: number;
  title: string;
  rationale: string;
  targetSuds: number;
  dials: Dials;
  scene: string;
  noticePrompts: string[];
  image?: string;
  critique?: Critique;
  attempts: Attempt[];
  status: RungStatus;
  kind: RungKind;
  parentId?: string;
  /** Human-readable reason when status is "error". */
  error?: string;
  /** The exact prompt sent to the image model for the shown image. */
  prompt?: string;
  /** Post-processing applied to the shown image. */
  post?: PostParams;
};

export type ViewMode = "hold" | "steady";
export type ProgressMode = "expectancy" | "habituation";

export type LadderSettings = {
  view: ViewMode;
  exposureSeconds: number;
  mode: ProgressMode;
};

export type FearPreset =
  | "spiders"
  | "dogs"
  | "snakes"
  | "needles"
  | "birds"
  | "bees"
  | "heights"
  | "other";

export type PlanRequest = {
  preset: FearPreset;
  description: string;
  worst?: string;
  okay?: string;
  rungCount: number;
  startWithWord: boolean;
};

export type Ladder = {
  id: string;
  createdAt: string;
  alias: string;
  fear: string;
  preset?: FearPreset;
  description: string;
  subject: { name: string; canonical: string };
  anchorImage?: string;
  anchorSource?: "generated" | "upload";
  rungs: Rung[];
  settings: LadderSettings;
  source: "live" | "demo";
  /** Raw validated planner output, for the Pipeline Inspector. */
  plan?: unknown;
  planAttempts?: Attempt[];
  anchorAttempts?: Attempt[];
  request?: PlanRequest;
  status?: "planning" | "anchoring" | "rendering" | "ready" | "error" | "refused";
  error?: string;
};

export type Exposure = {
  rungId: string;
  startedAt: string;
  endedAt?: string;
  lookMs: number;
  releases: number;
  samples: { t: number; suds: number }[];
  prediction: string;
  likelihood: number;
  expectedSuds: number;
  peakSuds: number;
  endSuds: number;
  happened: "yes" | "partly" | "no";
  surprise: number;
  learned: string;
  feelings: string[];
};

export type Session = {
  id: string;
  ladderId: string;
  startedAt: string;
  endedAt?: string;
  exposures: Exposure[];
};

export type PostParams = {
  blurSigma: number;
  saturation: number;
  vignette: boolean;
};

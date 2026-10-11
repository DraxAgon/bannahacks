import { ArrowRight, ClipboardList, Eye, ScanEye, Sprout, Wand2 } from "lucide-react";
import { DemoStrip } from "@/components/DemoStrip";
import { Eyebrow, LinkButton } from "@/components/ui";
import { EVIDENCE, SAFETY, SOURCES, STRATEGIES } from "@/lib/content/evidence";

const STEPS = [
  { icon: ClipboardList, title: "Describe", body: "The therapist writes the fear in plain words, the way the patient said it." },
  { icon: Wand2, title: "Plan", body: "A planner turns it into 8 to 10 rungs with even SUDS steps and named visual dials." },
  { icon: Eye, title: "Render", body: "One identity anchor; every rung is the same subject, edited and post-processed to exact intensity." },
  { icon: ScanEye, title: "Check", body: "A vision critic scores identity, intensity and safety, and repairs any rung that fails." },
  { icon: Sprout, title: "Adapt", body: "Stuck? A half-step rung is drawn live. Mastered? New variations for generalization." },
];

const HERO_RUNGS = [
  { n: 9, label: "On an open hand, close", suds: 90 },
  { n: 7, label: "Walking toward camera", suds: 70 },
  { n: 5, label: "Photo, across a table", suds: 50 },
  { n: 3, label: "Friendly illustration", suds: 30 },
  { n: 1, label: "The word on a card", suds: 10 },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero: asymmetric, editorial */}
      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-12 pt-14 sm:px-8 md:grid-cols-[1.35fr_1fr] md:pt-24">
        <div>
          <Eyebrow>For therapists treating specific phobia</Eyebrow>
          <h1 className="font-display mt-5 text-[44px] font-normal leading-[1.02] tracking-[-0.02em] text-ink sm:text-[64px] lg:text-[76px]">
            Exposure therapy, one rung at a time.
          </h1>
          <p className="prose-measure mt-6 text-[18px] leading-relaxed text-muted sm:text-[19px]">
            Fear Ladder turns your patient&rsquo;s exposure hierarchy into a personalized ladder of AI-generated images,
            showing the same feared subject on every rung at gently rising intensity, and adapts the ladder as they climb.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <LinkButton href="/new" className="h-12 px-6 text-[16px]">
              Build a ladder <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkButton>
            <LinkButton href="/ladder/demo-spiders" variant="secondary" className="h-12 px-6 text-[16px]">
              Try the demo ladder
            </LinkButton>
          </div>
          <p className="mt-6 text-[14px] text-muted">
            Designed for use with a licensed therapist. Not a medical device. Not for emergencies.
          </p>
        </div>

        <div className="relative hidden md:block" aria-hidden>
          <div className="absolute inset-y-2 left-6 w-px bg-line" />
          <div className="absolute inset-y-2 right-6 w-px bg-line" />
          <ol className="relative space-y-3 py-2">
            {HERO_RUNGS.map((r) => (
              <li key={r.n} className="mx-6 flex items-center gap-4 border-t border-line bg-surface/70 px-5 py-3.5">
                <span className="font-display w-8 text-[34px] leading-none text-primary">{r.n}</span>
                <span className="flex-1 text-[15px] text-ink">{r.label}</span>
                <span className="font-mono text-[12px] text-muted">SUDS {r.suds}</span>
                <span
                  className="h-2 w-10 rounded-full"
                  style={{ background: r.suds > 60 ? "#D9963A" : r.suds > 30 ? "#8DB9A7" : "#C9D6D1" }}
                />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Signature visual */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex items-end justify-between gap-4 border-t border-line pt-6">
          <div>
            <Eyebrow>Demo ladder · spiders</Eyebrow>
            <p className="mt-2 text-[15px] text-muted">
              Same spider, nine rungs. Every image stays blurred until you choose to look.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <DemoStrip />
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto mt-24 max-w-6xl px-5 sm:px-8" aria-labelledby="why">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <div>
            <Eyebrow>Why</Eyebrow>
            <h2 id="why" className="font-display mt-3 text-[34px] leading-tight sm:text-[40px]">
              Common, treatable, and under-treated.
            </h2>
            <p className="mt-4 text-muted">
              Exposure works, but building and running a good hierarchy takes time most clinicians don&rsquo;t have.
            </p>
          </div>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {EVIDENCE.map((e) => (
              <div key={e.stat + e.source} className="border-t border-line pt-4">
                <dt className="font-display text-[36px] leading-none text-primary">{e.stat}</dt>
                <dd className="mt-3 text-[16px] leading-relaxed text-ink">
                  {e.text}{" "}
                  <a
                    href={e.href}
                    target="_blank"
                    rel="noreferrer"
                    className="whitespace-nowrap text-[14px] text-muted underline underline-offset-4 hover:text-ink"
                  >
                    {e.source}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-24 max-w-6xl px-5 sm:px-8" aria-labelledby="how">
        <Eyebrow>How it works</Eyebrow>
        <h2 id="how" className="font-display mt-3 text-[34px] leading-tight sm:text-[40px]">
          A ladder in about a minute.
        </h2>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-[12px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="bg-surface p-6">
              <div className="flex items-center justify-between">
                <s.icon className="h-5 w-5 text-primary" aria-hidden />
                <span className="font-mono text-[12px] text-muted">0{i + 1}</span>
              </div>
              <h3 className="font-display mt-6 text-[22px]">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Science */}
      <section id="science" className="mx-auto mt-24 max-w-6xl scroll-mt-8 px-5 sm:px-8" aria-labelledby="sci">
        <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <div>
            <Eyebrow>Built on the science</Eyebrow>
            <h2 id="sci" className="font-display mt-3 text-[34px] leading-tight sm:text-[40px]">
              Every feature maps to a named strategy.
            </h2>
            <p className="mt-4 text-muted">
              From the inhibitory-learning approach to exposure (
              <a className="underline underline-offset-4 hover:text-ink" href={SOURCES.craske2014} target="_blank" rel="noreferrer">
                Craske et al., 2014
              </a>
              ; updated as the{" "}
              <a className="underline underline-offset-4 hover:text-ink" href={SOURCES.optexNexus} target="_blank" rel="noreferrer">
                OptEx Nexus
              </a>
              ). Hierarchy rules follow the{" "}
              <a
                className="underline underline-offset-4 hover:text-ink"
                href={SOURCES.therapistAidHierarchy}
                target="_blank"
                rel="noreferrer"
              >
                Therapist Aid guide
              </a>
              .
            </p>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-line bg-surface">
            <table className="w-full text-left text-[15px]">
              <thead>
                <tr className="border-b border-line font-mono text-[12px] uppercase tracking-wider text-muted">
                  <th scope="col" className="px-5 py-3 font-normal">
                    Strategy
                  </th>
                  <th scope="col" className="px-5 py-3 font-normal">
                    In Fear Ladder
                  </th>
                </tr>
              </thead>
              <tbody>
                {STRATEGIES.map((s) => (
                  <tr key={s.strategy} className="border-b border-line last:border-0 align-top">
                    <th scope="row" className="w-[34%] px-5 py-3.5 font-medium text-ink">
                      {s.strategy}
                    </th>
                    <td className="px-5 py-3.5 leading-relaxed text-muted">{s.feature}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Safety */}
      <section className="mx-auto mt-24 max-w-6xl px-5 sm:px-8" aria-labelledby="safety">
        <Eyebrow>Safety by design</Eyebrow>
        <h2 id="safety" className="font-display mt-3 text-[34px] leading-tight sm:text-[40px]">
          Calm by default. Clinician in the loop.
        </h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {SAFETY.map((s) => (
            <li key={s.title} className="border-t border-line pt-4">
              <h3 className="font-medium text-ink">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

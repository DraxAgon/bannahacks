import Link from "next/link";
import { DemoStrip } from "@/components/DemoStrip";
import { LinkButton, buttonClass } from "@/components/ui";

const MORE = [
  { label: "Dogs", href: "/ladder/demo-dogs" },
  { label: "Needles", href: "/ladder/demo-needles" },
];

export default function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 sm:px-8">
      <section className="flex flex-col items-center pt-12 text-center md:pt-[88px]">
        <h1 className="max-w-[16ch] text-balance text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:max-w-none sm:text-[48px]">
          Face your fear, one step at a time.
        </h1>
        <p className="mt-4 max-w-[60ch] text-pretty text-[17px] leading-relaxed text-muted">
          Pick a fear. AI draws it nine ways, from a word on a card to the real thing.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/ladder/demo-spiders" className="px-6!">
            Try the demo
          </LinkButton>
          <LinkButton href="/new" variant="secondary" className="px-6!">
            Build your own
          </LinkButton>
        </div>
      </section>

      <section aria-label="The demo ladder" className="mt-14 md:mt-20">
        <DemoStrip />
      </section>

      <nav aria-label="Other demo ladders" className="mt-10 flex items-center justify-center gap-2 text-[14px] text-muted">
        <span className="mr-1">Or try:</span>
        {MORE.map((d) => (
          <Link key={d.href} href={d.href} className={buttonClass("secondary", "h-9! px-4! text-[14px]!")}>
            {d.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

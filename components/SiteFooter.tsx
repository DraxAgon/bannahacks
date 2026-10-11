import Link from "next/link";
import { DeleteDataButton } from "./DeleteDataButton";

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 text-[14px] leading-relaxed text-muted sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="font-medium text-ink">
            Designed for use with a licensed therapist. Not a medical device. Not for emergencies.
          </p>
          <p>
            If you are in crisis, call or text <strong className="text-ink">988</strong> (US and Canada) or your local
            emergency number.
          </p>
          <p>
            Every generated image carries Google&rsquo;s invisible SynthID watermark and is labelled
            &ldquo;AI-generated&rdquo; in the app.
          </p>
        </div>
        <div className="space-y-3">
          <p className="font-medium text-ink">Privacy</p>
          <p>No accounts. Ladders, images and sessions stay in this browser. The server stores nothing.</p>
          <DeleteDataButton />
        </div>
        <div className="space-y-3">
          <p className="font-medium text-ink">Credits</p>
          <p>
            Images by Nano Banana 2.1; planning and critique by Gemini 3.8 Flash. Built with Next.js, sharp, Recharts,
            Motion and Lucide. Built with Claude Code for{" "}
            <a className="underline underline-offset-4 hover:text-ink" href="https://bananahacks.tech">
              Banana Hacks 2026
            </a>
            .
          </p>
          <Link href="/#science" className="underline underline-offset-4 hover:text-ink">
            The science behind it
          </Link>
        </div>
      </div>
    </footer>
  );
}

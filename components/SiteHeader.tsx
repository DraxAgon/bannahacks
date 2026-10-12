import Link from "next/link";
import { LadderMark } from "./LadderMark";
import { buttonClass } from "./ui";

export function SiteHeader() {
  return (
    <header className="no-print">
      <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between px-4 sm:px-8">
        <Link href="/" className="-ml-1 flex items-center gap-2 rounded-lg px-1 py-1 text-ink">
          <LadderMark className="h-5 w-5" />
          <span className="text-[17px] font-semibold tracking-[-0.01em]">Fear Ladder</span>
        </Link>
        <Link href="/new" className={buttonClass("ghost", "-mr-3 px-3!")}>
          Build your own
        </Link>
      </div>
    </header>
  );
}

import Link from "next/link";
import { LadderMark } from "./LadderMark";

export function SiteHeader() {
  return (
    <header className="no-print border-b border-line/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-ink" aria-label="Fear Ladder home">
          <LadderMark className="h-6 w-6 text-primary" />
          <span className="font-display text-[20px] font-medium tracking-tight">Fear Ladder</span>
        </Link>
        <nav className="flex items-center gap-1 text-[15px]">
          <Link href="/ladders" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink sm:inline-block">
            My ladders
          </Link>
          <Link href="/new" className="rounded-full px-3 py-2 text-muted hover:text-ink">
            Build a ladder
          </Link>
        </nav>
      </div>
    </header>
  );
}

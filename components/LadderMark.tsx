export function LadderMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M7 2.5v19M17 2.5v19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 18h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
      <path d="M7 13.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.65" />
      <path d="M7 9h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
      <path d="M7 4.5h10" stroke="#D9963A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

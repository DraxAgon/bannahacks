/** Two rails, four rungs. Draws in the current text color. */
export function LadderMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M5.5 2v16M14.5 2v16M5.5 5h9M5.5 8.67h9M5.5 12.33h9M5.5 16h9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

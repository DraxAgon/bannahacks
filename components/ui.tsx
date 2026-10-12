import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition-[background-color,color,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-85",
  secondary: "bg-subtle text-ink hover:bg-line",
  ghost: "text-muted hover:text-ink",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

/** Small, honest label on every generated image. */
export function AiLabel({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      title="AI-generated image"
      className={`pointer-events-none whitespace-nowrap rounded-full bg-black/40 px-1.5 py-px text-[10px] font-medium text-white/90 backdrop-blur-sm ${className}`}
    >
      {compact ? "AI" : "AI image"}
      {compact && <span className="sr-only">-generated</span>}
    </span>
  );
}

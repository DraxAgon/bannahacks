import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "quiet";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-surface hover:bg-[color-mix(in_srgb,var(--primary)_88%,black)]",
  secondary: "border border-line bg-surface text-ink hover:border-primary hover:text-primary",
  ghost: "text-ink hover:bg-primary-soft",
  quiet: "text-muted hover:text-ink underline-offset-4 hover:underline px-2",
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

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[12px] uppercase tracking-[0.14em] text-muted ${className}`}>{children}</p>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[12px] border border-line bg-surface shadow-[var(--shadow)] ${className}`}>
      {children}
    </div>
  );
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 font-mono text-[12px] text-muted ${className}`}
    >
      {children}
    </span>
  );
}

export function AiLabel({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      title="AI-generated image"
      className={`pointer-events-none whitespace-nowrap rounded-full bg-[rgb(18_22_20/0.62)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#EDE7DA] ${className}`}
    >
      {compact ? "AI" : "AI-generated"}
      {compact && <span className="sr-only">-generated</span>}
    </span>
  );
}

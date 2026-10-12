"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { thumbOf } from "@/lib/images";
import type { Rung } from "@/lib/types";
import { LazyImg } from "./LazyImg";
import { AiLabel } from "./ui";

/** A rung image that stays blurred until someone chooses to look. Develops like a photograph when it first arrives. */
export function RungImage({
  rung,
  revealedDefault = false,
  size = "md",
  className = "",
}: {
  rung: Pick<Rung, "image" | "status" | "title" | "error">;
  revealedDefault?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [revealed, setRevealed] = useState(revealedDefault);
  const radius = size === "lg" ? "rounded-[12px]" : "rounded-[10px]";

  if (!rung.image) {
    const generating = rung.status === "generating" || rung.status === "pending";
    return (
      <div
        className={`relative aspect-square w-full overflow-hidden ${radius} ${generating ? "loading-sheen" : "bg-primary-soft"} ${className}`}
        role="img"
        aria-label={generating ? "Image is being generated" : "No image"}
      >
        <div className="absolute inset-0 grid place-items-center p-2 text-center">
          {generating ? (
            <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
              {rung.status === "pending" ? "Queued" : "Drawing"}
            </span>
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">No image</span>
          )}
        </div>
      </div>
    );
  }

  // Demo images have a small thumbnail: cards load only that, larger views show it while the original loads.
  const thumb = thumbOf(rung.image);
  const hasThumb = thumb !== rung.image;
  const placeholder = size !== "sm" && hasThumb ? thumb : undefined;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setRevealed((v) => !v);
      }}
      aria-pressed={revealed}
      aria-label={revealed ? `Hide image: ${rung.title}` : `Reveal image: ${rung.title}`}
      className={`group relative block aspect-square w-full overflow-hidden ${radius} bg-primary-soft ${className}`}
    >
      <LazyImg
        key={rung.image.slice(-48)}
        src={size === "sm" ? thumb : rung.image}
        fallback={size === "sm" && hasThumb ? rung.image : undefined}
        placeholder={placeholder}
        alt={revealed ? rung.title : ""}
        className="h-full w-full object-cover"
        loadedClass={placeholder ? "" : "develop"}
      />
      <span
        className="absolute inset-0 transition-[backdrop-filter,background-color] duration-300 ease-out"
        style={{
          backdropFilter: revealed ? "none" : "blur(16px) saturate(0.6)",
          WebkitBackdropFilter: revealed ? "none" : "blur(16px) saturate(0.6)",
          backgroundColor: revealed ? "transparent" : "rgb(246 241 231 / 0.18)",
        }}
      />
      {!revealed && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="flex items-center gap-1.5 rounded-full bg-surface/85 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-ink">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {size !== "sm" && "Tap to reveal"}
          </span>
        </span>
      )}
      {revealed && size !== "sm" && (
        <span className="absolute right-2 top-2 rounded-full bg-surface/85 p-1.5 text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <EyeOff className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
      <AiLabel compact={size === "sm"} className={size === "sm" ? "absolute bottom-1 left-1" : "absolute bottom-2 left-2"} />
    </button>
  );
}

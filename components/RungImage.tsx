"use client";

import { useState } from "react";
import type { Rung } from "@/lib/types";
import { AiLabel } from "./ui";

type ImageRung = Pick<Rung, "image" | "status" | "title">;

/**
 * A rung image. Blurred until `revealed`; the blur lifts smoothly when the person chooses to look.
 * An image that arrives (or changes) after mount develops like a photograph.
 * Purely visual: callers decide what reveals it (hover, tap, opening the lightbox).
 */
export function RungImage({
  rung,
  revealed = false,
  hint,
  label = "compact",
  rounded = "rounded-2xl",
  labelClassName = "absolute bottom-2 left-2",
  className = "",
}: {
  rung: ImageRung;
  revealed?: boolean;
  /** Small pill centered on the blurred image, e.g. "Tap to look". */
  hint?: string;
  label?: "compact" | "full" | "none";
  rounded?: string;
  labelClassName?: string;
  className?: string;
}) {
  // Only images that arrive after mount get the develop animation, so opening a page doesn't replay it.
  const [firstSrc] = useState(rung.image);
  const busy = rung.status === "generating" || rung.status === "pending";

  if (!rung.image) {
    return (
      <div
        className={`relative aspect-square w-full overflow-hidden ${rounded} ${busy ? "loading-sheen" : "bg-subtle"} ${className}`}
        role="img"
        aria-label={busy ? `Drawing ${rung.title}` : `No image for ${rung.title}`}
      />
    );
  }

  return (
    <div
      className={`relative isolate aspect-square w-full overflow-hidden bg-subtle [transform:translateZ(0)] ${rounded} ${className}`}
    >
      <div
        className="absolute inset-0 transition-[filter,transform] duration-500 ease-out"
        style={{
          filter: revealed ? "none" : "blur(22px) saturate(0.85)",
          transform: revealed ? "scale(1)" : "scale(1.14)",
        }}
      >
        <img
          key={rung.image.slice(-48)}
          src={rung.image}
          alt={revealed ? rung.title : ""}
          draggable={false}
          className={`h-full w-full select-none object-cover ${rung.image !== firstSrc ? "develop" : ""}`}
        />
      </div>

      {busy && <div className="loading-sheen absolute inset-0 opacity-70" aria-hidden />}

      {hint && (
        <div
          className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-300 ease-out ${
            revealed ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden
        >
          <span className="rounded-full bg-bg/70 px-3 py-1 text-[13px] font-medium text-ink backdrop-blur-md">
            {hint}
          </span>
        </div>
      )}

      {label !== "none" && (
        <AiLabel compact={label === "compact"} className={labelClassName} />
      )}
    </div>
  );
}

/** A self-contained image that reveals on mouse hover and toggles on tap or Enter. */
export function RevealImage({
  rung,
  hint = "Tap to look",
  label = "compact",
  rounded,
  className = "",
}: {
  rung: ImageRung;
  hint?: string;
  label?: "compact" | "full" | "none";
  rounded?: string;
  className?: string;
}) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const revealed = hover || pinned;
  if (!rung.image) return <RungImage rung={rung} label={label} rounded={rounded} className={className} />;
  return (
    <button
      type="button"
      onPointerEnter={(e) => e.pointerType !== "touch" && setHover(true)}
      onPointerLeave={(e) => e.pointerType !== "touch" && setHover(false)}
      onClick={() => setPinned((v) => !v)}
      aria-pressed={pinned}
      aria-label={pinned ? `Hide ${rung.title}` : `Look at ${rung.title}`}
      className={`block w-full rounded-2xl ${className}`}
    >
      <RungImage rung={rung} revealed={revealed} hint={hint} label={label} rounded={rounded} />
    </button>
  );
}

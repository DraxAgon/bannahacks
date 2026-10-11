"use client";

import { Eye, Hand } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewMode } from "@/lib/types";

/**
 * The reveal. Hold-to-view: the image sharpens only while the patient presses (or holds Space)
 * and fades back to blur within 300 ms on release — a "dead man's brake".
 * Steady view: the patient chooses when to reveal, and it stays.
 */
export function HoldToView({
  src,
  alt,
  mode,
  active,
  onVisibleChange,
}: {
  src: string;
  alt: string;
  mode: ViewMode;
  active: boolean;
  onVisibleChange: (visible: boolean) => void;
}) {
  const [visible, setVisible] = useState(false);
  const visRef = useRef(false);
  const holding = useRef(false);

  const set = useCallback(
    (v: boolean) => {
      if (visRef.current === v) return;
      visRef.current = v;
      setVisible(v);
      onVisibleChange(v);
    },
    [onVisibleChange],
  );

  // Space to hold (hold mode). Captured so a focused button isn't activated by the same key.
  useEffect(() => {
    if (!active || mode !== "hold") return;
    const isTextField = (t: EventTarget | null) =>
      t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type === "text");
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTextField(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) {
        holding.current = true;
        set(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTextField(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      holding.current = false;
      set(false);
    };
    const blur = () => {
      holding.current = false;
      set(false);
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", blur);
    };
  }, [active, mode, set]);

  // Hide when the exposure is paused or ended.
  useEffect(() => {
    if (!active) set(false);
  }, [active, set]);

  const pointerHandlers =
    mode === "hold"
      ? {
          onPointerDown: (e: React.PointerEvent) => {
            if (!active) return;
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            set(true);
          },
          onPointerUp: () => set(false),
          onPointerCancel: () => set(false),
          onLostPointerCapture: () => set(false),
        }
      : {};

  return (
    <div className="flex flex-col items-center">
      <div
        {...pointerHandlers}
        onContextMenu={(e) => e.preventDefault()}
        className="relative aspect-square w-[min(calc(100svh-330px),88vw,620px)] min-w-[220px] cursor-pointer touch-none select-none overflow-hidden rounded-[16px] bg-[#1B211E] [-webkit-touch-callout:none]"
        role={mode === "hold" ? "button" : undefined}
        aria-label={mode === "hold" ? `${alt}. Press and hold, or hold the Space bar, to look.` : undefined}
        aria-pressed={mode === "hold" ? visible : undefined}
      >
        <img
          src={src}
          alt={visible ? alt : ""}
          draggable={false}
          className="h-full w-full object-cover"
          style={{
            filter: visible ? "none" : "blur(30px) saturate(0.5) brightness(0.7)",
            transform: visible ? "scale(1)" : "scale(1.1)",
            transition: "filter 280ms ease-out, transform 280ms ease-out",
          }}
        />
        {!visible && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="flex items-center gap-2 rounded-full bg-[#121614]/75 px-4 py-2 text-[15px] text-[#EDE7DA]">
              {mode === "hold" ? (
                <>
                  <Hand className="h-4 w-4" aria-hidden /> Press and hold to look
                  <span className="hidden font-mono text-[12px] text-[#9A9384] sm:inline">· or hold Space</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" aria-hidden /> Blurred until you choose
                </>
              )}
            </span>
          </div>
        )}
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full bg-[#121614]/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#EDE7DA]">
          AI-generated
        </span>
      </div>
      {mode === "steady" && active && (
        <button
          type="button"
          onClick={() => set(!visible)}
          className="mt-4 min-h-11 rounded-full border border-line px-5 text-[15px] text-ink hover:border-primary"
        >
          {visible ? "Blur it again" : "Show the image"}
        </button>
      )}
    </div>
  );
}

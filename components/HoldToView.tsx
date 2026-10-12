"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewMode } from "@/lib/types";
import { AiLabel, Button } from "./ui";

/**
 * The reveal. Hold to look: the image sharpens only while the person presses it (or holds Space)
 * and blurs again within 300 ms of letting go.
 * Steady: the person chooses when to reveal, and it stays until they blur it again.
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

  const set = useCallback(
    (v: boolean) => {
      if (visRef.current === v) return;
      visRef.current = v;
      setVisible(v);
      onVisibleChange(v);
    },
    [onVisibleChange],
  );

  // Hold Space to look. Captured so a focused button isn't pressed by the same key.
  useEffect(() => {
    if (!active || mode !== "hold") return;
    const isTextField = (t: EventTarget | null) =>
      t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type === "text");
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTextField(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) set(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTextField(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      set(false);
    };
    const release = () => set(false);
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", release);
    };
  }, [active, mode, set]);

  // Blur whenever the exposure is paused or ended.
  useEffect(() => {
    if (!active) set(false);
  }, [active, set]);

  const hold = mode === "hold";
  const pointerHandlers = hold
    ? {
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          if (!active) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
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
        tabIndex={hold ? 0 : undefined}
        role={hold ? "button" : undefined}
        aria-label={hold ? `${alt}. Press and hold, or hold Space, to look.` : undefined}
        aria-pressed={hold ? visible : undefined}
        className={`develop relative aspect-square w-[min(calc(100svh-370px),88vw,560px)] min-w-[220px] touch-none select-none overflow-hidden rounded-2xl bg-subtle [-webkit-touch-callout:none] ${
          hold ? "cursor-pointer" : ""
        }`}
      >
        <img
          src={src}
          alt={visible ? alt : ""}
          draggable={false}
          className="pointer-events-none h-full w-full object-cover"
          style={{
            filter: visible ? "none" : "blur(32px) saturate(0.6) brightness(0.75)",
            transform: visible ? "scale(1)" : "scale(1.12)",
            transition: "filter 260ms ease-out, transform 260ms ease-out",
          }}
        />
        <div
          className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-200 ease-out ${
            visible ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden
        >
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-black/45 px-4 text-[14px] font-medium text-white backdrop-blur-md">
            {hold ? "Hold to look" : "Blurred until you choose"}
            {hold && (
              <span className="hidden font-normal text-white/60 [@media(pointer:fine)]:inline">or hold Space</span>
            )}
          </span>
        </div>
        <AiLabel className="absolute bottom-3 left-3" />
      </div>
      {!hold && active && (
        <Button variant="secondary" className="mt-4" onClick={() => set(!visible)}>
          {visible ? "Blur it again" : "Show the image"}
        </Button>
      )}
    </div>
  );
}

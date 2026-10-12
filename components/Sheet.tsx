"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;
const DESKTOP = "(min-width: 640px)";

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary,[tabindex]:not([tabindex="-1"])';

/**
 * Centered modal on desktop, bottom sheet on phones (drag the handle down to close).
 * `lightbox`: no header, a floating close button over the content, sized so a square image fits the screen.
 * `panel`: a titled, wider sheet with a fixed height for tabbed content.
 */
export function Sheet({
  open,
  onClose,
  title,
  variant = "lightbox",
  reserve = 340,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Accessible name; shown as the heading in the `panel` variant. */
  title: string;
  variant?: "lightbox" | "panel";
  /** Lightbox only: vertical space (px) the content below the square image needs, so it all fits on screen. */
  reserve?: number;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
  const drag = useDragControls();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      // Keep focus inside the dialog.
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  const lightbox = variant === "lightbox";
  const hidden = reduce ? { opacity: 0 } : desktop ? { opacity: 0, scale: 0.97, y: 8 } : { opacity: 1, y: "100%" };
  const shown = reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 };

  const size = lightbox
    ? "max-h-[92dvh] sm:max-h-[90dvh] sm:w-[min(720px,calc(100vw_-_48px),calc(100dvh_-_var(--sheet-reserve)))] sm:min-w-[min(420px,calc(100vw_-_48px))]"
    : "h-[92dvh] sm:h-[min(88dvh,880px)] sm:w-[min(960px,calc(100vw_-_48px))]";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={hidden}
            animate={shown}
            exit={hidden}
            transition={{ duration: desktop ? 0.28 : 0.4, ease: EASE }}
            drag={desktop || reduce ? false : "y"}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            style={{ "--sheet-reserve": `${reserve}px` } as CSSProperties}
            className={`relative flex w-full flex-col overflow-hidden rounded-t-3xl bg-bg text-ink shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.25)] outline-none sm:rounded-3xl sm:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.45)] ${size}`}
          >
            <div
              className="flex shrink-0 touch-none justify-center pb-1 pt-2.5 sm:hidden"
              onPointerDown={(e) => drag.start(e)}
              aria-hidden
            >
              <span className="h-1 w-9 rounded-full bg-line" />
            </div>

            {lightbox ? (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-[22px] top-10 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors duration-150 hover:bg-black/65 sm:right-7 sm:top-7"
                style={{ borderRadius: 999 }}
                aria-label="Close"
              >
                <X className="h-[18px] w-[18px]" aria-hidden />
              </button>
            ) : (
              <div
                className="flex shrink-0 touch-none items-center justify-between gap-4 px-5 pb-2 pt-2 sm:touch-auto sm:px-8 sm:pt-6"
                onPointerDown={(e) => !desktop && drag.start(e)}
              >
                <h2 className="truncate text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-subtle hover:text-ink"
                  style={{ borderRadius: 999 }}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            )}

            <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${lightbox ? "" : "px-5 pb-8 pt-4 sm:px-8"}`}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

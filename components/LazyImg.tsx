"use client";

import { useState, type CSSProperties } from "react";

/**
 * An <img> that loads lazily and decodes off the main thread. Until its pixels arrive it shows
 * the `placeholder` (e.g. an already-cached thumbnail) or the loading sheen. Key it by `src`.
 */
export function LazyImg({
  src,
  alt,
  fallback,
  placeholder,
  eager = false,
  className = "",
  loadedClass = "",
  style,
}: {
  src: string;
  alt: string;
  /** Used if `src` fails, e.g. a thumbnail that hasn't been generated. */
  fallback?: string;
  placeholder?: string;
  eager?: boolean;
  className?: string;
  loadedClass?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const shown = failed && fallback ? fallback : src;

  return (
    <>
      {!loaded &&
        (placeholder && placeholder !== src ? (
          <img src={placeholder} alt="" aria-hidden draggable={false} className={`absolute inset-0 ${className}`} style={style} />
        ) : (
          <span className="loading-sheen absolute inset-0" aria-hidden />
        ))}
      <img
        src={shown}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => (fallback && !failed ? setFailed(true) : setLoaded(true))}
        className={`${className} ${loaded ? loadedClass : "opacity-0"}`}
        style={style}
      />
    </>
  );
}

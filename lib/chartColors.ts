// Two-series chart palette. Monochrome on purpose: the generated images are the only color in the app.
// The pair is told apart by lightness, not hue, so it reads the same with any kind of color blindness
// (OKLab ΔE about 57 between them, normal and simulated CVD; 7.7:1 against each other).
// Contrast against the white chart surface (#ffffff): SERIES_A 19.8:1, SERIES_B 2.56:1.
// SERIES_B is under the 3:1 guideline for graphics, so any chart using it must also carry
// a legend, a tooltip and a screen-reader table rather than relying on the gray alone.
export const SERIES_A = "#0a0a0a"; // near-black
export const SERIES_B = "#a1a1aa"; // mid gray

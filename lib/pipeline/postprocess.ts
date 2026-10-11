import "server-only";
import sharp from "sharp";
import type { PostParams } from "../types";

const SIZE = 1024;

const vignetteSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <defs><radialGradient id="v" cx="50%" cy="50%" r="72%">
      <stop offset="55%" stop-color="#F6F1E7" stop-opacity="0"/>
      <stop offset="100%" stop-color="#F6F1E7" stop-opacity="0.75"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#v)"/>
  </svg>`,
);

/**
 * Stage 4: what code controls better than prompts.
 * Gaussian blur sigma = (1 - clarity) * 14, saturation = color, soft vignette when far away.
 */
export async function postprocess(input: Buffer, p: PostParams): Promise<Buffer> {
  let img = sharp(input).rotate().resize(SIZE, SIZE, { fit: "cover" });
  if (p.saturation < 0.999) img = img.modulate({ saturation: Math.max(0, p.saturation) });
  if (p.blurSigma >= 0.3) img = img.blur(p.blurSigma);
  if (p.vignette) {
    const base = await img.toBuffer();
    img = sharp(base).composite([{ input: vignetteSvg, blend: "over" }]);
  }
  return img.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}

/** Normalize any uploaded or generated image to a 1024px JPEG. */
export async function normalizeJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input).rotate().resize(SIZE, SIZE, { fit: "cover" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}

export const toDataUrl = (buf: Buffer) => `data:image/jpeg;base64,${buf.toString("base64")}`;

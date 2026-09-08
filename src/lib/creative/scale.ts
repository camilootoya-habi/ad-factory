import type { AdScaleStep, Format } from "./types";

/** Dimensiones reales de cada formato, en píxeles del PNG final. */
export const FORMATS: Record<Format, { w: number; h: number; label: string; ratio: string }> = {
  "1x1": { w: 1080, h: 1080, label: "Cuadrado", ratio: "1:1" },
  "4x5": { w: 1080, h: 1350, label: "Feed vertical", ratio: "4:5" },
  "9x16": { w: 1080, h: 1920, label: "Stories / Reels", ratio: "9:16" },
  "16x9": { w: 1920, h: 1080, label: "Horizontal", ratio: "16:9" },
};

export const FORMAT_KEYS = Object.keys(FORMATS) as Format[];

/**
 * 1 cu (unidad de canvas) = 1 px cuando el lado menor mide 1080. Los tamaños de texto y
 * logo del spec están en cu, así una pieza 16:9 de 1920×1080 no infla la tipografía.
 */
export function unitFor(format: Format): number {
  const { w, h } = FORMATS[format];
  return Math.min(w, h) / 1080;
}

export function cu(value: number, format: Format): number {
  return Math.round(value * unitFor(format) * 100) / 100;
}

/** Aspect ratio que entiende Replicate para cada formato. */
export const REPLICATE_ASPECT: Record<Format, "1:1" | "4:5" | "9:16" | "16:9"> = {
  "1x1": "1:1",
  "4x5": "4:5",
  "9x16": "9:16",
  "16x9": "16:9",
};

/**
 * Escala tipográfica de anuncio. Continúa la rampa del brand center (que topa en
 * heading2Xl = 72px / 700 / -0.03em, pensada para UI web) con la misma familia, los
 * mismos pesos y la misma proporción de tracking negativo. Valores en cu.
 */
export const AD_SCALE: Record<
  AdScaleStep,
  { size: number; lineHeight: number; weight: 400 | 600 | 700; letterSpacing: string; family: "headings" | "body" }
> = {
  "display-2xl": { size: 150, lineHeight: 0.98, weight: 700, letterSpacing: "-0.035em", family: "headings" },
  "display-xl": { size: 128, lineHeight: 1.0, weight: 700, letterSpacing: "-0.035em", family: "headings" },
  "display-lg": { size: 108, lineHeight: 1.02, weight: 700, letterSpacing: "-0.03em", family: "headings" },
  "display-md": { size: 92, lineHeight: 1.05, weight: 700, letterSpacing: "-0.03em", family: "headings" },
  "display-sm": { size: 76, lineHeight: 1.08, weight: 700, letterSpacing: "-0.025em", family: "headings" },
  heading: { size: 60, lineHeight: 1.12, weight: 600, letterSpacing: "-0.02em", family: "headings" },
  "body-lg": { size: 46, lineHeight: 1.25, weight: 400, letterSpacing: "-0.01em", family: "headings" },
  body: { size: 38, lineHeight: 1.3, weight: 400, letterSpacing: "-0.005em", family: "headings" },
  "body-sm": { size: 30, lineHeight: 1.35, weight: 400, letterSpacing: "0", family: "headings" },
  caption: { size: 22, lineHeight: 1.4, weight: 400, letterSpacing: "0", family: "body" },
};

export const AD_SCALE_KEYS = Object.keys(AD_SCALE) as AdScaleStep[];

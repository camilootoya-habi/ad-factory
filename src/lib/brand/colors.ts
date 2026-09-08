import type { Color, ColorToken } from "@/lib/creative/types";

/**
 * Espejo en TS de los tokens de color de src/styles/design-tokens.css, para los sitios
 * donde hace falta un hex real (SVG inline, cálculo de contraste, prompts). Si cambia el
 * CSS, cambia esto. Mono-morado: el coral #F45201 sólo existe dentro del SVG del logo.
 */
export const COLOR_HEX: Record<ColorToken, string> = {
  white: "#FFFFFF",
  black: "#000000",
  "purple-50": "#FAF5FF",
  "purple-100": "#F3E8FF",
  "purple-200": "#E9D5FF",
  "purple-300": "#D8B4FE",
  "purple-400": "#C084FC",
  "purple-500": "#A855F7",
  "purple-600": "#9333EA",
  "purple-700": "#7E22CE",
  "purple-800": "#6B21A8",
  "purple-900": "#581C87",
  "purple-950": "#3B0764",
  "neutral-50": "#FAFAFA",
  "neutral-100": "#F5F5FA",
  "neutral-200": "#E5E5E5",
  "neutral-300": "#D4D4D4",
  "neutral-600": "#596170",
  "neutral-900": "#11131A",
};

export const BRAND = {
  primary: COLOR_HEX["purple-700"],
  accent: COLOR_HEX["purple-600"],
  depth: COLOR_HEX["purple-800"],
  deepest: COLOR_HEX["purple-900"],
} as const;

export function isToken(c: Color): c is ColorToken {
  return c in COLOR_HEX;
}

export function toHex(c: Color | undefined, fallback: ColorToken = "neutral-900"): string {
  if (!c) return COLOR_HEX[fallback];
  return isToken(c) ? COLOR_HEX[c] : c;
}

/** Luminancia relativa WCAG de un hex. */
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** true si el color es oscuro (texto blanco encima). */
export function isDark(c: Color): boolean {
  return luminance(toHex(c)) < 0.35;
}

/** Hex → rgba() con alpha. */
export function rgba(c: Color, alpha: number): string {
  const h = toHex(c).replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

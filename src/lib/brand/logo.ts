import type { Color, LogoFormat, LogoTreatment } from "@/lib/creative/types";
import { isDark } from "./colors";

/**
 * Uso correcto del logo de Habi, codificado. Reglas del Habi Brand Center
 * (~/habi-brand-guide, capítulo 02):
 *
 * - Mínimo digital: 24 px de alto. Recomendado ≥ 80 px en piezas de 1080.
 * - Clear space: 1× la altura de la "h" del wordmark en los 4 lados. Nada entra ahí.
 * - Tratamiento según fondo: color sobre claro; blanco sobre oscuro/morado pleno;
 *   color-sobre-blanco (placa) sobre foto o superficie no blanca.
 * - Jamás sombra, blur, glow, stretch ni rotación. `width: auto` siempre.
 *
 * Constantes nativas medidas en habi-color.svg: canvas 500×500, altura de la "h" = 103
 * unidades, bbox del dibujo x:[41.3, 458.7] y:[51, 449.2].
 */

export const LOGO_MIN_PX = 24;
export const LOGO_RECOMMENDED_PX = 80;

const NATIVE = {
  completo: { canvas: 500, hHeight: 103, drawnW: 417.4, drawnH: 398.2 },
  simbolo: { canvas: 500, hHeight: 103, drawnW: 417.4, drawnH: 398.2 },
  // El horizontal es 830×230; la "h" mide ~92 unidades en ese canvas.
  horizontal: { canvas: 230, hHeight: 92, drawnW: 830, drawnH: 230 },
} as const;

/** Rutas de los SVG copiados del brand center a public/brand/. */
export const LOGO_FILES: Record<LogoFormat, Record<LogoTreatment, string>> = {
  completo: {
    color: "/brand/habi-color.svg",
    blanco: "/brand/habi-white.svg",
    colorSobreBlanco: "/brand/habi-white-color.svg",
  },
  simbolo: {
    color: "/brand/simbolo-color.svg",
    blanco: "/brand/simbolo-white.svg",
    colorSobreBlanco: "/brand/simbolo-white-color.svg",
  },
  horizontal: {
    color: "/brand/habi-horizontal-color.svg",
    blanco: "/brand/habi-horizontal-white.svg",
    colorSobreBlanco: "/brand/habi-horizontal-white-color.svg",
  },
};

/** Qué hay realmente debajo del logo. */
export type BackgroundKind =
  /** Superficie blanca o casi blanca: color pleno. */
  | "light"
  /** Morado pleno, gradiente de marca o cualquier superficie oscura: logo blanco. */
  | "dark"
  /** Fotografía o textura: lockup de color sobre placa blanca. */
  | "photo";

export function pickTreatment(bg: BackgroundKind): LogoTreatment {
  switch (bg) {
    case "light":
      return "color";
    case "dark":
      return "blanco";
    case "photo":
      return "colorSobreBlanco";
  }
}

/** Clasifica un color plano como fondo claro u oscuro para el logo. */
export function backgroundKindForColor(c: Color): BackgroundKind {
  return isDark(c) ? "dark" : "light";
}

export function logoSrc(format: LogoFormat, treatment: LogoTreatment): string {
  return LOGO_FILES[format][treatment];
}

/**
 * Ancho que ocupa el <img> para una altura dada (el SVG completo es cuadrado 500×500;
 * el horizontal es 830×230).
 */
export function logoWidthFor(format: LogoFormat, heightPx: number): number {
  const n = NATIVE[format];
  return format === "horizontal" ? heightPx * (n.drawnW / n.drawnH) : heightPx;
}

/**
 * Clear space en px para una altura de <img> dada. Se mide sobre la "h" del wordmark
 * en el canvas nativo del SVG, no sobre el dibujo recortado.
 */
export function clearSpaceFor(format: LogoFormat, heightPx: number): number {
  const n = NATIVE[format];
  return heightPx * (n.hHeight / n.canvas);
}

export type LogoCheck = { ok: boolean; level: "ok" | "warn" | "error"; message: string };

/** Valida la altura contra los mínimos del brand center. */
export function checkLogoHeight(heightPx: number): LogoCheck {
  if (heightPx < LOGO_MIN_PX) {
    return {
      ok: false,
      level: "error",
      message: `Logo de ${Math.round(heightPx)}px: el mínimo digital es ${LOGO_MIN_PX}px. La casa pierde definición y el punto desaparece.`,
    };
  }
  if (heightPx < LOGO_RECOMMENDED_PX) {
    return {
      ok: true,
      level: "warn",
      message: `Logo de ${Math.round(heightPx)}px: en un canvas de 1080 se recomienda ≥ ${LOGO_RECOMMENDED_PX}px.`,
    };
  }
  return { ok: true, level: "ok", message: "Tamaño de logo dentro de norma." };
}

/**
 * Caja total que reserva el logo (dibujo + clear space en los 4 lados), en px.
 * El layout la usa para que título y CTA no invadan el perímetro.
 */
export function logoReservedBox(format: LogoFormat, heightPx: number) {
  const cs = clearSpaceFor(format, heightPx);
  const w = logoWidthFor(format, heightPx);
  return { width: w + cs * 2, height: heightPx + cs * 2, clearSpace: cs, logoWidth: w };
}

/**
 * Estilos que un <img> de logo NO puede llevar nunca. LayerLogo los pasa por aquí
 * antes de renderizar; si algo se cuela, se descarta con un warning en dev.
 */
const FORBIDDEN_STYLE_KEYS = ["filter", "boxShadow", "textShadow", "transform", "opacity", "mixBlendMode", "clipPath"] as const;

export function sanitizeLogoStyle<T extends Record<string, unknown>>(style: T): T {
  const out = { ...style };
  for (const k of FORBIDDEN_STYLE_KEYS) {
    if (k in out) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[logo] "${k}" no está permitido sobre el logo de Habi; se ignora.`);
      }
      delete out[k];
    }
  }
  return out;
}

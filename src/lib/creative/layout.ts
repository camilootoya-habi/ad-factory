import { isDark, rgba, toHex } from "@/lib/brand/colors";
import type { BackgroundKind } from "@/lib/brand/logo";
import { AD_SCALE, FORMATS, unitFor } from "./scale";
import type {
  AdScaleStep,
  Box,
  CreativeSpec,
  Cta,
  CtaVariant,
  Fondo,
  Format,
  LogoSlot,
  Overlay,
  Protagonista,
  Weight,
} from "./types";

/**
 * Helpers puros de layout (sin React). Todo sale en px del canvas real del formato:
 * mismo spec ⇒ mismos px.
 */

const r2 = (n: number) => Math.round(n * 100) / 100 || 0; // `|| 0` normaliza el -0

export type PxBox = { left: number; top: number; width: number; height?: number };

/** Caja en % del canvas → px del formato. `height` sólo si el spec la fija. */
export function boxToPx(box: Box, format: Format): PxBox {
  const { w, h } = FORMATS[format];
  return {
    left: r2((box.x / 100) * w),
    top: r2((box.y / 100) * h),
    width: r2((box.w / 100) * w),
    height: box.h === undefined ? undefined : r2((box.h / 100) * h),
  };
}

export type FontStyle = {
  fontFamily: string;
  /** px */
  fontSize: number;
  /** múltiplo */
  lineHeight: number;
  fontWeight: Weight;
  letterSpacing: string;
  /** Sin itálicas nunca: se fija explícitamente. */
  fontStyle: "normal";
};

export type FontOverrides = { lineHeight?: number; letterSpacing?: string; weight?: Weight };

/** Paso de la escala de anuncio → CSS en px (AD_SCALE.size × unidad del formato). */
export function fontStyle(step: AdScaleStep, format: Format, overrides: FontOverrides = {}): FontStyle {
  const s = AD_SCALE[step];
  return {
    fontFamily: s.family === "headings" ? "var(--font-headings)" : "var(--font-body)",
    fontSize: r2(s.size * unitFor(format)),
    lineHeight: overrides.lineHeight ?? s.lineHeight,
    fontWeight: overrides.weight ?? s.weight,
    letterSpacing: overrides.letterSpacing ?? s.letterSpacing,
    fontStyle: "normal",
  };
}

export type AnchorStyle = {
  width: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  transform?: string;
};

/**
 * Posición del protagonista: ancho en % del canvas, anclado a una esquina/borde y
 * desplazado por `offset` (% del canvas, positivo = derecha/abajo).
 */
export function anchorStyle(p: Pick<Protagonista, "anchor" | "widthPct" | "offset" | "flip">, format: Format): AnchorStyle {
  const { w, h } = FORMATS[format];
  const width = r2((p.widthPct / 100) * w);
  const ox = r2((p.offset[0] / 100) * w);
  const oy = r2((p.offset[1] / 100) * h);
  const transforms: string[] = [];
  const out: AnchorStyle = { width };

  switch (p.anchor) {
    case "bottom-left":
      out.left = ox;
      out.bottom = -oy;
      break;
    case "bottom-right":
      out.right = -ox;
      out.bottom = -oy;
      break;
    case "bottom-center":
      out.left = r2(w / 2 + ox);
      out.bottom = -oy;
      transforms.push("translateX(-50%)");
      break;
    case "top-center":
      out.left = r2(w / 2 + ox);
      out.top = oy;
      transforms.push("translateX(-50%)");
      break;
    case "center":
      out.left = r2(w / 2 + ox);
      out.top = r2(h / 2 + oy);
      transforms.push("translate(-50%, -50%)");
      break;
  }
  if (p.flip) transforms.push("scaleX(-1)");
  if (transforms.length) out.transform = transforms.join(" ");
  return out;
}

/**
 * Overlay de marca. El gradiente CSS avanza hacia el ángulo, así que con 135° el `to`
 * (más opaco) cae abajo-derecha, como pide el brand center.
 */
export function overlayCss(overlay: Overlay): string {
  return `linear-gradient(${overlay.angle}deg, ${rgba(overlay.color, overlay.from)} 0%, ${rgba(overlay.color, overlay.to)} 100%)`;
}

export function gradientCss(fondo: Extract<Fondo, { kind: "gradiente" }>): string {
  const stops = fondo.via
    ? `${toHex(fondo.from)} 0%, ${toHex(fondo.via)} 50%, ${toHex(fondo.to)} 100%`
    : `${toHex(fondo.from)} 0%, ${toHex(fondo.to)} 100%`;
  return `linear-gradient(${fondo.angle}deg, ${stops})`;
}

/** Qué hay bajo un slot del logo cuando el logo va sobre el fondo (no dentro del CTA). */
function backgroundKindOfFondo(spec: Pick<CreativeSpec, "fondo" | "overlay">): BackgroundKind {
  const { fondo, overlay } = spec;
  switch (fondo.kind) {
    case "plano":
      return isDark(fondo.color) ? "dark" : "light";
    case "gradiente":
      return "dark";
    case "asset":
      return overlay && overlay.to >= 0.6 ? "dark" : "photo";
  }
}

/**
 * Qué hay realmente bajo el logo. En `in-cta` decide el contenedor del CTA: la variante
 * "sobre-lila" es lila por definición y la placa blanca del lockup se lee mejor ahí (refs 4
 * y 6), salvo que alguien fuerce un contenedor claro.
 */
export function backgroundKindUnder(spec: Pick<CreativeSpec, "fondo" | "overlay" | "cta">, slot: LogoSlot): BackgroundKind {
  if (slot !== "in-cta" || !spec.cta) return backgroundKindOfFondo(spec);
  const { variant, containerColor } = spec.cta;
  switch (variant) {
    case "badge-gradiente":
      return "dark";
    case "pastilla-oscura-sobre-lila":
      return containerColor && !isDark(containerColor) ? "light" : "photo";
    case "pastilla-morada-sobre-blanco":
    case "pastilla-blanca":
      return containerColor ? (isDark(containerColor) ? "dark" : "light") : "light";
  }
}

/** Color de tinta legible sobre un tipo de fondo (texto legal, avisos). */
export function inkOver(kind: BackgroundKind): string {
  return kind === "light" ? toHex("neutral-900") : toHex("white");
}

/** Paso tipográfico por defecto de cada variante de CTA. */
export function ctaDefaultSize(variant: CtaVariant): AdScaleStep {
  return variant === "badge-gradiente" ? "display-lg" : "body-lg";
}

/**
 * Caja del CTA en px con altura garantizada: si el spec no fija `h`, se deriva del
 * tamaño de texto. LayerCta y LayerLogo (slot in-cta) usan la misma para coincidir.
 */
export function ctaBoxPx(cta: Cta, format: Format): PxBox & { height: number } {
  const box = boxToPx(cta.box, format);
  const font = fontStyle(cta.size ?? ctaDefaultSize(cta.variant), format);
  return { ...box, height: box.height ?? r2(font.fontSize * 3.6) };
}

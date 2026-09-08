import { COLOR_HEX } from "@/lib/brand/colors";
import { BRAND_OVERLAY } from "@/lib/creative/presets";
import { shortId, uuid } from "@/lib/creative/ids";
import { AD_SCALE_KEYS } from "@/lib/creative/scale";
import type {
  AdScaleStep,
  Color,
  ColorToken,
  CreativeSpec,
  CtaVariant,
  Format,
  LogoFormat,
  LogoSlot,
  LogoTreatment,
  Producto,
  ProtagonistaAttrs,
  Run,
  UtmSource,
  Weight,
} from "@/lib/creative/types";

/* ------------------------------------------------------------------ */
/* Runs con marcador de negrita                                        */
/* ------------------------------------------------------------------ */

/**
 * El editor de texto usa `**doble asterisco**` para marcar negrita, y conserva los saltos
 * de línea. Así un titular de dos tonos ("**más rápido** y sin estrés") se escribe en un
 * textarea sin construir Run[] a mano.
 */
export function parseRuns(text: string, opts: { bold?: Weight; regular?: Weight; boldColor?: Color; color?: Color } = {}): Run[] {
  const bold = opts.bold ?? 700;
  const regular = opts.regular ?? 400;
  const out: Run[] = [];
  for (const part of text.split(/(\*\*[^*]*\*\*)/g)) {
    if (!part) continue;
    const isBold = part.startsWith("**") && part.endsWith("**") && part.length >= 4;
    const body = isBold ? part.slice(2, -2) : part;
    if (!body) continue;
    const run: Run = { text: body, weight: isBold ? bold : regular };
    const color = isBold ? (opts.boldColor ?? opts.color) : opts.color;
    if (color) run.color = color;
    out.push(run);
  }
  return out;
}

/** Inverso de parseRuns: Run[] → texto con `**negrita**`. */
export function formatRuns(runs: Run[] | undefined): string {
  if (!runs?.length) return "";
  return runs.map((r) => ((r.weight ?? 400) >= 600 ? `**${r.text}**` : r.text)).join("");
}

/** Color dominante de un conjunto de runs (el del primer run que lo declare). */
export function runsColor(runs: Run[] | undefined, fallback: Color): Color {
  return runs?.find((r) => r.color)?.color ?? fallback;
}

/** Reaplica un color a todos los runs conservando pesos. */
export function recolorRuns(runs: Run[], color: Color, boldColor?: Color): Run[] {
  return runs.map((r) => ({ ...r, color: (r.weight ?? 400) >= 600 ? (boldColor ?? color) : color }));
}

/* ------------------------------------------------------------------ */
/* Tablas de opciones para los selects                                 */
/* ------------------------------------------------------------------ */

export const FORMAT_OPTIONS: { value: Format; label: string; hint: string }[] = [
  { value: "1x1", label: "1:1", hint: "1080×1080" },
  { value: "4x5", label: "4:5", hint: "1080×1350" },
  { value: "9x16", label: "9:16", hint: "1080×1920" },
  { value: "16x9", label: "16:9", hint: "1920×1080" },
];

export const PRODUCTO_OPTIONS: { value: Producto; label: string }[] = [
  { value: "sellers", label: "Sellers" },
  { value: "multiproducto", label: "Multiproducto" },
  { value: "inmo-sellers", label: "Inmo Sellers" },
  { value: "mm-sellers", label: "MM Sellers" },
];

export const SOURCE_OPTIONS: { value: UtmSource; label: string }[] = [
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google" },
  { value: "tiktok", label: "TikTok" },
];

export const SIZE_OPTIONS: { value: AdScaleStep; label: string }[] = AD_SCALE_KEYS.map((k) => ({ value: k, label: k }));

export const ALIGN_OPTIONS = [
  { value: "left" as const, label: "Izq." },
  { value: "center" as const, label: "Centro" },
  { value: "right" as const, label: "Der." },
];

export const CTA_VARIANT_OPTIONS: { value: CtaVariant; label: string }[] = [
  { value: "pastilla-oscura-sobre-lila", label: "Pastilla oscura sobre lila" },
  { value: "pastilla-morada-sobre-blanco", label: "Pastilla morada sobre blanco" },
  { value: "pastilla-blanca", label: "Pastilla blanca" },
  { value: "badge-gradiente", label: "Badge con gradiente" },
];

export const GLYPH_OPTIONS = [
  { value: "play" as const, label: "Play ▶" },
  { value: "chevron-down" as const, label: "Chevron ▾" },
  { value: "arrow-right" as const, label: "Flecha →" },
  { value: "none" as const, label: "Sin glifo" },
];

export const LOGO_SLOT_OPTIONS: { value: LogoSlot; label: string }[] = [
  { value: "top-center", label: "Arriba centro" },
  { value: "top-left", label: "Arriba izq." },
  { value: "top-right", label: "Arriba der." },
  { value: "bottom-left", label: "Abajo izq." },
  { value: "bottom-right", label: "Abajo der." },
  { value: "in-cta", label: "Dentro del CTA" },
];

export const LOGO_FORMAT_OPTIONS: { value: LogoFormat; label: string }[] = [
  { value: "completo", label: "Completo" },
  { value: "simbolo", label: "Símbolo" },
  { value: "horizontal", label: "Horizontal" },
];

export const LOGO_TREATMENT_OPTIONS: { value: LogoTreatment | "auto"; label: string }[] = [
  { value: "auto", label: "Automático (según el fondo)" },
  { value: "color", label: "Color (fondo claro)" },
  { value: "blanco", label: "Blanco (fondo oscuro)" },
  { value: "colorSobreBlanco", label: "Placa blanca (sobre foto)" },
];

export const ANCHOR_OPTIONS = [
  { value: "bottom-left" as const, label: "Abajo izq." },
  { value: "bottom-center" as const, label: "Abajo centro" },
  { value: "bottom-right" as const, label: "Abajo der." },
  { value: "center" as const, label: "Centro" },
  { value: "top-center" as const, label: "Arriba centro" },
];

export const BLEND_OPTIONS = [
  { value: "normal" as const, label: "Normal" },
  { value: "multiply" as const, label: "Multiply (grafiti)" },
  { value: "screen" as const, label: "Screen" },
];

/** Atributos del protagonista: cada select alimenta el prompt y el slug de la UTM. */
export const PROT_TIPO_OPTIONS: { value: ProtagonistaAttrs["tipo"]; label: string }[] = [
  { value: "persona", label: "Persona" },
  { value: "objeto", label: "Objeto" },
  { value: "inmueble-3d", label: "Inmueble 3D" },
  { value: "arte-tipografico", label: "Arte tipográfico" },
];

export const GENERO_OPTIONS = [
  { value: "mujer" as const, label: "Mujer" },
  { value: "hombre" as const, label: "Hombre" },
  { value: "pareja" as const, label: "Pareja" },
];
export const EDAD_OPTIONS = [
  { value: "joven" as const, label: "Joven" },
  { value: "adulto" as const, label: "Adulto" },
  { value: "mayor" as const, label: "Mayor" },
];
export const PIEL_OPTIONS = [
  { value: "blanca" as const, label: "Blanca" },
  { value: "trigueña" as const, label: "Trigueña" },
  { value: "morena" as const, label: "Morena" },
  { value: "negra" as const, label: "Negra" },
];
export const PELO_COLOR_OPTIONS = [
  { value: "negro" as const, label: "Negro" },
  { value: "castano" as const, label: "Castaño" },
  { value: "rubio" as const, label: "Rubio" },
  { value: "canoso" as const, label: "Canoso" },
  { value: "rojizo" as const, label: "Rojizo" },
];
export const PELO_LARGO_OPTIONS = [
  { value: "corto" as const, label: "Corto" },
  { value: "medio" as const, label: "Medio" },
  { value: "largo" as const, label: "Largo" },
];
export const EXPRESION_OPTIONS = [
  { value: "sonriendo" as const, label: "Sonriendo" },
  { value: "riendo" as const, label: "Riendo" },
  { value: "serio" as const, label: "Serio" },
  { value: "mirando-celular" as const, label: "Mirando el celular" },
];
export const POSE_OPTIONS = [
  { value: "de-pie" as const, label: "De pie" },
  { value: "con-celular" as const, label: "Con celular" },
  { value: "brazos-cruzados" as const, label: "Brazos cruzados" },
  { value: "manos-en-bolsillos" as const, label: "Manos en bolsillos" },
  { value: "sentado" as const, label: "Sentado" },
];
export const ENCUADRE_OPTIONS = [
  { value: "cuerpo-completo" as const, label: "Cuerpo completo" },
  { value: "medio-cuerpo" as const, label: "Medio cuerpo" },
  { value: "detalle" as const, label: "Detalle" },
  { value: "mano" as const, label: "Mano" },
];

export const FONDO_TIPO_OPTIONS = [
  { value: "interior" as const, label: "Interior" },
  { value: "sala" as const, label: "Sala" },
  { value: "exterior" as const, label: "Exterior" },
  { value: "muro" as const, label: "Muro" },
  { value: "abstracto" as const, label: "Abstracto" },
];
export const FONDO_ESTILO_OPTIONS = [
  { value: "luminoso" as const, label: "Luminoso" },
  { value: "calido" as const, label: "Cálido" },
  { value: "minimal" as const, label: "Minimal" },
  { value: "moderno" as const, label: "Moderno" },
];
export const DESENFOQUE_OPTIONS = [
  { value: "nitido" as const, label: "Nítido" },
  { value: "suave" as const, label: "Suave" },
  { value: "fuerte" as const, label: "Fuerte" },
];

export const MODEL_OPTIONS = [
  { value: "quality" as const, label: "Calidad (nano-banana-pro)" },
  { value: "fast" as const, label: "Rápido y barato (nano-banana)" },
];

/** Swatches disponibles en los selectores de color. */
export const SWATCHES: ColorToken[] = [
  "white",
  "purple-50",
  "purple-100",
  "purple-200",
  "purple-300",
  "purple-400",
  "purple-500",
  "purple-600",
  "purple-700",
  "purple-800",
  "purple-900",
  "purple-950",
  "neutral-100",
  "neutral-300",
  "neutral-600",
  "neutral-900",
];

export function swatchHex(token: ColorToken): string {
  return COLOR_HEX[token];
}

/* ------------------------------------------------------------------ */
/* Spec en blanco                                                      */
/* ------------------------------------------------------------------ */

/** Punto de partida sensato cuando se entra a la fábrica sin preset. */
export function blankSpec(): CreativeSpec {
  return {
    id: uuid(),
    shortId: shortId(),
    name: "Pieza sin título",
    format: "1x1",
    producto: "sellers",
    pais: "co",
    origin: "factory",
    createdAt: new Date().toISOString(),
    fondo: { kind: "gradiente", from: "purple-600", via: "purple-800", to: "purple-950", angle: 180 },
    titulo: {
      runs: [{ text: "Vende tu apto", weight: 700, color: "white" }],
      size: "display-lg",
      align: "left",
      box: { x: 7, y: 16, w: 70 },
    },
    texto: {
      runs: [{ text: "más rápido y sin estrés.", weight: 400, color: "white" }],
      size: "body-lg",
      align: "left",
      box: { x: 7, y: 40, w: 60 },
    },
    cta: {
      label: [
        { text: "Recibe una ", weight: 400, color: "white" },
        { text: "oferta gratis", weight: 700, color: "white" },
      ],
      variant: "pastilla-oscura-sobre-lila",
      glyph: "play",
      box: { x: 7, y: 77, w: 86, h: 16 },
      containerColor: "purple-400",
      pillColor: "purple-900",
    },
    logo: { slot: "in-cta", heightCu: 92, format: "completo", treatment: "auto" },
  };
}

/** Receta por defecto al activar el protagonista (persona: el caso más común). */
export function defaultProtagonistaRecipe(): ProtagonistaAttrs {
  return {
    tipo: "persona",
    genero: "mujer",
    edad: "joven",
    piel: "trigueña",
    pelo: { color: "negro", largo: "largo" },
    expresion: "sonriendo",
    pose: "de-pie",
    encuadre: "medio-cuerpo",
    vestuario: { prenda: "blazer", color: "morado" },
  };
}

export const DEFAULT_OVERLAY = BRAND_OVERLAY;

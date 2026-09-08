/**
 * UTM derivada de la configuración.
 *
 * Cada pieza produce un utm_content que describe lo que hay en la imagen (rasgos del
 * protagonista, fondo, título y CTA), así el reporte de pauta se lee sin abrir el creativo.
 *
 * Módulo puro: sin React, sin APIs de Node, sin reloj interno (la fecha entra por
 * parámetro). Sólo importa tipos, para que scripts/check-utm.ts lo cargue con node directo.
 */
import type {
  CreativeSpec,
  Fondo,
  FondoAttrs,
  Format,
  LayerAttrs,
  LayerKind,
  Pais,
  Producto,
  ProtagonistaAttrs,
  Run,
  Utm,
  UtmSource,
} from "./creative/types";

/** Límite duro de un slug de capa (protagonista o fondo). */
export const MAX_SLUG_LEN = 90;
/** Límite duro del utm_content completo. */
export const MAX_CONTENT_LEN = 200;

/** Palabras vacías que no aportan al slug de `sujeto`/`libre`. Editable. */
export const STOPWORDS_ES: ReadonlySet<string> = new Set([
  "de", "la", "el", "un", "una", "con", "en", "y", "que", "para", "por", "sobre", "del", "los", "las",
  "a", "o", "u", "e", "al", "lo", "le", "se", "su", "sus", "es", "ni", "unos", "unas", "muy", "mas",
]);

/** Landing por producto y país. Editable: la UTM sólo la lee. */
export const LANDING_PATHS: Record<Pais, Record<Producto, string>> = {
  co: {
    sellers: "/vende-tu-casa",
    multiproducto: "/",
    "inmo-sellers": "/inmobiliarias",
    "mm-sellers": "/vende-tu-casa",
  },
};

/* ------------------------------------------------------------------ */
/* Texto → slug                                                         */
/* ------------------------------------------------------------------ */

/** "¿Listo para vender tu apto?" → "listo-para-vender-tu-apto". La ñ cae a n vía NFD. */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Palabras (separadas por espacio) ya slugificadas, sin vacíos. */
function words(text: string): string[] {
  return text.split(/\s+/).map(slugify).filter(Boolean);
}

/** Primeras `n` palabras que no son stopwords. */
function significantWords(text: string, n: number): string[] {
  return words(text)
    .filter((w) => !STOPWORDS_ES.has(w))
    .slice(0, n);
}

function isNonEmpty(x: string | undefined | false): x is string {
  return typeof x === "string" && x.length > 0;
}

/**
 * Une tokens con '-' sin pasar de `max`. Recorta tokens completos desde el final; sólo si
 * un único token ya excede el límite se recorta por sus piezas internas.
 */
function capTokens(tokens: string[], max: number): string {
  const t = tokens.filter(Boolean);
  while (t.length > 1 && t.join("-").length > max) t.pop();
  if (t.length === 1 && t[0].length > max) {
    const pieces = t[0].split("-");
    while (pieces.length > 1 && pieces.join("-").length > max) pieces.pop();
    return pieces.join("-").slice(0, max);
  }
  return t.join("-");
}

/* ------------------------------------------------------------------ */
/* Atributos → slug                                                     */
/* ------------------------------------------------------------------ */

/** "blusa asimétrica de un hombro" + "vinotinto" → "blusavinotinto" (prenda y color pegados). */
function vestuarioToken(v: { prenda: string; color: string }): string {
  const prenda = words(v.prenda)[0] ?? "";
  return `${prenda}${slugify(v.color)}`;
}

/** Tokens del protagonista. Cada token es una unidad que el recorte nunca parte. */
function protagonistaTokens(a: ProtagonistaAttrs): string[] {
  if (a.tipo === "persona") {
    return [
      a.genero,
      a.edad,
      a.piel && `piel${slugify(a.piel)}`,
      a.pelo && `pelo${slugify(a.pelo.color)}-${slugify(a.pelo.largo)}`,
      a.expresion,
      a.vestuario && vestuarioToken(a.vestuario),
      a.pose,
      a.encuadre,
    ]
      .filter(isNonEmpty)
      .map(slugify);
  }
  // objeto / inmueble-3d / arte-tipografico: cada palabra es un token.
  return [
    slugify(a.tipo),
    ...significantWords(a.sujeto ?? "", 4),
    ...words(a.copy ?? "").slice(0, 3),
    ...significantWords(a.libre ?? "", 3),
  ];
}

function fondoTokens(a: FondoAttrs): string[] {
  return [slugify(a.tipo), slugify(a.estilo), slugify(a.desenfoque), ...(a.elementos ?? []).slice(0, 3).map(slugify)];
}

export function slugFromAttrs(kind: "protagonista", attrs: ProtagonistaAttrs): string;
export function slugFromAttrs(kind: "fondo", attrs: FondoAttrs): string;
export function slugFromAttrs(kind: LayerKind, attrs: LayerAttrs): string;
export function slugFromAttrs(kind: LayerKind, attrs: LayerAttrs): string {
  const tokens = kind === "fondo" ? fondoTokens(attrs as FondoAttrs) : protagonistaTokens(attrs as ProtagonistaAttrs);
  return capTokens(tokens, MAX_SLUG_LEN);
}

/* ------------------------------------------------------------------ */
/* Atributos → descripción legible                                      */
/* ------------------------------------------------------------------ */

const TIPO_LABEL: Record<ProtagonistaAttrs["tipo"], string> = {
  persona: "Persona",
  objeto: "Objeto",
  "inmueble-3d": "Inmueble 3D",
  "arte-tipografico": "Arte tipográfico",
};

const PELO_LABEL: Record<NonNullable<ProtagonistaAttrs["pelo"]>["color"], string> = {
  negro: "negro",
  castano: "castaño",
  rubio: "rubio",
  canoso: "canoso",
  rojizo: "rojizo",
};

const FONDO_TIPO_LABEL: Record<FondoAttrs["tipo"], string> = {
  interior: "Interior",
  sala: "Sala",
  exterior: "Exterior",
  muro: "Muro",
  abstracto: "Abstracto",
};

const ESTILO_LABEL: Record<FondoAttrs["estilo"], string> = {
  luminoso: "luminoso",
  calido: "cálido",
  minimal: "minimal",
  moderno: "moderno",
};

const DESENFOQUE_LABEL: Record<FondoAttrs["desenfoque"], string> = {
  nitido: "nítido",
  suave: "desenfoque suave",
  fuerte: "desenfoque fuerte",
};

function dehyphen(s: string): string {
  return s.replace(/-/g, " ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncateWords(text: string, n: number): string {
  const w = text.trim().split(/\s+/);
  return w.length > n ? `${w.slice(0, n).join(" ")}…` : w.join(" ");
}

/** Versión legible en español para la UI: "Mujer joven, piel blanca, pelo castaño largo, …". */
export function describeAttrs(kind: LayerKind, attrs: LayerAttrs): string {
  if (kind === "fondo") {
    const a = attrs as FondoAttrs;
    const head = `${FONDO_TIPO_LABEL[a.tipo]} ${ESTILO_LABEL[a.estilo]}, ${DESENFOQUE_LABEL[a.desenfoque]}`;
    const elementos = (a.elementos ?? []).map(dehyphen).join(", ");
    return elementos ? `${head}: ${elementos}` : head;
  }

  const a = attrs as ProtagonistaAttrs;
  if (a.tipo === "persona") {
    const parts = [
      [a.genero, a.edad].filter(isNonEmpty).join(" ") || "persona",
      a.piel && `piel ${a.piel}`,
      a.pelo && `pelo ${PELO_LABEL[a.pelo.color]} ${a.pelo.largo}`,
      a.expresion && dehyphen(a.expresion),
      a.vestuario && `${a.vestuario.prenda} ${a.vestuario.color}`.trim(),
      a.pose && dehyphen(a.pose),
      dehyphen(a.encuadre),
    ].filter(isNonEmpty);
    return capitalize(parts.join(", "));
  }

  const parts = [
    a.sujeto && truncateWords(a.sujeto, 12),
    a.copy && `copy: "${truncateWords(a.copy.replace(/\s+/g, " "), 8)}"`,
    a.libre && truncateWords(a.libre, 8),
  ].filter(isNonEmpty);
  return parts.length ? `${TIPO_LABEL[a.tipo]}: ${parts.join(" · ")}` : TIPO_LABEL[a.tipo];
}

/* ------------------------------------------------------------------ */
/* Campaña, landing y content                                           */
/* ------------------------------------------------------------------ */

export function landingPathFor(producto: Producto, pais: Pais): string {
  return (LANDING_PATHS[pais] ?? LANDING_PATHS.co)[producto] ?? "/";
}

/** `${producto}-${pais}-${yy}${mm}` en UTC (Vercel corre en UTC), p. ej. sellers-co-2609. */
export function campaignFor(producto: Producto, pais: Pais, date: Date): string {
  const yy = String(date.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${producto}-${pais}-${yy}${mm}`;
}

/** Concatena los runs de un slot en una sola línea ("\n" → espacio). */
export function textOf(runs?: Run[]): string {
  return (runs ?? [])
    .map((r) => r.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** plano → plano-<color>; gradiente → gradiente-<from>-<to>; asset → slug de attrs o asset-<hash8>. */
export function fondoSlugOf(fondo: Fondo, fondoAttrs?: FondoAttrs): string {
  switch (fondo.kind) {
    case "plano":
      return `plano-${slugify(fondo.color)}`;
    case "gradiente":
      return `gradiente-${slugify(fondo.from)}-${slugify(fondo.to)}`;
    case "asset": {
      const attrs = fondoAttrs ?? fondo.recipe;
      if (attrs) return slugFromAttrs("fondo", attrs);
      if (fondo.assetHash) return `asset-${fondo.assetHash.slice(0, 8)}`;
      return "asset";
    }
  }
}

export type UtmContentInput = {
  format: Format;
  protagonistaSlug?: string;
  fondoSlug: string;
  tituloText?: string;
  ctaText?: string;
};

/** Máximo de palabras que entran del título y del CTA. */
const TIT_MAX_WORDS = 6;
const CTA_MAX_WORDS = 5;
/** Pisos del recorte: antes de vaciar un token se recortan los demás hasta aquí. */
const TIT_MIN_WORDS = 4;
const PROT_MIN_PIECES = 3;
const FONDO_MIN_PIECES = 3;

/** Quita piezas finales que quedaron colgando ("manos-en" → "manos"). */
function dropTrailingStopwords(pieces: string[], floor: number): void {
  while (pieces.length > floor && STOPWORDS_ES.has(pieces[pieces.length - 1])) pieces.pop();
}

/**
 * Tokens unidos por '_': f<formato>, prot-<slug>, fondo-<slug>, tit-<título>, cta-<cta|none>.
 * Si excede MAX_CONTENT_LEN recorta por tokens: primero tit (hasta 4 palabras), luego prot
 * (hasta 3 piezas), luego fondo (hasta 3 piezas); si aún no cabe, vacía tit y después prot.
 */
export function buildUtmContent(input: UtmContentInput): string {
  const tit = words(input.tituloText ?? "").slice(0, TIT_MAX_WORDS);
  const cta = words(input.ctaText ?? "").slice(0, CTA_MAX_WORDS);
  const prot = (input.protagonistaSlug ?? "").split("-").filter(Boolean);
  const fondo = input.fondoSlug.split("-").filter(Boolean);

  const assemble = () =>
    [
      `f${slugify(input.format)}`,
      prot.length ? `prot-${prot.join("-")}` : undefined,
      `fondo-${fondo.length ? fondo.join("-") : "none"}`,
      tit.length ? `tit-${tit.join("-")}` : undefined,
      `cta-${cta.length ? cta.join("-") : "none"}`,
    ]
      .filter(isNonEmpty)
      .join("_");

  let content = assemble();
  while (content.length > MAX_CONTENT_LEN) {
    if (tit.length > TIT_MIN_WORDS) tit.pop();
    else if (prot.length > PROT_MIN_PIECES) {
      prot.pop();
      dropTrailingStopwords(prot, PROT_MIN_PIECES);
    } else if (fondo.length > FONDO_MIN_PIECES) {
      fondo.pop();
      dropTrailingStopwords(fondo, FONDO_MIN_PIECES);
    } else if (tit.length) tit.pop();
    else if (prot.length) prot.pop();
    else break;
    content = assemble();
  }
  return content;
}

/* ------------------------------------------------------------------ */
/* UTM completa                                                          */
/* ------------------------------------------------------------------ */

export type BuildUtmOptions = {
  source?: UtmSource;
  medium?: string;
  baseUrl?: string;
  /** Fecha de la campaña; nunca se toma del reloj para que el resultado sea reproducible. */
  date: Date;
  /** Sobrescriben la receta del spec (capa traída de la biblioteca: attrs en LayerMeta). */
  protagonistaAttrs?: ProtagonistaAttrs;
  fondoAttrs?: FondoAttrs;
};

const UTM_DEFAULTS = { source: "meta" as UtmSource, medium: "paid_social", baseUrl: "https://www.habi.co" };

export function buildUtm(spec: CreativeSpec, opts: BuildUtmOptions): Utm {
  const source = opts.source ?? UTM_DEFAULTS.source;
  const medium = opts.medium ?? UTM_DEFAULTS.medium;
  const baseUrl = (opts.baseUrl ?? UTM_DEFAULTS.baseUrl).replace(/\/+$/, "");

  // Los ajustes por formato pueden cambiar título, CTA o fondo de esta pieza.
  const layout = spec.layouts?.[spec.format];
  const protagonista = spec.protagonista;
  const protAttrs = opts.protagonistaAttrs ?? protagonista?.recipe ?? layout?.protagonista?.recipe;
  const protHash = protagonista?.assetHash ?? layout?.protagonista?.assetHash;
  const protagonistaSlug = protAttrs
    ? slugFromAttrs("protagonista", protAttrs)
    : protHash
      ? `asset-${protHash.slice(0, 8)}`
      : undefined;

  const fondoSlug = fondoSlugOf(layout?.fondo ?? spec.fondo, opts.fondoAttrs);
  const titulo = layout?.titulo ?? spec.titulo;
  const cta = layout?.cta ?? spec.cta;

  const content = buildUtmContent({
    format: spec.format,
    protagonistaSlug,
    fondoSlug,
    tituloText: textOf(titulo?.runs),
    ctaText: textOf(cta?.label),
  });
  const campaign = campaignFor(spec.producto, spec.pais, opts.date);
  const term = spec.shortId;

  const query = [
    ["utm_source", source],
    ["utm_medium", medium],
    ["utm_campaign", campaign],
    ["utm_content", content],
    ["utm_term", term],
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `${baseUrl}${landingPathFor(spec.producto, spec.pais)}?${query}`;

  return { source, medium, campaign, content, term, url, filename: `${content}.png` };
}

/* ------------------------------------------------------------------ */
/* Inverso para la UI                                                    */
/* ------------------------------------------------------------------ */

export type UtmContentParts = { format?: Format; prot?: string; fondo?: string; tit?: string; cta?: string };

/** Espejo de types.ts: si Format cambia, tsc obliga a actualizar esto. */
const FORMAT_SET: Record<Format, true> = { "1x1": true, "4x5": true, "9x16": true, "16x9": true };

/** Separa un utm_content en sus partes. `cta` vuelve tal cual ("none" si no había CTA). */
export function parseUtmContent(content: string): UtmContentParts {
  const out: UtmContentParts = {};
  for (const piece of content.split("_")) {
    if (piece.startsWith("f") && piece.slice(1) in FORMAT_SET) out.format = piece.slice(1) as Format;
    else if (piece.startsWith("prot-")) out.prot = piece.slice(5);
    else if (piece.startsWith("fondo-")) out.fondo = piece.slice(6);
    else if (piece.startsWith("tit-")) out.tit = piece.slice(4);
    else if (piece.startsWith("cta-")) out.cta = piece.slice(4);
  }
  return out;
}

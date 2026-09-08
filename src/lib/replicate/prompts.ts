/**
 * Sistema de prompts. Los atributos del spec están en español (son los que viajan al
 * slug de la UTM); el prompt se arma en inglés porque los modelos responden mejor.
 * Los textos libres (`libre`, `sujeto`) se pasan tal cual, marcados como dirección en
 * español que el modelo debe seguir literalmente: Nano Banana es multilingüe y así no
 * inventamos una traducción que el usuario no escribió.
 *
 * Todo es determinístico: misma receta → mismo prompt → mismo hash → misma capa cacheada.
 */

import type { Format, FondoAttrs, LayerAttrs, LayerKind, ProtagonistaAttrs } from "@/lib/creative/types";
import { REPLICATE_ASPECT } from "@/lib/creative/scale";
import { hashLayer } from "@/lib/store/hash";
import { type GenAspect, type GenerateModel, resolveModel } from "./models";

/* ------------------------------------------------------------------ */
/* Dirección de arte (brand center, cap. 08)                            */
/* ------------------------------------------------------------------ */

export const ART_DIRECTION_PARTS = {
  people: "Real people with authentic, individual features, not stock models, no posed catalogue look.",
  light: "Natural warm side light, soft organic shadows, no hard flash, no HDR look, no oversaturation.",
  composition: "Subject placed off-center with generous negative space.",
  finish: "Editorial, premium, clean. No text, no logos, no watermarks.",
} as const;

export const ART_DIRECTION = Object.values(ART_DIRECTION_PARTS).join(" ");

const GREY_STUDIO = "isolated on a plain solid light grey (#E5E5E5) studio background";
const WHITE_FLAT = "on a pure flat white (#FFFFFF) background, no wall, no shadows, no texture, nothing else in the frame";

/* ------------------------------------------------------------------ */
/* Diccionarios español → inglés                                        */
/* ------------------------------------------------------------------ */

const GENERO: Record<NonNullable<ProtagonistaAttrs["genero"]>, string> = {
  mujer: "a woman",
  hombre: "a man",
  pareja: "a couple, a man and a woman standing close together",
};

const EDAD: Record<NonNullable<ProtagonistaAttrs["edad"]>, string> = {
  joven: "young adult in their late twenties to early thirties",
  adulto: "adult in their forties",
  mayor: "senior in their sixties with natural signs of age",
};

const PIEL: Record<NonNullable<ProtagonistaAttrs["piel"]>, string> = {
  blanca: "fair skin",
  trigueña: "light brown, olive-toned Latin American skin",
  morena: "medium brown skin",
  negra: "deep dark brown skin",
};

const PELO_COLOR: Record<NonNullable<ProtagonistaAttrs["pelo"]>["color"], string> = {
  negro: "black",
  castano: "chestnut brown",
  rubio: "blonde",
  canoso: "grey",
  rojizo: "auburn red",
};

const PELO_LARGO: Record<NonNullable<ProtagonistaAttrs["pelo"]>["largo"], string> = {
  corto: "short",
  medio: "medium-length",
  largo: "long",
};

const EXPRESION: Record<NonNullable<ProtagonistaAttrs["expresion"]>, string> = {
  sonriendo: "smiling warmly at the camera",
  serio: "calm, confident neutral expression, looking straight at the camera",
  "mirando-celular": "smiling softly while looking down at a smartphone screen",
  riendo: "laughing naturally, candid",
};

const POSE: Record<NonNullable<ProtagonistaAttrs["pose"]>, string> = {
  "de-pie": "standing upright with a relaxed natural posture",
  "con-celular": "holding a smartphone with both hands at chest height",
  "brazos-cruzados": "arms crossed, confident",
  "manos-en-bolsillos": "hands in pockets, relaxed shoulders",
  sentado: "sitting, relaxed",
};

const ENCUADRE: Record<ProtagonistaAttrs["encuadre"], string> = {
  "cuerpo-completo": "full body from head to feet, shoes included, with clear space above the head and below the feet",
  "medio-cuerpo": "medium shot from the waist up, with clear space above the head",
  detalle: "close-up detail shot",
  mano: "close-up of a hand and forearm",
};

/** Aspecto de la imagen generada según encuadre (persona y objeto). */
const ENCUADRE_ASPECT: Record<ProtagonistaAttrs["encuadre"], ProtagonistaAspect> = {
  "cuerpo-completo": "3:4",
  "medio-cuerpo": "3:4",
  detalle: "1:1",
  mano: "1:1",
};

/** Colores de vestuario más comunes. Lo que no esté aquí pasa en español. */
const COLORES: Record<string, string> = {
  vinotinto: "burgundy",
  morado: "purple",
  lila: "lilac",
  violeta: "violet",
  purpura: "purple",
  negro: "black",
  blanco: "white",
  gris: "grey",
  beige: "beige",
  crema: "cream",
  azul: "blue",
  "azul marino": "navy blue",
  "azul claro": "light blue",
  rojo: "red",
  verde: "green",
  "verde oliva": "olive green",
  amarillo: "yellow",
  mostaza: "mustard yellow",
  rosado: "pink",
  rosa: "pink",
  naranja: "orange",
  cafe: "brown",
  marron: "brown",
  camel: "camel",
  turquesa: "turquoise",
  dorado: "gold",
  plateado: "silver",
};

/** Prendas comunes. Se traduce palabra por palabra; lo desconocido pasa en español. */
const PRENDAS: Record<string, string> = {
  blusa: "blouse",
  camisa: "shirt",
  camiseta: "t-shirt",
  blazer: "blazer",
  saco: "sweater",
  sueter: "sweater",
  chaqueta: "jacket",
  abrigo: "coat",
  gabardina: "trench coat",
  vestido: "dress",
  falda: "skirt",
  pantalon: "trousers",
  jean: "jeans",
  jeans: "jeans",
  polo: "polo shirt",
  buzo: "hoodie",
  chaleco: "vest",
  top: "top",
  uniforme: "uniform",
  traje: "suit",
  corbata: "tie",
};

/** Elementos de fondo. Frases completas (con guiones) primero; lo demás pasa con espacios. */
const ELEMENTOS: Record<string, string> = {
  sofa: "sofa",
  "sofa-claro": "light-coloured sofa",
  "sofa-gris": "grey sofa",
  planta: "indoor plant",
  plantas: "indoor plants",
  ventana: "window",
  "ventana-grande": "large window",
  "ventanas-grandes": "large windows",
  ladrillo: "brick",
  "ladrillo-blanco": "white painted brick",
  lampara: "lamp",
  "lampara-de-pie": "floor lamp",
  "cielo-azul-con-nubes": "blue sky with soft clouds",
  "jardin-con-flores": "garden bed with plants and flowers",
  adoquines: "cobblestone paving",
  "pared-blanca": "plain white wall",
  "paredes-blancas": "white walls",
  "luz-natural": "natural daylight",
  "banco-de-madera-clara": "low light-wood bench",
  "silla-lila": "light-wood chair with a lilac cushion",
  "jarron-con-ramas-secas": "white vase with dry branches",
  "piso-madera-clara": "light wood floor",
  "piso-de-madera": "wood floor",
  cortinas: "sheer curtains",
  "mesa-de-centro": "coffee table",
  cuadro: "framed artwork",
  alfombra: "rug",
  libros: "books",
  cocina: "kitchen",
  comedor: "dining table",
  espejo: "mirror",
  escalera: "staircase",
  balcon: "balcony",
  terraza: "terrace",
  cielo: "sky",
  arboles: "trees",
  fachada: "building facade",
  edificio: "residential building",
  puerta: "door",
  "puerta-de-madera": "wooden door",
};

const TIPO_FONDO: Record<FondoAttrs["tipo"], string> = {
  interior: "Editorial interior photograph of a modern apartment",
  sala: "Editorial interior photograph of the living room of a modern home",
  exterior: "Editorial photograph of a residential exterior scene",
  muro: "Editorial photograph of a plain wall seen straight on as the main surface, filling most of the frame, completely empty",
  abstracto: "Abstract background image of soft shapes and light gradients, no recognisable objects",
};

const ESTILO_FONDO: Record<FondoAttrs["estilo"], string> = {
  luminoso: "bright and airy, abundant natural daylight, white and light neutral tones",
  calido: "warm and cosy, golden afternoon light, wood, linen and beige textures",
  minimal: "minimalist and uncluttered, very few objects, clean lines, lots of empty wall",
  moderno: "contemporary design, clean architecture, neutral palette with subtle contrast",
};

const DESENFOQUE: Record<FondoAttrs["desenfoque"], string> = {
  nitido: "sharp focus throughout, crisp architectural detail",
  suave: "shallow depth of field, soft bokeh in the distance",
  fuerte: "heavily defocused, abstract bokeh, no legible details, only soft shapes and colour",
};

const ORIENTACION: Record<GenAspect, string> = {
  "1:1": "square composition",
  "2:3": "vertical composition",
  "3:4": "vertical composition",
  "4:5": "vertical composition",
  "9:16": "tall vertical composition",
  "3:2": "horizontal composition",
  "4:3": "horizontal composition",
  "5:4": "horizontal composition",
  "16:9": "wide horizontal composition",
  "21:9": "panoramic composition",
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => stripAccents(s.trim().toLowerCase());

function translateColor(color: string): string {
  const key = norm(color);
  if (COLORES[key]) return COLORES[key];
  return key
    .split(/\s+/)
    .map((w) => COLORES[w] ?? w)
    .join(" ");
}

function translateGarment(prenda: string): string {
  const key = norm(prenda);
  if (PRENDAS[key]) return PRENDAS[key];
  // Sólo se traduce la palabra cabeza; el resto de la descripción va en español.
  const [head, ...rest] = prenda.trim().split(/\s+/);
  const headEn = PRENDAS[norm(head)];
  return headEn ? [headEn, ...rest].join(" ") : prenda.trim();
}

function translateElemento(token: string): string {
  const key = norm(token).replace(/\s+/g, "-");
  return ELEMENTOS[key] ?? token.trim().replace(/-/g, " ");
}

/** Dirección libre del usuario; va literal, marcada como español. */
const spanishNote = (label: string, text?: string) =>
  text && text.trim() ? `${label} (written in Spanish, follow it literally): ${text.trim().replace(/\.?$/, "")}.` : null;

const join = (parts: Array<string | null | undefined | false>) =>
  parts
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

export function isProtagonistaAttrs(attrs: LayerAttrs): attrs is ProtagonistaAttrs {
  return "encuadre" in attrs;
}

export function isFondoAttrs(attrs: LayerAttrs): attrs is FondoAttrs {
  return "estilo" in attrs && "desenfoque" in attrs;
}

/* ------------------------------------------------------------------ */
/* Protagonista                                                         */
/* ------------------------------------------------------------------ */

export type ProtagonistaAspect = "1:1" | "3:4" | "4:5" | "9:16" | "16:9" | "2:3";

export type ProtagonistaPrompt = {
  prompt: string;
  /** true → la imagen pasa por bria/remove-background antes de guardarse. */
  needsRmbg: boolean;
  aspect: ProtagonistaAspect;
  /** Fondo pedido al modelo: gris para recortar, blanco para componer con multiply. */
  background: "grey" | "white";
};

function personaPrompt(a: ProtagonistaAttrs): ProtagonistaPrompt {
  const who: string[] = [a.genero ? GENERO[a.genero] : "a person"];
  if (a.edad) who.push(EDAD[a.edad]);
  if (a.piel) who.push(PIEL[a.piel]);
  if (a.pelo) who.push(`${PELO_LARGO[a.pelo.largo]} ${PELO_COLOR[a.pelo.color]} hair`);
  if (a.expresion) who.push(EXPRESION[a.expresion]);
  if (a.vestuario) who.push(`wearing a ${translateColor(a.vestuario.color)} ${translateGarment(a.vestuario.prenda)}`);
  if (a.pose) who.push(POSE[a.pose]);

  const prompt = join([
    `Editorial photograph of ${who.join(", ")}.`,
    `Framing: ${ENCUADRE[a.encuadre]}.`,
    spanishNote("Subject notes", a.sujeto),
    spanishNote("Additional direction", a.libre),
    `The subject is ${GREY_STUDIO}, full subject visible, no cropping of head or hands, no props unless specified, photorealistic, shot on an 85mm lens, natural skin texture.`,
    ART_DIRECTION_PARTS.people,
    ART_DIRECTION_PARTS.light,
    ART_DIRECTION_PARTS.finish,
  ]);

  return { prompt, needsRmbg: true, aspect: ENCUADRE_ASPECT[a.encuadre], background: "grey" };
}

function objetoPrompt(a: ProtagonistaAttrs): ProtagonistaPrompt {
  const subject = a.sujeto?.trim() || a.libre?.trim() || "the object";
  const libre = a.sujeto?.trim() ? a.libre : undefined;

  const prompt = join([
    `Realistic product photograph. Subject (written in Spanish, follow it literally): ${subject.replace(/\.?$/, "")}.`,
    a.pose === "con-celular" && !a.sujeto ? "A hand holding a modern smartphone." : null,
    `Framing: ${ENCUADRE[a.encuadre]}.`,
    spanishNote("Additional direction", libre),
    `The subject is ${GREY_STUDIO}, fully visible with margin on all sides, no cropping, no props unless specified, no cast shadow on the background, photorealistic, soft studio light, true-to-life materials.`,
    ART_DIRECTION_PARTS.light,
    ART_DIRECTION_PARTS.finish,
  ]);

  return { prompt, needsRmbg: true, aspect: ENCUADRE_ASPECT[a.encuadre], background: "grey" };
}

function inmueble3dPrompt(a: ProtagonistaAttrs): ProtagonistaPrompt {
  const subject = a.sujeto?.trim() || a.libre?.trim() || "a small modern house";
  const libre = a.sujeto?.trim() ? a.libre : undefined;

  const prompt = join([
    "Clean 3D product-style render, isometric three-quarter view, soft studio lighting, on a plain solid light grey (#E5E5E5) background, no ground plane, no cast shadow.",
    `Subject (written in Spanish, follow it literally): ${subject.replace(/\.?$/, "")}.`,
    "The whole building is fully visible with even margin on all sides, nothing cropped.",
    spanishNote("Additional direction", libre),
    "Crisp edges, premium finish, subtle material textures, no people. No text, no logos, no watermarks.",
  ]);

  // Un inmueble en render es aproximadamente cuadrado; el encuadre no cambia el aspecto.
  return { prompt, needsRmbg: true, aspect: "1:1", background: "grey" };
}

function arteTipograficoPrompt(a: ProtagonistaAttrs): ProtagonistaPrompt {
  const lines = (a.copy ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const copy = lines.join(" / ");

  const layout =
    lines.length > 1
      ? `Lay the text out in exactly ${lines.length} lines, top to bottom: ${lines.map((l, i) => `line ${i + 1}: "${l}"`).join("; ")}.`
      : null;

  const prompt = join([
    `Hand-lettered graffiti artwork, spray-paint lettering. The artwork contains ONLY this text, line by line: ${copy}.`,
    layout,
    "Spell every word exactly as written: same accents (do not add accents that are not written), same punctuation, no quotation marks or guillemets, no extra words, no missing or duplicated letters, keep the capitalisation as given.",
    spanishNote("Lettering style", a.sujeto),
    spanishNote("Additional direction", a.libre),
    `The artwork sits ${WHITE_FLAT}; the lettering is fully visible with even margin.`,
    "Crisp, high contrast, premium finish. No logos, no watermarks, no other text.",
  ]);

  // Se compone con multiply sobre la pieza: el blanco desaparece, no hace falta recortar.
  return { prompt, needsRmbg: false, aspect: lines.length >= 3 ? "1:1" : "16:9", background: "white" };
}

export function buildProtagonistaPrompt(attrs: ProtagonistaAttrs): ProtagonistaPrompt {
  switch (attrs.tipo) {
    case "persona":
      return personaPrompt(attrs);
    case "objeto":
      return objetoPrompt(attrs);
    case "inmueble-3d":
      return inmueble3dPrompt(attrs);
    case "arte-tipografico":
      return arteTipograficoPrompt(attrs);
  }
}

/* ------------------------------------------------------------------ */
/* Fondo                                                                */
/* ------------------------------------------------------------------ */

export type FondoPrompt = { prompt: string; aspect: GenAspect };

export function buildFondoPrompt(attrs: FondoAttrs, format: Format): FondoPrompt {
  const aspect: GenAspect = REPLICATE_ASPECT[format];
  const elementos = (attrs.elementos ?? []).map(translateElemento).filter(Boolean);

  const prompt = join([
    `${TIPO_FONDO[attrs.tipo]}, ${ESTILO_FONDO[attrs.estilo]}.`,
    elementos.length > 0 ? `Featuring: ${elementos.join(", ")}.` : null,
    `${capitalize(DESENFOQUE[attrs.desenfoque])}.`,
    spanishNote("Additional direction", attrs.libre),
    // El aspecto va en el prompt a propósito: así cada formato tiene su propio hash y su propia imagen.
    `Composed for a ${aspect} frame, ${ORIENTACION[aspect]}, leaving room for a headline.`,
    "No people anywhere in the scene.",
    ART_DIRECTION_PARTS.light,
    ART_DIRECTION_PARTS.composition,
    ART_DIRECTION_PARTS.finish,
  ]);

  return { prompt, aspect };
}

/* ------------------------------------------------------------------ */
/* Receta resuelta                                                      */
/* ------------------------------------------------------------------ */

export type RecipeRequest = {
  kind: LayerKind;
  attrs: LayerAttrs;
  /** "fast" | "quality" | id completo. Por defecto DEFAULT_MODEL. */
  model?: string;
  /** Sólo afecta al fondo (aspecto). Por defecto "1x1". */
  format?: Format;
};

export type Recipe = {
  kind: LayerKind;
  attrs: LayerAttrs;
  model: GenerateModel;
  prompt: string;
  /** sha256(model + prompt + attrs) recortado; clave de caché en el store. */
  hash: string;
  needsRmbg: boolean;
  aspect: GenAspect;
};

/** Determinístico: misma entrada → mismo prompt y mismo hash. No llama a Replicate. */
export function resolveRecipe(req: RecipeRequest): Recipe {
  const model = resolveModel(req.model);

  if (req.kind === "protagonista") {
    if (!isProtagonistaAttrs(req.attrs)) throw new Error("Los atributos de protagonista requieren `encuadre`.");
    const p = buildProtagonistaPrompt(req.attrs);
    return {
      kind: req.kind,
      attrs: req.attrs,
      model,
      prompt: p.prompt,
      hash: hashLayer({ model, prompt: p.prompt, attrs: req.attrs }),
      needsRmbg: p.needsRmbg,
      aspect: p.aspect,
    };
  }

  if (!isFondoAttrs(req.attrs)) throw new Error("Los atributos de fondo requieren `estilo` y `desenfoque`.");
  const f = buildFondoPrompt(req.attrs, req.format ?? "1x1");
  return {
    kind: req.kind,
    attrs: req.attrs,
    model,
    prompt: f.prompt,
    hash: hashLayer({ model, prompt: f.prompt, attrs: req.attrs }),
    needsRmbg: false,
    aspect: f.aspect,
  };
}

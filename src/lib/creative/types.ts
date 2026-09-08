/**
 * CreativeSpec — la única fuente de verdad de una pieza.
 *
 * Un JSON serializable describe la pieza completa: es lo que se guarda, lo que se
 * previsualiza y lo que se exporta. Nunca hay dos descripciones de la misma pieza.
 *
 * Convenciones de unidades:
 * - Posiciones y tamaños de caja van en PORCENTAJE del canvas (0–100), así el mismo
 *   spec se adapta a los 4 formatos.
 * - Tamaños tipográficos y de logo van en "unidades de canvas" (cu): 1 cu = 1 px en un
 *   canvas cuyo lado menor mide 1080. Ver `scale.ts` → `unitFor(format)`.
 */

export type Format = "1x1" | "4x5" | "9x16" | "16x9";

export type Producto = "sellers" | "multiproducto" | "inmo-sellers" | "mm-sellers";
export type Pais = "co";

export type Weight = 400 | 500 | 600 | 700 | 800;

/** Tokens de color permitidos dentro de un spec. Se resuelven a hex en brand/colors.ts. */
export type ColorToken =
  | "white"
  | "black"
  | "purple-50"
  | "purple-100"
  | "purple-200"
  | "purple-300"
  | "purple-400"
  | "purple-500"
  | "purple-600"
  | "purple-700"
  | "purple-800"
  | "purple-900"
  | "purple-950"
  | "neutral-50"
  | "neutral-100"
  | "neutral-200"
  | "neutral-300"
  | "neutral-600"
  | "neutral-900";

/** Un color puede ser token de marca o, excepcionalmente, un hex literal. */
export type Color = ColorToken | `#${string}`;

/* ------------------------------------------------------------------ */
/* Capas de imagen (las que genera Replicate)                          */
/* ------------------------------------------------------------------ */

export type LayerKind = "protagonista" | "fondo";

/**
 * Atributos estructurados del protagonista. Cada campo aporta un token al slug de la
 * UTM y una frase al prompt, así la UTM siempre describe lo que hay en la imagen.
 */
export type ProtagonistaAttrs = {
  tipo: "persona" | "objeto" | "inmueble-3d" | "arte-tipografico";
  genero?: "mujer" | "hombre" | "pareja";
  edad?: "joven" | "adulto" | "mayor";
  piel?: "blanca" | "trigueña" | "morena" | "negra";
  pelo?: {
    color: "negro" | "castano" | "rubio" | "canoso" | "rojizo";
    largo: "corto" | "medio" | "largo";
  };
  expresion?: "sonriendo" | "serio" | "mirando-celular" | "riendo";
  vestuario?: { prenda: string; color: string };
  pose?: "de-pie" | "con-celular" | "brazos-cruzados" | "manos-en-bolsillos" | "sentado";
  encuadre: "cuerpo-completo" | "medio-cuerpo" | "detalle" | "mano";
  /** Para objetos, renders 3D o arte tipográfico: descripción del sujeto. */
  sujeto?: string;
  /** Para arte tipográfico: el copy exacto que debe aparecer en la imagen. */
  copy?: string;
  /** Escape hatch de texto libre; aporta su propio token al slug. */
  libre?: string;
};

export type FondoAttrs = {
  tipo: "interior" | "sala" | "exterior" | "muro" | "abstracto";
  estilo: "luminoso" | "calido" | "minimal" | "moderno";
  desenfoque: "nitido" | "suave" | "fuerte";
  /** Elementos que deben aparecer: 'sofa', 'planta', 'ventana', 'ladrillo-blanco'… */
  elementos?: string[];
  libre?: string;
};

export type LayerAttrs = ProtagonistaAttrs | FondoAttrs;

/** Metadatos de una capa generada y guardada en el store. */
export type LayerMeta = {
  hash: string;
  kind: LayerKind;
  slug: string;
  attrs: LayerAttrs;
  prompt: string;
  model: string;
  modelVersion?: string;
  predictionId?: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  /** MIME real del archivo guardado. */
  mime: "image/png" | "image/jpeg" | "image/webp";
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/* Slots de la pieza                                                    */
/* ------------------------------------------------------------------ */

/** Caja en porcentaje del canvas. `h` es opcional: el contenido define la altura. */
export type Box = { x: number; y: number; w: number; h?: number };

/** Un tramo de texto con su propio peso y color; permite "más rápido" en bold + otro color. */
export type Run = { text: string; weight?: Weight; color?: Color };

/**
 * Referencia a una capa de imagen. Se resuelve por `assetHash` si ya está generada, o se
 * genera a partir de `recipe` la primera vez. Los presets usan `recipe`, así son
 * autocontenidos y la generación es perezosa.
 */
export type AssetRef<A extends LayerAttrs> = {
  assetHash?: string;
  recipe?: A;
  /** Modelo preferido para generar la receta. Por defecto lo decide el pipeline. */
  model?: string;
};

export type Fondo =
  | ({
      kind: "asset";
      /** Desenfoque en composición, en cu. 0 = nítido. */
      blurCu?: number;
      /** Punto focal (0–100, 0–100) para `object-position`. */
      focal?: [number, number];
      /** Zoom > 1 para recortar bordes al desenfocar. */
      scale?: number;
    } & AssetRef<FondoAttrs>)
  | { kind: "plano"; color: Color }
  | { kind: "gradiente"; from: Color; to: Color; angle: number; via?: Color };

/**
 * Overlay de marca sobre la foto (regla del brand center): color primario en degradado
 * diagonal, más denso hacia abajo-derecha. `from`/`to` son opacidades 0–1.
 */
export type Overlay = { color: Color; from: number; to: number; angle: number };

export type Protagonista = {
  /** Esquina o borde al que se ancla el recorte. */
  anchor: "bottom-left" | "bottom-right" | "bottom-center" | "center" | "top-center";
  /** Ancho del recorte en % del ancho del canvas. */
  widthPct: number;
  /** Desplazamiento (x, y) en % del canvas, positivo = derecha/abajo. */
  offset: [number, number];
  blend?: "normal" | "multiply" | "screen";
  flip?: boolean;
  /** Opacidad 0–1 (por defecto 1). */
  opacity?: number;
} & AssetRef<ProtagonistaAttrs>;

export type AdScaleStep =
  | "display-2xl"
  | "display-xl"
  | "display-lg"
  | "display-md"
  | "display-sm"
  | "heading"
  | "body-lg"
  | "body"
  | "body-sm"
  | "caption";

export type Titulo = {
  runs: Run[];
  size: AdScaleStep;
  align: "left" | "center" | "right";
  box: Box;
  /** Sobrescribe el line-height de la escala (múltiplo). */
  lineHeight?: number;
  /** Sobrescribe el tracking de la escala, p. ej. "-0.03em". */
  letterSpacing?: string;
  /** Color por defecto de los runs sin color. */
  color?: Color;
};

export type Callout = {
  runs: Run[];
  /** Dónde va el punto blanco, en % del canvas. */
  dot: [number, number];
  /** Dónde va la caja del texto, en % del canvas. */
  box: Box;
  align: "left" | "right" | "center";
  size?: AdScaleStep;
  /** Color del punto y la línea. */
  color?: Color;
};

export type Texto = {
  runs?: Run[];
  /** Cada bullet es una línea con sus propios runs. */
  bullets?: Run[][];
  callouts?: Callout[];
  size: AdScaleStep;
  align: "left" | "center" | "right";
  box: Box;
  lineHeight?: number;
  color?: Color;
};

export type CtaVariant =
  /** Pastilla morada oscura dentro de un contenedor lila redondeado (ref. 4 y 6). */
  | "pastilla-oscura-sobre-lila"
  /** Pastilla morada dentro de un contenedor blanco redondeado (ref. 5). */
  | "pastilla-morada-sobre-blanco"
  /** Pastilla blanca sola, texto morado, con chevron (ref. 3). */
  | "pastilla-blanca"
  /** Badge con gradiente oscuro y texto blanco grande, sin acción (ref. 2 "Habi"). */
  | "badge-gradiente";

export type Cta = {
  label: Run[];
  variant: CtaVariant;
  glyph?: "play" | "chevron-down" | "caret-down" | "arrow-right" | "none";
  box: Box;
  /** Colores opcionales para romper la variante sin crear otra. */
  containerColor?: Color;
  pillColor?: Color;
  textColor?: Color;
  size?: AdScaleStep;
};

export type LogoSlot = "top-center" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "in-cta";
export type LogoFormat = "completo" | "simbolo" | "horizontal";
export type LogoTreatment = "color" | "blanco" | "colorSobreBlanco";

export type Logo = {
  slot: LogoSlot;
  /** Altura en cu. Mínimo 24; recomendado ≥ 80 en canvas de 1080. */
  heightCu: number;
  format?: LogoFormat;
  /** "auto" elige el tratamiento según el fondo real bajo el logo. */
  treatment?: LogoTreatment | "auto";
  /** Margen desde el borde en cu (además del clear space). */
  marginCu?: number;
};

/* ------------------------------------------------------------------ */
/* La pieza                                                             */
/* ------------------------------------------------------------------ */

export type SlotOverrides = Partial<
  Pick<CreativeSpec, "fondo" | "overlay" | "protagonista" | "titulo" | "texto" | "cta" | "logo" | "legal">
>;

export type CreativeSpec = {
  id: string;
  /** 6 caracteres [a-z0-9]; viaja en utm_term. */
  shortId: string;
  /** Nombre humano de la pieza (aparece en la biblioteca). */
  name: string;
  format: Format;
  producto: Producto;
  pais: Pais;

  fondo: Fondo;
  overlay?: Overlay;
  protagonista?: Protagonista;
  titulo?: Titulo;
  texto?: Texto;
  cta?: Cta;
  logo: Logo;
  /** Texto legal pequeño, abajo a la derecha: "*AplicanTyC". */
  legal?: string;

  /** Ajustes por formato: se mezclan sobre el spec base cuando `format` coincide. */
  layouts?: Partial<Record<Format, SlotOverrides>>;

  /** Fuente de la pieza: preset semilla, o armada en la fábrica. */
  origin?: "preset" | "factory";
  presetKey?: string;
  createdAt?: string;
};

/* ------------------------------------------------------------------ */
/* UTM                                                                  */
/* ------------------------------------------------------------------ */

export type UtmSource = "meta" | "google" | "tiktok";

export type Utm = {
  source: UtmSource;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  /** URL completa etiquetada. */
  url: string;
  /** Nombre de archivo sugerido para el PNG (= content). */
  filename: string;
};

/** Un creativo guardado en el registro. */
export type CreativeRecord = {
  spec: CreativeSpec;
  utm: Utm;
  renderUrl?: string;
  createdAt: string;
};

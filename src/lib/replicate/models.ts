/**
 * Modelos de Replicate usados por la fábrica y cómo armar el input de cada uno.
 * Los enums se verificaron contra el schema real de cada modelo (GET /v1/models/...)
 * el 2026-09-07; si Replicate los cambia, cambian aquí.
 */

export const MODELS = {
  generate: {
    /** Rápido y barato. Inputs: prompt, image_input[], aspect_ratio, output_format. */
    fast: "google/nano-banana",
    /** Calidad. Suma resolution, safety_filter_level y allow_fallback_model. */
    quality: "google/nano-banana-pro",
  },
  rmbg: "bria/remove-background",
} as const;

export type GenerateModel = (typeof MODELS.generate)[keyof typeof MODELS.generate];
export type RmbgModel = typeof MODELS.rmbg;

export const DEFAULT_MODEL: GenerateModel = MODELS.generate.quality;

/** Enum real de aspect_ratio; idéntico en nano-banana y nano-banana-pro. */
export const ASPECT_RATIOS = ["match_input_image", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
/** Aspectos válidos cuando se genera desde texto (sin imagen de entrada). */
export type GenAspect = Exclude<AspectRatio, "match_input_image">;

export const OUTPUT_FORMATS = ["jpg", "png"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/** Sólo nano-banana-pro. */
export const PRO_RESOLUTIONS = ["1K", "2K", "4K"] as const;
export type ProResolution = (typeof PRO_RESOLUTIONS)[number];
export const PRO_SAFETY_LEVELS = ["block_low_and_above", "block_medium_and_above", "block_only_high"] as const;
export type ProSafetyLevel = (typeof PRO_SAFETY_LEVELS)[number];

export function isGenerateModel(model: string): model is GenerateModel {
  return model === MODELS.generate.fast || model === MODELS.generate.quality;
}

export function isGenAspect(value: unknown): value is GenAspect {
  return typeof value === "string" && value !== "match_input_image" && (ASPECT_RATIOS as readonly string[]).includes(value);
}

/**
 * Acepta el id completo ("google/nano-banana") o el alias ("fast" | "quality").
 * Sin valor → DEFAULT_MODEL. Desconocido → error, porque no sabríamos armar su input.
 */
export function resolveModel(model?: string | null): GenerateModel {
  if (!model) return DEFAULT_MODEL;
  if (model === "fast" || model === "quality") return MODELS.generate[model];
  if (isGenerateModel(model)) return model;
  throw new Error(`Modelo no soportado: "${model}". Usa "fast", "quality", "${MODELS.generate.fast}" o "${MODELS.generate.quality}".`);
}

export type GenerateInputOptions = {
  prompt: string;
  aspect: GenAspect;
  /** PNG cuando la imagen se compone directo (arte tipográfico); JPG en el resto. */
  wantsPng?: boolean;
  /** URLs de referencia (image_input). Opcional. */
  referenceImages?: string[];
  /** Sólo pro. Por defecto 2K: sobra para canvases de 1080. */
  resolution?: ProResolution;
  /** Sólo pro. Por defecto el más permisivo, que es el default del modelo. */
  safetyFilterLevel?: ProSafetyLevel;
};

/** Arma el input correcto para cada modelo de generación respetando sus enums. */
export function inputFor(model: GenerateModel | string, o: GenerateInputOptions): Record<string, unknown> {
  const resolved = resolveModel(model);
  const output_format: OutputFormat = o.wantsPng ? "png" : "jpg";
  const input: Record<string, unknown> = {
    prompt: o.prompt,
    aspect_ratio: o.aspect,
    output_format,
  };
  if (o.referenceImages && o.referenceImages.length > 0) input.image_input = o.referenceImages;

  if (resolved === MODELS.generate.quality) {
    input.resolution = o.resolution ?? "2K";
    input.safety_filter_level = o.safetyFilterLevel ?? "block_only_high";
    input.allow_fallback_model = false;
  }
  return input;
}

/** Input de bria/remove-background: conserva alfa total y parcial, sin moderación. */
export function rmbgInputFor(imageUrl: string): Record<string, unknown> {
  return {
    image: imageUrl,
    preserve_alpha: true,
    preserve_partial_alpha: true,
    content_moderation: false,
  };
}

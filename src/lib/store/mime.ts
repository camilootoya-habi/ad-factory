import type { LayerMeta } from "@/lib/creative/types";

/** MIME que aceptan las capas. Es el mismo conjunto que `LayerMeta["mime"]`. */
export type LayerMime = LayerMeta["mime"];

export const LAYER_MIMES: readonly LayerMime[] = ["image/png", "image/jpeg", "image/webp"];

const MIME_TO_EXT: Record<LayerMime, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const EXT_TO_MIME: Record<string, LayerMime> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function isLayerMime(value: unknown): value is LayerMime {
  return typeof value === "string" && (LAYER_MIMES as readonly string[]).includes(value);
}

/** Extensión de archivo (sin punto) para un MIME. Desconocido → "png". */
export function extFor(mime: string): "png" | "jpg" | "webp" {
  return isLayerMime(mime) ? MIME_TO_EXT[mime] : "png";
}

/** MIME para una extensión o nombre de archivo ("png", ".PNG", "foto.jpeg"). Desconocido → "image/png". */
export function mimeFor(extOrFilename: string): LayerMime {
  const dot = extOrFilename.lastIndexOf(".");
  const ext = (dot >= 0 ? extOrFilename.slice(dot + 1) : extOrFilename).toLowerCase();
  return EXT_TO_MIME[ext] ?? "image/png";
}

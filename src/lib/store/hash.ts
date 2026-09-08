import { createHash } from "node:crypto";
import type { LayerAttrs } from "@/lib/creative/types";

/** JSON estable: claves ordenadas recursivamente, sin `undefined`. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/**
 * Clave de caché de una capa: sha256(model + prompt + attrs). Determinística: pedir dos
 * veces la misma receta devuelve el mismo hash y no vuelve a gastar crédito de Replicate.
 * Idéntico en los tres drivers del store.
 */
export function hashLayer(input: { model: string; prompt: string; attrs: LayerAttrs }): string {
  return createHash("sha256")
    .update(input.model)
    .update(" ")
    .update(input.prompt)
    .update(" ")
    .update(stableStringify(input.attrs))
    .digest("hex")
    .slice(0, 32);
}

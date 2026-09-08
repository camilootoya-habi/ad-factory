/**
 * Utilidades compartidas por los route handlers de /api/generate/*: lectura segura del
 * JSON y mapeo de errores a { error } con el status correcto.
 *   400 → cuerpo inválido      500 → fallo interno (store, config)
 *   502 → Replicate falló o no se pudo descargar la imagen
 */

import { ReplicateError } from "./client";
import { ValidationError } from "./validate";

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** Devuelve el JSON del body o undefined si no se pudo parsear (el caller responde 400). */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return undefined;
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ValidationError) return jsonError(err.message, 400);
  if (err instanceof ReplicateError) {
    // status 0 = problema local (token ausente, modelo mal escrito): es configuración nuestra.
    return jsonError(err.message, err.status === 0 ? 500 : 502);
  }
  const message = err instanceof Error && err.message ? err.message : "Error interno generando la capa.";
  if (process.env.NODE_ENV !== "production") console.error("[api/generate]", err);
  return jsonError(message, 500);
}

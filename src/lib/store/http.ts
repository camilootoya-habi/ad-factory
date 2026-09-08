/**
 * Helpers compartidos por las rutas /api/asset, /api/layers, /api/creatives y /api/renders.
 * Validan los segmentos dinámicos antes de tocar el store y arman respuestas uniformes.
 */

export const HASH_RE = /^[a-f0-9]{16,64}$/;
/** shortId de creative/ids.ts (6 chars) con holgura para ids de presets tipo "ref001". */
export const SHORT_ID_RE = /^[a-z0-9]{3,32}$/;
/** id de creativo: uuid o "preset-01-grafiti-muro". */
export const CREATIVE_ID_RE = /^[A-Za-z0-9._-]{1,120}$/;
/** Nombre de archivo plano: sin rutas, sin espacios, con extensión de imagen. */
export const FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.(png|jpg|jpeg|webp)$/i;

export function jsonError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return Response.json({ error, ...extra }, { status });
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/**
 * Deja un nombre de archivo utilizable a partir de lo que mande el cliente: quita rutas,
 * reemplaza lo raro por guion y garantiza extensión de imagen (png por defecto).
 */
export function sanitizeFilename(raw: string | undefined | null, fallbackExt = "png"): string {
  const base = (raw ?? "").split(/[\\/]/).pop() ?? "";
  let name = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-._]+/, "").slice(0, 200);
  if (!name) name = `render-${Date.now().toString(36)}`;
  if (!/\.(png|jpg|jpeg|webp)$/i.test(name)) name = `${name.replace(/\.+$/, "")}.${fallbackExt}`;
  return name;
}

/** Atrapa errores del store y responde 500 con mensaje legible, sin filtrar llaves. */
export async function withStoreErrors(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api] error del store:", message);
    return jsonError(500, message);
  }
}

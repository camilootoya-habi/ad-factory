/**
 * Utilidades de bytes compartidas por drivers y rutas. La interfaz del store habla
 * Uint8Array; fs/Supabase trabajan con Buffer/Blob por dentro.
 */

/** Vista sin copia sobre un Buffer (o cualquier vista) como Uint8Array. */
export function asUint8Array(view: ArrayBufferView): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

/**
 * ArrayBuffer exacto para usar como cuerpo de Response/Blob. Sólo copia cuando la vista
 * no cubre su buffer completo (típico en Buffers que salen del pool de Node).
 */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = bytes;
  if (buffer instanceof ArrayBuffer && byteOffset === 0 && byteLength === buffer.byteLength) {
    return buffer;
  }
  const copy = new Uint8Array(byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/** Decodifica un data URL (data:image/png;base64,....). Devuelve null si no es válido. */
export function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const src = dataUrl.trim();
  const comma = src.indexOf(",");
  if (!/^data:/i.test(src) || comma < 0) return null;
  // Cabecera: "<mime>[;param=valor...][;base64]". Se parte a mano: una regex con grupos
  // opcionales se tragaba el ";base64" como parámetro cualquiera.
  const params = src.slice(5, comma).split(";");
  const mime = (params[0] || "application/octet-stream").toLowerCase();
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(mime)) return null;
  const isBase64 = params.slice(1).some((p) => p.trim().toLowerCase() === "base64");
  const payload = src.slice(comma + 1);
  try {
    const buf = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
    return { mime, bytes: asUint8Array(buf) };
  } catch {
    return null;
  }
}

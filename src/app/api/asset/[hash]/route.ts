import { getStore, toArrayBuffer } from "@/lib/store";
import { HASH_RE, jsonError, withStoreErrors } from "@/lib/store/http";

export const runtime = "nodejs";

/** GET /api/asset/<hash> → bytes de la capa con su MIME real. Inmutable: el hash es el contenido. */
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!HASH_RE.test(hash)) return jsonError(400, "hash inválido");

  return withStoreErrors(async () => {
    const layer = await getStore().getLayer(hash);
    if (!layer) return jsonError(404, "capa no encontrada", { hash });

    return new Response(toArrayBuffer(layer.bytes), {
      status: 200,
      headers: {
        "Content-Type": layer.meta.mime,
        "Content-Length": String(layer.bytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Layer-Kind": layer.meta.kind,
      },
    });
  });
}

import { getStore } from "@/lib/store";
import { HASH_RE, json, jsonError, withStoreErrors } from "@/lib/store/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hash: string }> };

/** GET /api/layers/<hash> → LayerMeta (sin bytes; para los bytes está /api/asset/<hash>). */
export async function GET(_req: Request, { params }: Ctx) {
  const { hash } = await params;
  if (!HASH_RE.test(hash)) return jsonError(400, "hash inválido");

  return withStoreErrors(async () => {
    const meta = await getStore().getLayerMeta(hash);
    return meta ? json(meta) : jsonError(404, "capa no encontrada", { hash });
  });
}

/** DELETE /api/layers/<hash> → borra bytes y metadatos. 404 si no existía. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { hash } = await params;
  if (!HASH_RE.test(hash)) return jsonError(400, "hash inválido");

  return withStoreErrors(async () => {
    const store = getStore();
    const meta = await store.getLayerMeta(hash);
    if (!meta) return jsonError(404, "capa no encontrada", { hash });
    await store.deleteLayer(hash);
    return json({ ok: true, hash });
  });
}

import { getStore } from "@/lib/store";
import { CREATIVE_ID_RE, json, jsonError, withStoreErrors } from "@/lib/store/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/creatives/<id> → CreativeRecord. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!CREATIVE_ID_RE.test(id)) return jsonError(400, "id inválido");

  return withStoreErrors(async () => {
    const record = await getStore().getCreative(id);
    return record ? json(record) : jsonError(404, "creativo no encontrado", { id });
  });
}

/** DELETE /api/creatives/<id>. 404 si no existía. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!CREATIVE_ID_RE.test(id)) return jsonError(400, "id inválido");

  return withStoreErrors(async () => {
    const store = getStore();
    const record = await store.getCreative(id);
    if (!record) return jsonError(404, "creativo no encontrado", { id });
    await store.deleteCreative(id);
    return json({ ok: true, id });
  });
}

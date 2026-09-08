import type { NextRequest } from "next/server";
import type { LayerKind } from "@/lib/creative/types";
import { getStore } from "@/lib/store";
import { json, jsonError, withStoreErrors } from "@/lib/store/http";

export const runtime = "nodejs";

const KINDS: readonly LayerKind[] = ["protagonista", "fondo"];

/** GET /api/layers?kind=protagonista|fondo → LayerMeta[] (más nuevas primero). */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("kind");
  if (raw && !(KINDS as readonly string[]).includes(raw)) {
    return jsonError(400, `kind inválido: "${raw}". Usa protagonista | fondo.`);
  }
  const kind = (raw ?? undefined) as LayerKind | undefined;

  return withStoreErrors(async () => json(await getStore().listLayers(kind)));
}

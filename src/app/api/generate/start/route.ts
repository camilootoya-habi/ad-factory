/**
 * POST /api/generate/start
 * body: { kind, attrs, model?, format? }
 * → { status: "done", hash, meta, cached: true }            si la capa ya está en el store
 * → { status: "running", predictionId, stage: "generate", ctx }  si se creó la predicción
 * El cliente guarda `ctx` y lo devuelve en cada /api/generate/poll.
 */

import { errorResponse, jsonError, readJson } from "@/lib/replicate/http";
import { startLayer } from "@/lib/replicate/pipeline";
import { parseLayerRequest } from "@/lib/replicate/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const parsed = parseLayerRequest(body);
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const result = await startLayer(parsed.value);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

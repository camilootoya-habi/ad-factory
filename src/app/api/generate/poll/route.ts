/**
 * POST /api/generate/poll
 * body: { predictionId, stage, ctx }   (tal cual lo devolvió start o el poll anterior)
 * → { status: "running", predictionId, stage, ctx }   sigue; puede cambiar a stage "rmbg"
 * → { status: "done", hash, meta }                    capa descargada y guardada en el store
 * → { status: "error", message, hash }                Replicate falló o canceló (HTTP 200: es
 *                                                     un estado terminal de la máquina)
 */

import { errorResponse, jsonError, readJson } from "@/lib/replicate/http";
import { pollLayer } from "@/lib/replicate/pipeline";
import { parsePollBody } from "@/lib/replicate/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const parsed = parsePollBody(body);
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const result = await pollLayer(parsed.value);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

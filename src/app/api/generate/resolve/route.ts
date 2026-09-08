/**
 * POST /api/generate/resolve
 * body: { items: [{ kind, attrs, model?, format? }] }
 * → { items: [{ hash, exists, meta?, model, prompt, aspect, needsRmbg }] }
 * Resuelve recetas contra el store sin tocar Replicate: no gasta crédito.
 */

import { getStore } from "@/lib/store";
import { errorResponse, jsonError, readJson } from "@/lib/replicate/http";
import { resolveRecipe } from "@/lib/replicate/prompts";
import { parseResolveBody } from "@/lib/replicate/validate";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const parsed = parseResolveBody(body);
    if (!parsed.ok) return jsonError(parsed.error, 400);

    const store = getStore();
    const items = await Promise.all(
      parsed.value.items.map(async (item) => {
        const recipe = resolveRecipe(item);
        const meta = await store.getLayerMeta(recipe.hash);
        return {
          hash: recipe.hash,
          exists: meta !== null,
          meta: meta ?? undefined,
          model: recipe.model,
          prompt: recipe.prompt,
          aspect: recipe.aspect,
          needsRmbg: recipe.needsRmbg,
        };
      }),
    );
    return Response.json({ items });
  } catch (err) {
    return errorResponse(err);
  }
}

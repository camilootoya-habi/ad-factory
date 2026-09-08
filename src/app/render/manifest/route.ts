import { PRESETS } from "@/lib/creative/presets";
import { FORMAT_KEYS } from "@/lib/creative/scale";
import { getStore } from "@/lib/store";

/**
 * GET /render/manifest — lo que el batch (scripts/render.mjs) puede renderizar:
 * presets semilla (id "preset:<key>") y creativos guardados en el store.
 */
export async function GET() {
  const records = await getStore().listCreatives();
  return Response.json(
    {
      formats: FORMAT_KEYS,
      presets: Object.entries(PRESETS).map(([key, spec]) => ({
        id: `preset:${key}`,
        key,
        name: spec.name,
        format: spec.format,
        shortId: spec.shortId,
      })),
      creatives: records.map((r) => ({
        id: r.spec.id,
        name: r.spec.name,
        format: r.spec.format,
        shortId: r.spec.shortId,
        createdAt: r.createdAt,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

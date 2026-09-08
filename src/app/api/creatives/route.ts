import type { CreativeSpec, Utm } from "@/lib/creative/types";
import { FORMAT_KEYS } from "@/lib/creative/scale";
import { getStore } from "@/lib/store";
import { json, jsonError, withStoreErrors } from "@/lib/store/http";

export const runtime = "nodejs";

/** GET /api/creatives → CreativeRecord[] (más nuevos primero). */
export async function GET() {
  return withStoreErrors(async () => json(await getStore().listCreatives()));
}

type PostBody = { spec?: unknown; utm?: unknown; renderUrl?: unknown };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validación mínima: el spec es la fuente de verdad y lo valida el motor; aquí sólo se
 * comprueba que tenga la forma de un CreativeSpec y que el utm sea un objeto con url.
 */
function validate(body: PostBody): { spec: CreativeSpec; utm: Utm; renderUrl?: string } | string {
  if (!isRecord(body.spec)) return "falta `spec` (objeto CreativeSpec)";
  if (!isRecord(body.utm)) return "falta `utm` (objeto Utm)";
  const spec = body.spec;
  if (typeof spec.format !== "string" || !(FORMAT_KEYS as readonly string[]).includes(spec.format)) {
    return `spec.format inválido; usa ${FORMAT_KEYS.join(" | ")}`;
  }
  if (typeof spec.producto !== "string") return "spec.producto es obligatorio";
  if (!isRecord(spec.fondo)) return "spec.fondo es obligatorio";
  if (!isRecord(spec.logo)) return "spec.logo es obligatorio";
  if (typeof body.utm.url !== "string" || typeof body.utm.filename !== "string") {
    return "utm.url y utm.filename son obligatorios";
  }
  if (body.renderUrl !== undefined && typeof body.renderUrl !== "string") return "renderUrl debe ser string";
  return {
    spec: spec as unknown as CreativeSpec,
    utm: body.utm as unknown as Utm,
    renderUrl: body.renderUrl as string | undefined,
  };
}

/** POST /api/creatives  body { spec, utm, renderUrl? } → 201 CreativeRecord. */
export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return jsonError(400, "body JSON inválido");
  }
  const parsed = validate(body ?? {});
  if (typeof parsed === "string") return jsonError(400, parsed);

  return withStoreErrors(async () => {
    const record = await getStore().putCreative(parsed.spec, parsed.utm, parsed.renderUrl);
    return json(record, 201);
  });
}

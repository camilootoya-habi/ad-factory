import { asUint8Array, getStore, parseDataUrl } from "@/lib/store";
import { FILENAME_RE, SHORT_ID_RE, json, jsonError, sanitizeFilename, withStoreErrors } from "@/lib/store/http";

export const runtime = "nodejs";

/** 25 MB: un PNG 1920×1080 sin comprimir ronda los 8 MB; esto deja margen holgado. */
export const MAX_RENDER_BYTES = 25 * 1024 * 1024;

type Ctx = { params: Promise<{ shortId: string }> };

type Incoming = { filename: string; bytes: Uint8Array } | { error: string; status: number };

async function readMultipart(req: Request): Promise<Incoming> {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return { error: "falta el campo `file` en el multipart", status: 400 };
  if (file.size > MAX_RENDER_BYTES) return { error: "archivo demasiado grande (máx. 25 MB)", status: 413 };
  const rawName = typeof form.get("filename") === "string" ? (form.get("filename") as string) : (file as File).name;
  const bytes = asUint8Array(Buffer.from(await file.arrayBuffer()));
  return { filename: sanitizeFilename(rawName), bytes };
}

async function readJsonBody(req: Request): Promise<Incoming> {
  let body: { filename?: unknown; dataUrl?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return { error: "body JSON inválido", status: 400 };
  }
  if (typeof body?.dataUrl !== "string") return { error: "falta `dataUrl` (data:image/png;base64,...)", status: 400 };
  // Estimación previa: base64 infla 4/3, así no decodificamos algo gigante para luego rechazarlo.
  if (body.dataUrl.length > MAX_RENDER_BYTES * 1.37) return { error: "archivo demasiado grande (máx. 25 MB)", status: 413 };
  const parsed = parseDataUrl(body.dataUrl);
  if (!parsed) return { error: "dataUrl inválido", status: 400 };
  if (parsed.bytes.byteLength > MAX_RENDER_BYTES) return { error: "archivo demasiado grande (máx. 25 MB)", status: 413 };
  const filename = sanitizeFilename(typeof body.filename === "string" ? body.filename : undefined);
  return { filename, bytes: parsed.bytes };
}

/**
 * POST /api/renders/<shortId>
 *   multipart/form-data con campo `file` (y opcional `filename`)
 *   o JSON { filename, dataUrl }
 * → { url } por la que se sirve el PNG (ruta local o URL pública de Supabase).
 */
export async function POST(req: Request, { params }: Ctx) {
  const { shortId } = await params;
  if (!SHORT_ID_RE.test(shortId)) return jsonError(400, "shortId inválido");

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_RENDER_BYTES * 1.4) return jsonError(413, "archivo demasiado grande (máx. 25 MB)");

  const contentType = req.headers.get("content-type") ?? "";
  const incoming = contentType.includes("multipart/form-data") ? await readMultipart(req) : await readJsonBody(req);
  if ("error" in incoming) return jsonError(incoming.status, incoming.error);
  if (!FILENAME_RE.test(incoming.filename)) return jsonError(400, "filename inválido");
  if (incoming.bytes.byteLength === 0) return jsonError(400, "archivo vacío");

  return withStoreErrors(async () => {
    const url = await getStore().putRender(shortId, incoming.filename, incoming.bytes);
    return json({ url, shortId, filename: incoming.filename, bytes: incoming.bytes.byteLength }, 201);
  });
}

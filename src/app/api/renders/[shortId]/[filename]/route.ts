import { getStore, mimeFor, toArrayBuffer } from "@/lib/store";
import { FILENAME_RE, SHORT_ID_RE, jsonError, withStoreErrors } from "@/lib/store/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ shortId: string; filename: string }> };

/** GET /api/renders/<shortId>/<filename> → bytes del PNG exportado. */
export async function GET(_req: Request, { params }: Ctx) {
  const { shortId, filename } = await params;
  if (!SHORT_ID_RE.test(shortId)) return jsonError(400, "shortId inválido");
  if (!FILENAME_RE.test(filename)) return jsonError(400, "filename inválido");

  return withStoreErrors(async () => {
    const bytes = await getStore().getRender(shortId, filename);
    if (!bytes) return jsonError(404, "render no encontrado", { shortId, filename });

    return new Response(toArrayBuffer(bytes), {
      status: 200,
      headers: {
        "Content-Type": mimeFor(filename),
        "Content-Length": String(bytes.byteLength),
        // Un re-export con el mismo nombre debe verse pronto: caché corta, no inmutable.
        "Cache-Control": "public, max-age=300",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  });
}

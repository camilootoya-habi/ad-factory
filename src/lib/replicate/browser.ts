/**
 * Cliente de navegador para /api/generate/*. Sin dependencias de servidor: sólo tipos
 * (import type) y fetch. Usable desde componentes client y desde scripts (con baseUrl).
 *
 * El ciclo start → poll → poll… vive aquí: el servidor no guarda nada entre llamadas,
 * el `ctx` que devuelve cada respuesta se reenvía tal cual en la siguiente.
 */

import type { Format, LayerAttrs, LayerKind, LayerMeta } from "@/lib/creative/types";
import type { LayerStage, PollResult, StartResult } from "./pipeline";

export type LayerRequest = {
  kind: LayerKind;
  attrs: LayerAttrs;
  /** "fast" | "quality" | id completo. Por defecto lo decide el servidor (quality). */
  model?: string;
  /** Sólo afecta al fondo (aspecto). */
  format?: Format;
};

export type ProgressStage = "start" | LayerStage | "save";

export type GenerateProgress = {
  stage: ProgressStage;
  elapsedMs: number;
  /** Número de polls hechos hasta ahora (0 en el start). */
  attempt: number;
  predictionId?: string;
};

export type GenerateLayerOptions = {
  onProgress?: (p: GenerateProgress) => void;
  signal?: AbortSignal;
  /** Espera entre polls. Por defecto 2500 ms. */
  intervalMs?: number;
  /** Tope total. Por defecto 240 000 ms (4 min: generación + recorte). */
  timeoutMs?: number;
  /** Prefijo para las rutas; vacío en el navegador, "http://localhost:3000" en scripts. */
  baseUrl?: string;
};

export type ResolvedRecipe = {
  hash: string;
  exists: boolean;
  meta?: LayerMeta;
  model: string;
  prompt: string;
  aspect: string;
  needsRmbg: boolean;
};

function abortError(): Error {
  const e = new Error("Generación cancelada.");
  e.name = "AbortError";
  return e;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw abortError();
    throw new Error(`No se pudo contactar ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Error ${res.status} en ${url}.`;
    throw new Error(message);
  }
  if (data === undefined) throw new Error(`Respuesta vacía o no JSON de ${url}.`);
  return data as T;
}

/**
 * Genera (o recupera de caché) una capa y devuelve su LayerMeta. Lanza Error con mensaje
 * legible ante fallo de Replicate, timeout o cancelación (name === "AbortError").
 */
export async function generateLayer(req: LayerRequest, opts: GenerateLayerOptions = {}): Promise<LayerMeta> {
  const { onProgress, signal, intervalMs = 2500, timeoutMs = 240_000, baseUrl = "" } = opts;
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  let attempt = 0;

  onProgress?.({ stage: "start", elapsedMs: 0, attempt });
  let state: PollResult = await postJson<StartResult>(`${baseUrl}/api/generate/start`, req, signal);

  for (;;) {
    if (state.status === "done") {
      onProgress?.({ stage: "save", elapsedMs: elapsed(), attempt });
      return state.meta;
    }
    if (state.status === "error") throw new Error(state.message);

    if (elapsed() > timeoutMs) {
      throw new Error(`La generación superó ${Math.round(timeoutMs / 1000)} s (etapa "${state.stage}", predicción ${state.predictionId}).`);
    }

    onProgress?.({ stage: state.stage, elapsedMs: elapsed(), attempt, predictionId: state.predictionId });
    await sleep(intervalMs, signal);
    attempt++;

    state = await postJson<PollResult>(
      `${baseUrl}/api/generate/poll`,
      { predictionId: state.predictionId, stage: state.stage, ctx: state.ctx },
      signal,
    );
  }
}

/** Resuelve recetas (hash + si ya existe en el store) sin gastar crédito. Mismo orden que `items`. */
export async function resolveRecipes(
  items: LayerRequest[],
  opts: { signal?: AbortSignal; baseUrl?: string } = {},
): Promise<ResolvedRecipe[]> {
  if (items.length === 0) return [];
  const { signal, baseUrl = "" } = opts;
  const data = await postJson<{ items: ResolvedRecipe[] }>(`${baseUrl}/api/generate/resolve`, { items }, signal);
  return data.items;
}

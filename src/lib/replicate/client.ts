/**
 * Cliente mínimo de la API HTTP de Replicate, sin SDK. Server-only: lee
 * REPLICATE_API_TOKEN del entorno y nunca lo expone; no importarlo desde componentes
 * client (para eso está ./browser.ts).
 *
 * Endpoint oficial por modelo, sin version:
 *   POST /v1/models/{owner}/{name}/predictions   → crea la predicción
 *   GET  /v1/predictions/{id}                    → consulta estado
 */

const API_BASE = "https://api.replicate.com/v1";
/** Reintentos con backoff, sólo ante 429 o 5xx. */
const MAX_RETRIES = 3;

export type PredictionStatus = "starting" | "processing" | "succeeded" | "failed" | "canceled";

export type Prediction = {
  id: string;
  status: PredictionStatus;
  /** URL (string) o lista de URLs según el modelo. Normalizar con firstOutputUrl(). */
  output: string | string[] | null;
  error: string | null;
  model?: string;
  version?: string;
  metrics?: { predict_time?: number; [k: string]: unknown };
  urls?: { get?: string; cancel?: string; stream?: string; web?: string };
  created_at?: string;
  started_at?: string;
  completed_at?: string;
};

export class ReplicateError extends Error {
  /** Código HTTP de Replicate; 0 cuando el fallo es local (token ausente, modelo mal escrito). */
  readonly status: number;
  readonly detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ReplicateError";
    this.status = status;
    this.detail = detail;
  }
}

function apiToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new ReplicateError("Falta REPLICATE_API_TOKEN en el entorno del servidor.", 0);
  return token;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractDetail(body: unknown): string | undefined {
  if (typeof body === "string") return body.slice(0, 300) || undefined;
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  if (typeof b.detail === "string") return b.detail;
  if (typeof b.title === "string") return b.title;
  return undefined;
}

function messageFor(status: number, body: unknown): string {
  const detail = extractDetail(body);
  const tail = detail ? `: ${detail}` : ".";
  switch (status) {
    case 401:
      return "Token de Replicate inválido (401). Revisa REPLICATE_API_TOKEN.";
    case 402:
      return "Sin crédito en Replicate (402). Recarga la cuenta antes de generar.";
    case 404:
      return `Modelo o predicción no encontrada en Replicate (404)${tail}`;
    case 422:
      return `Replicate rechazó el input (422)${tail}`;
    case 429:
      return "Replicate limitó la tasa de peticiones (429). Intenta de nuevo en unos segundos.";
    default:
      if (status >= 500) return `Replicate no está disponible (${status}). Intenta de nuevo.`;
      return `Error de Replicate (${status})${tail}`;
  }
}

/** Backoff exponencial con jitter; respeta Retry-After (segundos) si viene, tope 10 s. */
function backoffMs(attempt: number, retryAfter: string | null): number {
  const base = 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
  const hinted = retryAfter ? Number(retryAfter) * 1000 : 0;
  return Math.min(Math.max(base, Number.isFinite(hinted) ? hinted : 0), 10_000);
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function request<T>(path: string, init: { method: "GET" | "POST"; body?: string }): Promise<T> {
  const token = apiToken();
  let attempt = 0;
  for (;;) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init.method,
      body: init.body,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (res.ok) return (await res.json()) as T;

    const body = await parseBody(res);
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      attempt++;
      await sleep(backoffMs(attempt, res.headers.get("retry-after")));
      continue;
    }
    throw new ReplicateError(messageFor(res.status, body), res.status, body);
  }
}

export type CreatePredictionInput = {
  /** "owner/name", p. ej. "google/nano-banana-pro". */
  model: string;
  input: Record<string, unknown>;
  webhook?: string;
  webhookEvents?: Array<"start" | "output" | "logs" | "completed">;
};

export async function createPrediction({ model, input, webhook, webhookEvents }: CreatePredictionInput): Promise<Prediction> {
  const [owner, name, ...rest] = model.split("/");
  if (!owner || !name || rest.length > 0) {
    throw new ReplicateError(`Modelo inválido: "${model}" (se espera owner/name, sin version).`, 0);
  }
  const body: Record<string, unknown> = { input };
  if (webhook) {
    body.webhook = webhook;
    body.webhook_events_filter = webhookEvents ?? ["completed"];
  }
  return request<Prediction>(`/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getPrediction(id: string): Promise<Prediction> {
  if (!id) throw new ReplicateError("Falta el id de la predicción.", 0);
  return request<Prediction>(`/predictions/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function cancelPrediction(id: string): Promise<Prediction> {
  if (!id) throw new ReplicateError("Falta el id de la predicción.", 0);
  return request<Prediction>(`/predictions/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

export function isTerminal(status: PredictionStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

/** Normaliza `output` (string o string[]) a la primera URL, o null si no hay. */
export function firstOutputUrl(output: unknown): string | null {
  if (typeof output === "string") return output || null;
  if (Array.isArray(output)) {
    const first = output.find((v) => typeof v === "string" && v.length > 0);
    return typeof first === "string" ? first : null;
  }
  return null;
}

export type WaitOptions = { timeoutMs?: number; intervalMs?: number };

/**
 * Espera bloqueante hasta estado terminal. Para scripts locales (scripts/*.mjs); en rutas
 * de Vercel NO: ahí el ciclo lo lleva el cliente vía /api/generate/poll.
 */
export async function waitFor(id: string, { timeoutMs = 240_000, intervalMs = 2000 }: WaitOptions = {}): Promise<Prediction> {
  const started = Date.now();
  for (;;) {
    const prediction = await getPrediction(id);
    if (isTerminal(prediction.status)) return prediction;
    if (Date.now() - started > timeoutMs) {
      throw new ReplicateError(`La predicción ${id} no terminó en ${Math.round(timeoutMs / 1000)} s.`, 0);
    }
    await sleep(intervalMs);
  }
}

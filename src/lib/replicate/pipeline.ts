/**
 * Máquina de estados de generación de una capa, SIN estado en el servidor (Vercel-safe):
 * el cliente recibe `ctx` en cada respuesta y lo devuelve en el siguiente poll.
 *
 *   startLayer  → caché por hash | crea predicción de generación
 *   pollLayer   → running | error | (generate→rmbg si hace falta) | descarga + putLayer → done
 */

import type { Format, LayerAttrs, LayerKind, LayerMeta } from "@/lib/creative/types";
import { getStore } from "@/lib/store";
import { slugFromAttrs } from "@/lib/utm";
import { createPrediction, firstOutputUrl, getPrediction, ReplicateError } from "./client";
import { mimeFromContentType, sniffImage, type ImageInfo } from "./image-info";
import { type GenAspect, type GenerateModel, inputFor, MODELS, rmbgInputFor } from "./models";
import { resolveRecipe } from "./prompts";

export type LayerStage = "generate" | "rmbg";

/** Contexto serializable que viaja al cliente y vuelve en cada poll. */
export type LayerJobCtx = {
  kind: LayerKind;
  attrs: LayerAttrs;
  model: GenerateModel;
  prompt: string;
  hash: string;
  needsRmbg: boolean;
  aspect: GenAspect;
  /** Version del modelo de generación, la reporta Replicate al terminar esa etapa. */
  modelVersion?: string;
};

export type LayerRequest = {
  kind: LayerKind;
  attrs: LayerAttrs;
  model?: string;
  format?: Format;
};

export type RunningResult = { status: "running"; predictionId: string; stage: LayerStage; ctx: LayerJobCtx };
export type DoneResult = { status: "done"; hash: string; meta: LayerMeta; cached?: boolean };
export type ErrorResult = { status: "error"; message: string; hash?: string };

export type StartResult = DoneResult | RunningResult;
export type PollResult = DoneResult | RunningResult | ErrorResult;

export type PollRequest = { predictionId: string; stage: LayerStage; ctx: LayerJobCtx };

export async function startLayer(req: LayerRequest): Promise<StartResult> {
  const recipe = resolveRecipe(req);

  const existing = await getStore().getLayerMeta(recipe.hash);
  if (existing) return { status: "done", hash: recipe.hash, meta: existing, cached: true };

  const input = inputFor(recipe.model, {
    prompt: recipe.prompt,
    aspect: recipe.aspect,
    // PNG sólo cuando la imagen se compone directo (arte tipográfico). Lo que pasa por
    // rmbg sale PNG de bria de todas formas; el fondo va en JPG para no pesar de más.
    wantsPng: recipe.kind === "protagonista" && !recipe.needsRmbg,
  });

  const prediction = await createPrediction({ model: recipe.model, input });

  const ctx: LayerJobCtx = {
    kind: recipe.kind,
    attrs: recipe.attrs,
    model: recipe.model,
    prompt: recipe.prompt,
    hash: recipe.hash,
    needsRmbg: recipe.needsRmbg,
    aspect: recipe.aspect,
  };
  return { status: "running", predictionId: prediction.id, stage: "generate", ctx };
}

export async function pollLayer({ predictionId, stage, ctx }: PollRequest): Promise<PollResult> {
  const prediction = await getPrediction(predictionId);

  if (prediction.status === "starting" || prediction.status === "processing") {
    return { status: "running", predictionId, stage, ctx };
  }

  if (prediction.status === "canceled") {
    return { status: "error", message: "La predicción fue cancelada en Replicate.", hash: ctx.hash };
  }
  if (prediction.status === "failed") {
    const detail = prediction.error?.trim() || "sin detalle";
    return { status: "error", message: `Replicate falló en la etapa "${stage}": ${detail}`, hash: ctx.hash };
  }

  const outputUrl = firstOutputUrl(prediction.output);
  if (!outputUrl) {
    return { status: "error", message: `Replicate terminó la etapa "${stage}" sin devolver imagen.`, hash: ctx.hash };
  }

  if (stage === "generate" && ctx.needsRmbg) {
    const next = await createPrediction({ model: MODELS.rmbg, input: rmbgInputFor(outputUrl) });
    const nextCtx: LayerJobCtx = { ...ctx, modelVersion: prediction.version ?? ctx.modelVersion };
    return { status: "running", predictionId: next.id, stage: "rmbg", ctx: nextCtx };
  }

  const { bytes, info } = await downloadImage(outputUrl);
  const modelVersion = stage === "generate" ? (prediction.version ?? ctx.modelVersion) : ctx.modelVersion;

  const meta: LayerMeta = {
    hash: ctx.hash,
    kind: ctx.kind,
    slug: slugFromAttrs(ctx.kind, ctx.attrs),
    attrs: ctx.attrs,
    prompt: ctx.prompt,
    model: ctx.model,
    modelVersion,
    predictionId,
    width: info.width,
    height: info.height,
    // bria siempre devuelve PNG con alfa; si por lo que sea la cabecera no lo dice, confiamos en la etapa.
    hasAlpha: stage === "rmbg" || info.hasAlpha,
    mime: info.mime,
    createdAt: new Date().toISOString(),
  };

  await getStore().putLayer(ctx.hash, bytes, meta);
  return { status: "done", hash: ctx.hash, meta };
}

async function downloadImage(url: string): Promise<{ bytes: Uint8Array; info: ImageInfo }> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new ReplicateError(`No se pudo descargar la imagen generada (${res.status}).`, 502);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) throw new ReplicateError("La imagen generada llegó vacía.", 502);

  const sniffed = sniffImage(bytes);
  if (sniffed) return { bytes, info: sniffed };

  const mime = mimeFromContentType(res.headers.get("content-type"));
  if (!mime) throw new ReplicateError("Formato de imagen no reconocido (se esperaba PNG, JPEG o WebP).", 502);
  // Cabecera ilegible pero MIME conocido: se guarda con dimensiones desconocidas (0) antes que perder la imagen.
  return { bytes, info: { mime, width: 0, height: 0, hasAlpha: mime === "image/png" } };
}

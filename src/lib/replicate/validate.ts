/**
 * Validación a mano (sin zod) de los cuerpos que llegan a /api/generate/*. Devuelve
 * objetos limpios sólo con las claves conocidas: así el hash no cambia por basura extra
 * y nada raro llega al prompt.
 */

import type { Format, FondoAttrs, LayerAttrs, LayerKind, ProtagonistaAttrs } from "@/lib/creative/types";
import { FORMAT_KEYS } from "@/lib/creative/scale";
import { isGenAspect } from "./models";
import type { LayerJobCtx, LayerRequest, LayerStage, PollRequest } from "./pipeline";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Validation<T> => ({ ok: true, value });
const fail = <T>(error: string): Validation<T> => ({ ok: false, error });

const KINDS = ["protagonista", "fondo"] as const satisfies readonly LayerKind[];
const STAGES = ["generate", "rmbg"] as const satisfies readonly LayerStage[];

const P_TIPO = ["persona", "objeto", "inmueble-3d", "arte-tipografico"] as const;
const P_GENERO = ["mujer", "hombre", "pareja"] as const;
const P_EDAD = ["joven", "adulto", "mayor"] as const;
const P_PIEL = ["blanca", "trigueña", "morena", "negra"] as const;
const P_PELO_COLOR = ["negro", "castano", "rubio", "canoso", "rojizo"] as const;
const P_PELO_LARGO = ["corto", "medio", "largo"] as const;
const P_EXPRESION = ["sonriendo", "serio", "mirando-celular", "riendo"] as const;
const P_POSE = ["de-pie", "con-celular", "brazos-cruzados", "manos-en-bolsillos", "sentado"] as const;
const P_ENCUADRE = ["cuerpo-completo", "medio-cuerpo", "detalle", "mano"] as const;

const F_TIPO = ["interior", "sala", "exterior", "muro", "abstracto"] as const;
const F_ESTILO = ["luminoso", "calido", "minimal", "moderno"] as const;
const F_DESENFOQUE = ["nitido", "suave", "fuerte"] as const;

const MAX_TEXT = 1200;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

/** String opcional, recortado y con tope de largo; undefined si viene vacío o ausente. */
function optText(v: unknown, path: string): { value?: string; error?: string } {
  if (v === undefined || v === null) return {};
  if (typeof v !== "string") return { error: `${path} debe ser texto.` };
  const t = v.trim();
  if (!t) return {};
  if (t.length > MAX_TEXT) return { error: `${path} supera ${MAX_TEXT} caracteres.` };
  return { value: t };
}

function parseProtagonistaAttrs(raw: unknown, path: string): Validation<ProtagonistaAttrs> {
  if (!isRecord(raw)) return fail(`${path} debe ser un objeto.`);
  if (!oneOf(raw.tipo, P_TIPO)) return fail(`${path}.tipo debe ser uno de: ${P_TIPO.join(", ")}.`);
  if (!oneOf(raw.encuadre, P_ENCUADRE)) return fail(`${path}.encuadre debe ser uno de: ${P_ENCUADRE.join(", ")}.`);

  const out: ProtagonistaAttrs = { tipo: raw.tipo, encuadre: raw.encuadre };

  if (raw.genero !== undefined) {
    if (!oneOf(raw.genero, P_GENERO)) return fail(`${path}.genero inválido.`);
    out.genero = raw.genero;
  }
  if (raw.edad !== undefined) {
    if (!oneOf(raw.edad, P_EDAD)) return fail(`${path}.edad inválida.`);
    out.edad = raw.edad;
  }
  if (raw.piel !== undefined) {
    if (!oneOf(raw.piel, P_PIEL)) return fail(`${path}.piel inválida.`);
    out.piel = raw.piel;
  }
  if (raw.pelo !== undefined) {
    if (!isRecord(raw.pelo) || !oneOf(raw.pelo.color, P_PELO_COLOR) || !oneOf(raw.pelo.largo, P_PELO_LARGO)) {
      return fail(`${path}.pelo debe ser { color, largo } con valores válidos.`);
    }
    out.pelo = { color: raw.pelo.color, largo: raw.pelo.largo };
  }
  if (raw.expresion !== undefined) {
    if (!oneOf(raw.expresion, P_EXPRESION)) return fail(`${path}.expresion inválida.`);
    out.expresion = raw.expresion;
  }
  if (raw.vestuario !== undefined) {
    if (!isRecord(raw.vestuario)) return fail(`${path}.vestuario debe ser { prenda, color }.`);
    const prenda = optText(raw.vestuario.prenda, `${path}.vestuario.prenda`);
    const color = optText(raw.vestuario.color, `${path}.vestuario.color`);
    if (prenda.error || color.error) return fail(prenda.error ?? color.error ?? "vestuario inválido");
    if (!prenda.value || !color.value) return fail(`${path}.vestuario requiere prenda y color.`);
    out.vestuario = { prenda: prenda.value, color: color.value };
  }
  if (raw.pose !== undefined) {
    if (!oneOf(raw.pose, P_POSE)) return fail(`${path}.pose inválida.`);
    out.pose = raw.pose;
  }

  for (const key of ["sujeto", "copy", "libre"] as const) {
    const r = optText(raw[key], `${path}.${key}`);
    if (r.error) return fail(r.error);
    if (r.value !== undefined) out[key] = r.value;
  }

  if (out.tipo === "arte-tipografico" && !out.copy) return fail(`${path}.copy es obligatorio para arte-tipografico.`);
  if ((out.tipo === "objeto" || out.tipo === "inmueble-3d") && !out.sujeto && !out.libre) {
    return fail(`${path}.sujeto (o libre) es obligatorio para ${out.tipo}.`);
  }
  return ok(out);
}

function parseFondoAttrs(raw: unknown, path: string): Validation<FondoAttrs> {
  if (!isRecord(raw)) return fail(`${path} debe ser un objeto.`);
  if (!oneOf(raw.tipo, F_TIPO)) return fail(`${path}.tipo debe ser uno de: ${F_TIPO.join(", ")}.`);
  if (!oneOf(raw.estilo, F_ESTILO)) return fail(`${path}.estilo debe ser uno de: ${F_ESTILO.join(", ")}.`);
  if (!oneOf(raw.desenfoque, F_DESENFOQUE)) return fail(`${path}.desenfoque debe ser uno de: ${F_DESENFOQUE.join(", ")}.`);

  const out: FondoAttrs = { tipo: raw.tipo, estilo: raw.estilo, desenfoque: raw.desenfoque };

  if (raw.elementos !== undefined) {
    if (!Array.isArray(raw.elementos) || raw.elementos.length > 30) return fail(`${path}.elementos debe ser una lista corta de textos.`);
    const items: string[] = [];
    for (const e of raw.elementos) {
      const r = optText(e, `${path}.elementos[]`);
      if (r.error) return fail(r.error);
      if (r.value) items.push(r.value);
    }
    if (items.length > 0) out.elementos = items;
  }
  const libre = optText(raw.libre, `${path}.libre`);
  if (libre.error) return fail(libre.error);
  if (libre.value !== undefined) out.libre = libre.value;

  return ok(out);
}

export function parseAttrs(kind: LayerKind, raw: unknown, path = "attrs"): Validation<LayerAttrs> {
  return kind === "protagonista" ? parseProtagonistaAttrs(raw, path) : parseFondoAttrs(raw, path);
}

/** Cuerpo de /api/generate/start y cada item de /api/generate/resolve. */
export function parseLayerRequest(raw: unknown, path = "body"): Validation<LayerRequest> {
  if (!isRecord(raw)) return fail(`${path} debe ser un objeto JSON.`);
  if (!oneOf(raw.kind, KINDS)) return fail(`${path}.kind debe ser "protagonista" o "fondo".`);

  const attrs = parseAttrs(raw.kind, raw.attrs, `${path}.attrs`);
  if (!attrs.ok) return fail(attrs.error);

  const out: LayerRequest = { kind: raw.kind, attrs: attrs.value };

  if (raw.model !== undefined && raw.model !== null) {
    if (typeof raw.model !== "string" || !raw.model.trim()) return fail(`${path}.model debe ser texto.`);
    out.model = raw.model.trim();
  }
  if (raw.format !== undefined && raw.format !== null) {
    if (!oneOf(raw.format, FORMAT_KEYS as readonly Format[])) return fail(`${path}.format debe ser uno de: ${FORMAT_KEYS.join(", ")}.`);
    out.format = raw.format;
  }
  return ok(out);
}

export function parseResolveBody(raw: unknown): Validation<{ items: LayerRequest[] }> {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return fail("body.items debe ser una lista.");
  if (raw.items.length === 0) return ok({ items: [] });
  if (raw.items.length > 100) return fail("body.items admite máximo 100 recetas por llamada.");
  const items: LayerRequest[] = [];
  for (let i = 0; i < raw.items.length; i++) {
    const r = parseLayerRequest(raw.items[i], `items[${i}]`);
    if (!r.ok) return fail(r.error);
    items.push(r.value);
  }
  return ok({ items });
}

function parseCtx(raw: unknown, path: string): Validation<LayerJobCtx> {
  if (!isRecord(raw)) return fail(`${path} debe ser un objeto.`);
  if (!oneOf(raw.kind, KINDS)) return fail(`${path}.kind inválido.`);
  const attrs = parseAttrs(raw.kind, raw.attrs, `${path}.attrs`);
  if (!attrs.ok) return fail(attrs.error);
  if (typeof raw.model !== "string" || !raw.model) return fail(`${path}.model requerido.`);
  if (typeof raw.prompt !== "string" || !raw.prompt) return fail(`${path}.prompt requerido.`);
  if (typeof raw.hash !== "string" || !/^[a-f0-9]{16,64}$/.test(raw.hash)) return fail(`${path}.hash inválido.`);
  if (typeof raw.needsRmbg !== "boolean") return fail(`${path}.needsRmbg debe ser booleano.`);
  if (!isGenAspect(raw.aspect)) return fail(`${path}.aspect inválido.`);
  if (raw.modelVersion !== undefined && typeof raw.modelVersion !== "string") return fail(`${path}.modelVersion debe ser texto.`);

  // El tipo GenerateModel se valida en resolveModel al reusar el ctx; aquí basta con que sea texto.
  const ctx: LayerJobCtx = {
    kind: raw.kind,
    attrs: attrs.value,
    model: raw.model as LayerJobCtx["model"],
    prompt: raw.prompt,
    hash: raw.hash,
    needsRmbg: raw.needsRmbg,
    aspect: raw.aspect,
  };
  if (typeof raw.modelVersion === "string") ctx.modelVersion = raw.modelVersion;
  return ok(ctx);
}

/** Cuerpo de /api/generate/poll. */
export function parsePollBody(raw: unknown): Validation<PollRequest> {
  if (!isRecord(raw)) return fail("body debe ser un objeto JSON.");
  if (typeof raw.predictionId !== "string" || !/^[A-Za-z0-9_-]{6,128}$/.test(raw.predictionId)) {
    return fail("body.predictionId inválido.");
  }
  if (!oneOf(raw.stage, STAGES)) return fail(`body.stage debe ser "generate" o "rmbg".`);
  const ctx = parseCtx(raw.ctx, "body.ctx");
  if (!ctx.ok) return fail(ctx.error);
  return ok({ predictionId: raw.predictionId, stage: raw.stage, ctx: ctx.value });
}

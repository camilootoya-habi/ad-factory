import type { CreativeSpec, FondoAttrs, Format, ProtagonistaAttrs, SlotOverrides } from "./types";

/**
 * Spec con el formato ya aplicado: `layouts[format]` mezclado sobre los slots del base.
 * Es lo único que consume el motor de composición; nunca vuelve a mirar `layouts`.
 */
export type ResolvedSpec = Omit<CreativeSpec, "layouts"> & { format: Format; layouts?: never };

const SLOT_KEYS = ["fondo", "overlay", "protagonista", "titulo", "texto", "cta", "logo", "legal"] as const satisfies readonly (keyof SlotOverrides)[];

type Dict = Record<string, unknown>;

function isPlainObject(v: unknown): v is Dict {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Copia sin las claves con valor `undefined` (los presets traen `recipe: undefined`). */
function stripUndefined(o: Dict): Dict {
  const out: Dict = {};
  for (const k of Object.keys(o)) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

/**
 * Merge superficial de un slot: las claves definidas del override pisan al base, las
 * `undefined` se ignoran. Si el override cambia el `kind` del slot (p. ej. fondo asset →
 * plano) se toma entero, porque las claves del base ya no aplican.
 */
function mergeSlot(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!isPlainObject(override)) return override; // primitivos, p. ej. `legal`
  const cleaned = stripUndefined(override);
  if (Object.keys(cleaned).length === 0) return base;
  if (!isPlainObject(base)) return cleaned;
  if ("kind" in cleaned && "kind" in base && cleaned.kind !== base.kind) return cleaned;
  return { ...base, ...cleaned };
}

/** Aplica `format` (o el del spec) y mezcla `layouts[format]` slot por slot. */
export function resolveSpec(spec: CreativeSpec, format?: Format): ResolvedSpec {
  const fmt = format ?? spec.format;
  const { layouts, ...rest } = spec;
  const overrides = layouts?.[fmt];
  const out: Dict = { ...rest, format: fmt };
  if (overrides) {
    for (const key of SLOT_KEYS) {
      if (key in overrides) out[key] = mergeSlot((rest as Dict)[key], (overrides as Dict)[key]);
    }
  }
  return out as ResolvedSpec;
}

export type AssetNeed<A> = { assetHash?: string; recipe?: A; model?: string };

/** Capas de imagen que la pieza necesita para renderizarse sin placeholders. */
export type AssetNeeds = {
  fondo?: AssetNeed<FondoAttrs>;
  protagonista?: AssetNeed<ProtagonistaAttrs>;
};

/**
 * Qué capas de imagen pide la pieza. Acepta el spec crudo o ya resuelto; para un formato
 * concreto conviene pasar `resolveSpec(spec, format)`, porque un layout puede cambiar la receta.
 */
export function assetHashesOf(spec: CreativeSpec | ResolvedSpec): AssetNeeds {
  const out: AssetNeeds = {};
  if (spec.fondo.kind === "asset") {
    const { assetHash, recipe, model } = spec.fondo;
    out.fondo = { assetHash, recipe, model };
  }
  if (spec.protagonista) {
    const { assetHash, recipe, model } = spec.protagonista;
    out.protagonista = { assetHash, recipe, model };
  }
  return out;
}

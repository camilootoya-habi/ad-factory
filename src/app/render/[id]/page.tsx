import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Creative, type CreativeAssets } from "@/components/creative";
import { PRESETS } from "@/lib/creative/presets";
import { assetHashesOf, resolveSpec, type AssetNeed, type ResolvedSpec } from "@/lib/creative/resolve";
import { FORMATS } from "@/lib/creative/scale";
import type { CreativeSpec, Format, LayerAttrs, LayerKind, LayerMeta, Utm } from "@/lib/creative/types";
import { isFondoAttrs, isProtagonistaAttrs, resolveRecipe } from "@/lib/replicate/prompts";
import { getStore } from "@/lib/store";
import { buildUtm } from "@/lib/utm";

/**
 * Ruta DESNUDA para el batch de Chrome (scripts/render.mjs) y para inspección:
 *
 *   /render/preset:<key>[?format=4x5&date=2026-09-07]   → PRESETS[key]
 *   /render/<creativeId>[?format=…&date=…]               → getStore().getCreative(id).spec
 *
 * Monta un solo <Creative> a tamaño real, sin CanvasFit. El propio Creative marca
 * data-creative-ready="true" cuando sus imágenes y fuentes cargaron; el wrapper añade
 * data-missing-assets="true" si alguna capa de imagen no existe aún en el store (se dibuja
 * placeholder). El nombre del PNG (utm_content) viaja en <meta name="ad-factory:filename">.
 *
 * `date` fija la campaña de la UTM (yymm) para que un batch sea reproducible; sin ella se
 * usa la fecha del servidor.
 */

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type PageProps = { params: Params; searchParams: SearchParams };

type ResolvedAsset = {
  url?: string;
  hash?: string;
  meta?: LayerMeta;
  missing: boolean;
};

type RenderView = {
  spec: CreativeSpec;
  resolved: ResolvedSpec;
  format: Format;
  assets: CreativeAssets;
  missing: boolean;
  utm: Utm;
  source: "preset" | "creative";
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function isFormat(v: string): v is Format {
  return v in FORMATS;
}

/** `YYYY-MM-DD` → medianoche UTC; cualquier otra cosa → ahora. */
function dateFrom(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

async function loadSpec(rawId: string): Promise<{ spec: CreativeSpec; source: RenderView["source"] } | null> {
  const id = safeDecode(rawId);
  if (id.startsWith("preset:")) {
    const spec = PRESETS[id.slice("preset:".length)];
    return spec ? { spec, source: "preset" } : null;
  }
  const record = await getStore().getCreative(id);
  return record ? { spec: record.spec, source: "creative" } : null;
}

/**
 * URL de una capa: con assetHash se sirve del store; con receta se calcula el hash
 * (determinístico, sin tocar Replicate) y se busca. Si no existe, queda sin URL (placeholder).
 */
async function resolveAsset(kind: LayerKind, need: AssetNeed<LayerAttrs> | undefined, format: Format): Promise<ResolvedAsset | undefined> {
  if (!need) return undefined;
  let hash = need.assetHash;
  if (!hash && need.recipe) {
    try {
      hash = resolveRecipe({ kind, attrs: need.recipe, model: need.model, format }).hash;
    } catch {
      hash = undefined; // receta inválida: se trata como capa faltante
    }
  }
  if (!hash) return { missing: true };
  const meta = await getStore().getLayerMeta(hash);
  if (!meta) return { hash, missing: true };
  return { url: `/api/asset/${hash}`, hash, meta, missing: false };
}

/** Una sola resolución por request, compartida entre generateMetadata y la página. */
const loadView = cache(async (rawId: string, formatParam: string | undefined, dateParam: string | undefined): Promise<RenderView | null> => {
  const loaded = await loadSpec(rawId);
  if (!loaded) return null;
  if (formatParam !== undefined && !isFormat(formatParam)) return null;

  const format: Format = formatParam ?? loaded.spec.format;
  const resolved = resolveSpec(loaded.spec, format);
  const needs = assetHashesOf(resolved);
  const [fondo, protagonista] = await Promise.all([
    resolveAsset("fondo", needs.fondo, format),
    resolveAsset("protagonista", needs.protagonista, format),
  ]);

  // Capas traídas por hash (sin receta en el spec): la UTM describe lo que hay en la imagen
  // a partir de los attrs guardados en el store.
  const protAttrs = protagonista?.meta?.attrs;
  const fondoAttrs = fondo?.meta?.attrs;
  const utm = buildUtm(resolved, {
    date: dateFrom(dateParam),
    protagonistaAttrs: protAttrs && isProtagonistaAttrs(protAttrs) ? protAttrs : undefined,
    fondoAttrs: fondoAttrs && isFondoAttrs(fondoAttrs) ? fondoAttrs : undefined,
  });

  return {
    spec: loaded.spec,
    resolved,
    format,
    assets: { fondo: fondo?.url, protagonista: protagonista?.url },
    missing: Boolean(fondo?.missing || protagonista?.missing),
    utm,
    source: loaded.source,
  };
});

async function viewFrom(props: PageProps): Promise<RenderView | null> {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  return loadView(id, first(sp.format), first(sp.date));
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const view = await viewFrom(props);
  if (!view) return {};
  return {
    title: `${view.spec.name} · ${view.format}`,
    other: {
      "ad-factory:filename": view.utm.filename,
      "ad-factory:utm-content": view.utm.content,
      "ad-factory:utm-url": view.utm.url,
      "ad-factory:format": view.format,
      "ad-factory:short-id": view.spec.shortId,
      "ad-factory:missing-assets": view.missing ? "true" : "false",
    },
  };
}

export default async function RenderPage(props: PageProps) {
  const view = await viewFrom(props);
  if (!view) notFound();

  const { w, h } = FORMATS[view.format];
  return (
    <div
      data-render-root=""
      data-source={view.source}
      data-format={view.format}
      data-filename={view.utm.filename}
      data-missing-assets={view.missing ? "true" : "false"}
      style={{ position: "relative", width: w, height: h, overflow: "hidden", flex: "none" }}
    >
      <Creative spec={view.spec} format={view.format} assets={view.assets} />
    </div>
  );
}

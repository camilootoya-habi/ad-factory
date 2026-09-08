import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CreativeRecord, CreativeSpec, Format, LayerAttrs, LayerKind, LayerMeta, Pais, Producto, Utm } from "@/lib/creative/types";
import type { Store } from "./types";
import { asUint8Array } from "./bytes";
import { extFor, isLayerMime, mimeFor } from "./mime";
import { buildCreativeRecord } from "./record";

/**
 * Driver Supabase (Storage + Postgres). Usa la SECRET key desde el servidor: nunca se
 * importa desde un Client Component ni se expone en NEXT_PUBLIC_.
 *
 * DDL esperado (el mismo va en TODO.md). Ejecutar en el SQL editor del proyecto:
 *
 *   -- Capas generadas por Replicate. hash = sha256(model + prompt + attrs), ver store/hash.ts
 *   create table if not exists public.assets (
 *     hash          text primary key,
 *     kind          text not null check (kind in ('protagonista', 'fondo')),
 *     slug          text not null,
 *     attrs         jsonb not null default '{}'::jsonb,
 *     prompt        text not null,
 *     model         text not null,
 *     model_version text,
 *     prediction_id text,
 *     storage_path  text not null,                 -- '<hash>.<png|jpg|webp>' dentro del bucket layers
 *     width         integer not null,
 *     height        integer not null,
 *     has_alpha     boolean not null default false,
 *     mime          text not null,
 *     created_at    timestamptz not null default now()
 *   );
 *   create index if not exists assets_kind_created_idx on public.assets (kind, created_at desc);
 *
 *   -- Creativos guardados (spec + utm completos en jsonb; columnas sueltas sólo para filtrar)
 *   create table if not exists public.creatives (
 *     id          text primary key,
 *     short_id    text not null,
 *     format      text not null,
 *     producto    text not null,
 *     pais        text not null,
 *     spec        jsonb not null,
 *     utm         jsonb not null,
 *     render_path text,                             -- URL pública del PNG exportado (o null)
 *     created_at  timestamptz not null default now()
 *   );
 *   create index if not exists creatives_created_idx on public.creatives (created_at desc);
 *
 *   -- La secret key salta RLS; con RLS activo y sin políticas las tablas quedan cerradas al browser.
 *   alter table public.assets enable row level security;
 *   alter table public.creatives enable row level security;
 *
 *   -- Buckets. 'layers' privado (se sirve por /api/asset/<hash>); 'renders' público
 *   -- porque putRender devuelve la URL pública directa.
 *   insert into storage.buckets (id, name, public) values ('layers', 'layers', false) on conflict (id) do nothing;
 *   insert into storage.buckets (id, name, public) values ('renders', 'renders', true) on conflict (id) do nothing;
 */

export const LAYERS_BUCKET = "layers";
export const RENDERS_BUCKET = "renders";

/* ---------------------------------- filas ---------------------------------- */

type AssetRow = {
  hash: string;
  kind: string;
  slug: string;
  attrs: LayerAttrs;
  prompt: string;
  model: string;
  model_version: string | null;
  prediction_id: string | null;
  storage_path: string;
  width: number;
  height: number;
  has_alpha: boolean;
  mime: string;
  created_at: string;
};

type CreativeRow = {
  id: string;
  short_id: string;
  format: string;
  producto: string;
  pais: string;
  spec: CreativeSpec;
  utm: Utm;
  render_path: string | null;
  created_at: string;
};

/** Esquema mínimo tipado a mano; si algún día se generan tipos con la CLI, reemplazar. */
export type Database = {
  public: {
    Tables: {
      assets: { Row: AssetRow; Insert: AssetRow; Update: Partial<AssetRow>; Relationships: [] };
      creatives: { Row: CreativeRow; Insert: CreativeRow; Update: Partial<CreativeRow>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type Client = SupabaseClient<Database>;

/* -------------------------------- mapeo ------------------------------------ */

function isoDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

function rowToMeta(row: AssetRow): LayerMeta {
  const meta: LayerMeta = {
    hash: row.hash,
    kind: row.kind as LayerKind,
    slug: row.slug,
    attrs: row.attrs,
    prompt: row.prompt,
    model: row.model,
    width: row.width,
    height: row.height,
    hasAlpha: row.has_alpha,
    mime: isLayerMime(row.mime) ? row.mime : mimeFor(row.storage_path),
    createdAt: isoDate(row.created_at),
  };
  if (row.model_version) meta.modelVersion = row.model_version;
  if (row.prediction_id) meta.predictionId = row.prediction_id;
  return meta;
}

function metaToRow(hash: string, meta: LayerMeta, storagePath: string): AssetRow {
  return {
    hash,
    kind: meta.kind,
    slug: meta.slug,
    attrs: meta.attrs,
    prompt: meta.prompt,
    model: meta.model,
    model_version: meta.modelVersion ?? null,
    prediction_id: meta.predictionId ?? null,
    storage_path: storagePath,
    width: meta.width,
    height: meta.height,
    has_alpha: meta.hasAlpha,
    mime: meta.mime,
    created_at: meta.createdAt ?? new Date().toISOString(),
  };
}

function rowToCreative(row: CreativeRow): CreativeRecord {
  const spec: CreativeSpec = {
    ...row.spec,
    id: row.spec.id ?? row.id,
    shortId: row.spec.shortId ?? row.short_id,
    format: (row.spec.format ?? row.format) as Format,
    producto: (row.spec.producto ?? row.producto) as Producto,
    pais: (row.spec.pais ?? row.pais) as Pais,
  };
  const record: CreativeRecord = { spec, utm: row.utm, createdAt: isoDate(row.created_at) };
  if (row.render_path) record.renderUrl = row.render_path;
  return record;
}

function creativeToRow(record: CreativeRecord): CreativeRow {
  return {
    id: record.spec.id,
    short_id: record.spec.shortId,
    format: record.spec.format,
    producto: record.spec.producto,
    pais: record.spec.pais,
    spec: record.spec,
    utm: record.utm,
    render_path: record.renderUrl ?? null,
    created_at: record.createdAt,
  };
}

/* -------------------------------- errores ---------------------------------- */

function fail(where: string, error: { message: string } | null): never {
  throw new Error(`[store:supabase] ${where}: ${error?.message ?? "error desconocido"}`);
}

/** Supabase Storage responde 400/404 "Object not found" cuando el objeto no existe. */
function isNotFound(error: { message?: string; statusCode?: string | number; status?: number } | null): boolean {
  if (!error) return false;
  const code = String(error.statusCode ?? error.status ?? "");
  return code === "404" || code === "400" || /not[_ ]found/i.test(error.message ?? "");
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return asUint8Array(Buffer.from(await blob.arrayBuffer()));
}

/* -------------------------------- driver ----------------------------------- */

export function supabaseDriver(env: { url?: string; secretKey?: string } = {}): Store {
  const url = env.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.secretKey ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("STORE_DRIVER=supabase pero faltan llaves. Sigue TODO.md (sección Variables de entorno).");
  }

  const client: Client = createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const layers = () => client.storage.from(LAYERS_BUCKET);
  const renders = () => client.storage.from(RENDERS_BUCKET);

  async function fetchAssetRow(hash: string): Promise<AssetRow | null> {
    const { data, error } = await client.from("assets").select("*").eq("hash", hash).maybeSingle();
    if (error) fail(`getLayerMeta(${hash})`, error);
    return data ?? null;
  }

  return {
    name: "supabase",

    async putLayer(hash, bytes, meta) {
      const storagePath = `${hash}.${extFor(meta.mime)}`;
      const { error: upErr } = await layers().upload(storagePath, bytes, {
        contentType: meta.mime,
        upsert: true,
        cacheControl: "31536000",
      });
      if (upErr) fail(`putLayer upload(${storagePath})`, upErr);

      const row = metaToRow(hash, meta, storagePath);
      const { error: dbErr } = await client.from("assets").upsert(row, { onConflict: "hash" });
      if (dbErr) fail(`putLayer upsert(${hash})`, dbErr);
    },

    async getLayer(hash) {
      const row = await fetchAssetRow(hash);
      if (!row) return null;
      const { data, error } = await layers().download(row.storage_path);
      if (error) {
        if (isNotFound(error)) return null;
        fail(`getLayer download(${row.storage_path})`, error);
      }
      if (!data) return null;
      return { bytes: await blobToBytes(data), meta: rowToMeta(row) };
    },

    async getLayerMeta(hash) {
      const row = await fetchAssetRow(hash);
      return row ? rowToMeta(row) : null;
    },

    async listLayers(kind?: LayerKind) {
      let query = client.from("assets").select("*").order("created_at", { ascending: false });
      if (kind) query = query.eq("kind", kind);
      const { data, error } = await query;
      if (error) fail("listLayers", error);
      return (data ?? []).map(rowToMeta);
    },

    async deleteLayer(hash) {
      const row = await fetchAssetRow(hash);
      if (row) {
        const { error: stErr } = await layers().remove([row.storage_path]);
        if (stErr && !isNotFound(stErr)) fail(`deleteLayer remove(${row.storage_path})`, stErr);
      }
      const { error } = await client.from("assets").delete().eq("hash", hash);
      if (error) fail(`deleteLayer(${hash})`, error);
    },

    async putRender(shortId, filename, bytes) {
      const storagePath = `${shortId}/${filename}`;
      const { error } = await renders().upload(storagePath, bytes, {
        contentType: mimeFor(filename),
        upsert: true,
        cacheControl: "3600",
      });
      if (error) fail(`putRender upload(${storagePath})`, error);
      return renders().getPublicUrl(storagePath).data.publicUrl;
    },

    async getRender(shortId, filename) {
      const { data, error } = await renders().download(`${shortId}/${filename}`);
      if (error) {
        if (isNotFound(error)) return null;
        fail(`getRender(${shortId}/${filename})`, error);
      }
      return data ? blobToBytes(data) : null;
    },

    async putCreative(spec: CreativeSpec, utm: Utm, renderUrl?: string) {
      const record = buildCreativeRecord(spec, utm, renderUrl);
      const { error } = await client.from("creatives").upsert(creativeToRow(record), { onConflict: "id" });
      if (error) fail(`putCreative(${record.spec.id})`, error);
      return record;
    },

    async getCreative(id) {
      const { data, error } = await client.from("creatives").select("*").eq("id", id).maybeSingle();
      if (error) fail(`getCreative(${id})`, error);
      return data ? rowToCreative(data) : null;
    },

    async listCreatives() {
      const { data, error } = await client
        .from("creatives")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) fail("listCreatives", error);
      return (data ?? []).map(rowToCreative);
    },

    async deleteCreative(id) {
      const { error } = await client.from("creatives").delete().eq("id", id);
      if (error) fail(`deleteCreative(${id})`, error);
    },
  };
}

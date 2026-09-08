import type { CreativeRecord, CreativeSpec, LayerKind, LayerMeta, Utm } from "@/lib/creative/types";

/**
 * Contrato único de persistencia. Tres drivers detrás del flag STORE_DRIVER:
 *   fs        → dev y local (.ad-factory-cache/)          [default]
 *   memory    → Vercel sin Supabase (FS de sólo lectura)
 *   supabase  → cuando el admin cree buckets y ponga llaves (ver TODO.md)
 *
 * La interfaz es deliberadamente chica para que el driver de Supabase no invente nada.
 * El hash de una capa es sha256(model + prompt + attrs) y es el mismo en los tres
 * drivers: migrar es copiar archivos, no regenerar.
 */
export interface Store {
  readonly name: "fs" | "memory" | "supabase";

  putLayer(hash: string, bytes: Uint8Array, meta: LayerMeta): Promise<void>;
  getLayer(hash: string): Promise<{ bytes: Uint8Array; meta: LayerMeta } | null>;
  getLayerMeta(hash: string): Promise<LayerMeta | null>;
  listLayers(kind?: LayerKind): Promise<LayerMeta[]>;
  deleteLayer(hash: string): Promise<void>;

  /** Guarda un PNG exportado. Devuelve la URL/ruta pública por la que se puede servir. */
  putRender(shortId: string, filename: string, bytes: Uint8Array): Promise<string>;
  getRender(shortId: string, filename: string): Promise<Uint8Array | null>;

  putCreative(spec: CreativeSpec, utm: Utm, renderUrl?: string): Promise<CreativeRecord>;
  getCreative(id: string): Promise<CreativeRecord | null>;
  listCreatives(): Promise<CreativeRecord[]>;
  deleteCreative(id: string): Promise<void>;
}

export type StoreDriverName = Store["name"];

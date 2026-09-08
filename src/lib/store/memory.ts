import type { CreativeRecord, CreativeSpec, LayerKind, LayerMeta, Utm } from "@/lib/creative/types";
import type { Store } from "./types";
import { buildCreativeRecord, byCreatedAtDesc } from "./record";

/**
 * Driver en memoria: Vercel sin Supabase (el FS de las funciones es de sólo lectura) y
 * pruebas. Misma semántica que fs, pero todo vive en el proceso y se pierde al reiniciar
 * o al saltar a otra instancia.
 */

const layers = new Map<string, { bytes: Uint8Array; meta: LayerMeta }>();
const renders = new Map<string, Uint8Array>();
const creatives = new Map<string, CreativeRecord>();

const renderKey = (shortId: string, filename: string) => `${shortId}/${filename}`;

export function memoryDriver(): Store {
  return {
    name: "memory",

    async putLayer(hash, bytes, meta) {
      const fullMeta: LayerMeta = { ...meta, hash, createdAt: meta.createdAt ?? new Date().toISOString() };
      layers.set(hash, { bytes: Uint8Array.from(bytes), meta: fullMeta });
    },

    async getLayer(hash) {
      const hit = layers.get(hash);
      return hit ? { bytes: hit.bytes, meta: hit.meta } : null;
    },

    async getLayerMeta(hash) {
      return layers.get(hash)?.meta ?? null;
    },

    async listLayers(kind?: LayerKind) {
      const all = Array.from(layers.values(), (l) => l.meta);
      return (kind ? all.filter((m) => m.kind === kind) : all).sort(byCreatedAtDesc);
    },

    async deleteLayer(hash) {
      layers.delete(hash);
    },

    async putRender(shortId, filename, bytes) {
      renders.set(renderKey(shortId, filename), Uint8Array.from(bytes));
      return `/api/renders/${encodeURIComponent(shortId)}/${encodeURIComponent(filename)}`;
    },

    async getRender(shortId, filename) {
      return renders.get(renderKey(shortId, filename)) ?? null;
    },

    async putCreative(spec: CreativeSpec, utm: Utm, renderUrl?: string) {
      const record = buildCreativeRecord(spec, utm, renderUrl);
      creatives.set(record.spec.id, record);
      return record;
    },

    async getCreative(id) {
      return creatives.get(id) ?? null;
    },

    async listCreatives() {
      return Array.from(creatives.values()).sort(byCreatedAtDesc);
    },

    async deleteCreative(id) {
      creatives.delete(id);
    },
  };
}

/** Sólo para pruebas: vacía los tres mapas. */
export function resetMemoryStore(): void {
  layers.clear();
  renders.clear();
  creatives.clear();
}

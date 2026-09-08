import type { Store, StoreDriverName } from "./types";
import { fsDriver } from "./fs";
import { memoryDriver } from "./memory";
import { supabaseDriver } from "./supabase";

export type { Store, StoreDriverName } from "./types";
export { hashLayer, stableStringify } from "./hash";
export { extFor, mimeFor, isLayerMime, type LayerMime } from "./mime";
export { toArrayBuffer, asUint8Array, parseDataUrl } from "./bytes";

/**
 * Punto de entrada único: `getStore()` devuelve el driver que manda STORE_DRIVER.
 *   fs        → default en local (.ad-factory-cache/)
 *   memory    → default en Vercel sin Supabase (avisa una vez)
 *   supabase  → exige NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY
 *
 * El singleton se cuelga de globalThis para sobrevivir al HMR de `next dev`.
 */

const GLOBAL_KEY = Symbol.for("ad-factory.store");

type StoreSlot = { store?: Store; warned: boolean };
type GlobalWithStore = typeof globalThis & { [GLOBAL_KEY]?: StoreSlot };

function slot(): StoreSlot {
  const g = globalThis as GlobalWithStore;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { warned: false };
  return g[GLOBAL_KEY];
}

export function resolveDriverName(): StoreDriverName {
  const raw = process.env.STORE_DRIVER?.trim().toLowerCase();
  if (raw === "fs" || raw === "memory" || raw === "supabase") return raw;
  if (raw) {
    throw new Error(`STORE_DRIVER="${raw}" no es válido. Usa fs | memory | supabase.`);
  }
  if (process.env.VERCEL) {
    const s = slot();
    if (!s.warned) {
      s.warned = true;
      console.warn(
        "[store] Vercel sin Supabase: las capas viven en memoria y se pierden entre invocaciones; ver TODO.md",
      );
    }
    return "memory";
  }
  return "fs";
}

export function createStore(name: StoreDriverName = resolveDriverName()): Store {
  switch (name) {
    case "fs":
      return fsDriver();
    case "memory":
      return memoryDriver();
    case "supabase":
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
        throw new Error("STORE_DRIVER=supabase pero faltan llaves. Sigue TODO.md (sección Variables de entorno).");
      }
      return supabaseDriver();
  }
}

export function getStore(): Store {
  const s = slot();
  if (!s.store) s.store = createStore();
  return s.store;
}

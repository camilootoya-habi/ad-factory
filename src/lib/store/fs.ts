import { promises as fsp } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { CreativeRecord, CreativeSpec, LayerKind, LayerMeta, Utm } from "@/lib/creative/types";
import type { Store } from "./types";
import { asUint8Array } from "./bytes";
import { extFor } from "./mime";
import { buildCreativeRecord, byCreatedAtDesc } from "./record";

/**
 * Driver de disco (dev y local). Estructura:
 *   <root>/layers/<hash>.<png|jpg|webp>   bytes de la capa
 *   <root>/layers/<hash>.json             LayerMeta
 *   <root>/renders/<shortId>/<filename>   PNG exportado
 *   <root>/creatives/<id>.json            CreativeRecord
 *
 * Todas las escrituras son atómicas (tmp + rename) para que un proceso que muera a
 * mitad de camino no deje JSON truncado en la caché.
 */

const LAYER_EXTS = ["png", "jpg", "webp"] as const;

export function defaultCacheDir(): string {
  return process.env.AD_FACTORY_CACHE_DIR ?? path.join(process.cwd(), ".ad-factory-cache");
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "ENOENT";
}

/** Rechaza cualquier segmento que pueda escapar del directorio (../, /, \). */
function safeSegment(value: string, label: string): string {
  if (!value || value !== path.basename(value) || value === "." || value === "..") {
    throw new Error(`${label} inválido: "${value}"`);
  }
  return value;
}

async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

async function writeAtomic(file: string, data: Uint8Array | string): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await fsp.writeFile(tmp, data);
    await fsp.rename(tmp, file);
  } catch (err) {
    await fsp.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}

async function readBytes(file: string): Promise<Uint8Array | null> {
  try {
    return asUint8Array(await fsp.readFile(file));
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fsp.readFile(file, "utf8")) as T;
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

async function listDir(dir: string): Promise<string[]> {
  try {
    return await fsp.readdir(dir);
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }
}

export function fsDriver(rootDir: string = defaultCacheDir()): Store {
  const layersDir = path.join(rootDir, "layers");
  const rendersDir = path.join(rootDir, "renders");
  const creativesDir = path.join(rootDir, "creatives");

  const metaPath = (hash: string) => path.join(layersDir, `${safeSegment(hash, "hash")}.json`);
  const layerPath = (hash: string, ext: string) => path.join(layersDir, `${safeSegment(hash, "hash")}.${ext}`);
  const renderPath = (shortId: string, filename: string) =>
    path.join(rendersDir, safeSegment(shortId, "shortId"), safeSegment(filename, "filename"));
  const creativePath = (id: string) => path.join(creativesDir, `${safeSegment(id, "id")}.json`);

  return {
    name: "fs",

    async putLayer(hash, bytes, meta) {
      const ext = extFor(meta.mime);
      const fullMeta: LayerMeta = { ...meta, hash, createdAt: meta.createdAt ?? new Date().toISOString() };
      await writeAtomic(layerPath(hash, ext), bytes);
      await writeAtomic(metaPath(hash), JSON.stringify(fullMeta, null, 2));
    },

    async getLayer(hash) {
      const meta = await readJson<LayerMeta>(metaPath(hash));
      if (!meta) return null;
      const bytes = await readBytes(layerPath(hash, extFor(meta.mime)));
      if (!bytes) return null;
      return { bytes, meta };
    },

    async getLayerMeta(hash) {
      return readJson<LayerMeta>(metaPath(hash));
    },

    async listLayers(kind?: LayerKind) {
      const files = (await listDir(layersDir)).filter((f) => f.endsWith(".json"));
      const metas = await Promise.all(files.map((f) => readJson<LayerMeta>(path.join(layersDir, f))));
      return metas
        .filter((m): m is LayerMeta => Boolean(m) && (!kind || m!.kind === kind))
        .sort(byCreatedAtDesc);
    },

    async deleteLayer(hash) {
      const targets = [metaPath(hash), ...LAYER_EXTS.map((ext) => layerPath(hash, ext))];
      await Promise.all(targets.map((f) => fsp.rm(f, { force: true })));
    },

    async putRender(shortId, filename, bytes) {
      await writeAtomic(renderPath(shortId, filename), bytes);
      return `/api/renders/${encodeURIComponent(shortId)}/${encodeURIComponent(filename)}`;
    },

    async getRender(shortId, filename) {
      return readBytes(renderPath(shortId, filename));
    },

    async putCreative(spec: CreativeSpec, utm: Utm, renderUrl?: string) {
      const record = buildCreativeRecord(spec, utm, renderUrl);
      await writeAtomic(creativePath(record.spec.id), JSON.stringify(record, null, 2));
      return record;
    },

    async getCreative(id) {
      return readJson<CreativeRecord>(creativePath(id));
    },

    async listCreatives() {
      const files = (await listDir(creativesDir)).filter((f) => f.endsWith(".json"));
      const records = await Promise.all(files.map((f) => readJson<CreativeRecord>(path.join(creativesDir, f))));
      return records.filter((r): r is CreativeRecord => Boolean(r)).sort(byCreatedAtDesc);
    },

    async deleteCreative(id) {
      await fsp.rm(creativePath(id), { force: true });
    },
  };
}

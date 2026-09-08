import type { CreativeRecord, CreativeSpec, Utm } from "@/lib/creative/types";
import { shortId as newShortId, uuid } from "@/lib/creative/ids";

/**
 * Arma el CreativeRecord que guardan los tres drivers. Completa id/shortId/createdAt si
 * la fábrica mandó un spec a medio armar, así la clave de guardado siempre existe.
 */
export function buildCreativeRecord(spec: CreativeSpec, utm: Utm, renderUrl?: string): CreativeRecord {
  const createdAt = new Date().toISOString();
  const normalized: CreativeSpec = {
    ...spec,
    id: spec.id && spec.id.trim() ? spec.id : uuid(),
    shortId: spec.shortId && spec.shortId.trim() ? spec.shortId : newShortId(),
    createdAt: spec.createdAt ?? createdAt,
  };
  const record: CreativeRecord = { spec: normalized, utm, createdAt };
  if (renderUrl) record.renderUrl = renderUrl;
  return record;
}

/** Orden por defecto de las listas: lo más nuevo primero. */
export function byCreatedAtDesc<T extends { createdAt: string }>(a: T, b: T): number {
  return b.createdAt.localeCompare(a.createdAt);
}

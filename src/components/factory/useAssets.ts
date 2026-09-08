"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CreativeAssets } from "@/components/creative";
import { assetHashesOf, resolveSpec, type AssetNeeds } from "@/lib/creative/resolve";
import type { CreativeSpec, Format, LayerKind, LayerMeta } from "@/lib/creative/types";
import { generateLayer, resolveRecipes, type GenerateProgress, type LayerRequest, type ResolvedRecipe } from "@/lib/replicate/browser";

export type AssetSlotState = {
  kind: LayerKind;
  request?: LayerRequest;
  hash?: string;
  exists: boolean;
  meta?: LayerMeta;
  url?: string;
};

export type AssetSlots = { fondo?: AssetSlotState; protagonista?: AssetSlotState };

export type AssetsState = {
  /** URLs mismo origen listas para <Creative assets>. */
  assets: CreativeAssets;
  slots: AssetSlots;
  /** Capas de imagen que la pieza necesita y aún no existen. */
  missing: LayerKind[];
  loading: boolean;
  error?: string;
  /** Progreso de la generación en curso, por capa. */
  progress: Partial<Record<LayerKind, GenerateProgress>>;
  generating: boolean;
  refresh: () => void;
  /** Genera las capas faltantes en secuencia. Devuelve los LayerMeta generados. */
  generateMissing: (opts?: { model?: string }) => Promise<LayerMeta[]>;
  /** Genera una capa concreta. */
  generateOne: (kind: LayerKind, opts?: { model?: string }) => Promise<LayerMeta | undefined>;
};

const KINDS: LayerKind[] = ["fondo", "protagonista"];

export function assetUrl(hash: string): string {
  return `/api/asset/${hash}`;
}

/**
 * Traduce lo que la pieza necesita a slots resueltos contra el store. Las capas con
 * `assetHash` se dan por existentes; las que sólo tienen receta se resuelven por hash en
 * /api/generate/resolve, que no gasta crédito.
 */
async function resolveSlots(needs: AssetNeeds, format: Format): Promise<AssetSlots> {
  const next: AssetSlots = {};
  const pending: { kind: LayerKind; req: LayerRequest }[] = [];

  for (const kind of KINDS) {
    const need = needs[kind];
    if (!need) continue;
    if (need.assetHash) {
      next[kind] = { kind, hash: need.assetHash, exists: true, url: assetUrl(need.assetHash) };
      if (need.recipe) {
        // Con receta y hash fijo se puede seguir editando la posición sin re-resolver.
        next[kind]!.request = { kind, attrs: need.recipe, model: need.model, format: kind === "fondo" ? format : undefined };
      }
    } else if (need.recipe) {
      const req: LayerRequest = { kind, attrs: need.recipe, model: need.model, format: kind === "fondo" ? format : undefined };
      next[kind] = { kind, request: req, exists: false };
      pending.push({ kind, req });
    }
  }

  if (pending.length) {
    const resolved: ResolvedRecipe[] = await resolveRecipes(pending.map((p) => p.req));
    resolved.forEach((r, i) => {
      const { kind } = pending[i];
      const slot = next[kind];
      if (!slot) return;
      next[kind] = { ...slot, hash: r.hash, exists: r.exists, meta: r.meta, url: r.exists ? assetUrl(r.hash) : undefined };
    });
  }
  return next;
}

/**
 * Resuelve las capas de imagen de un spec contra el store y permite generar las que faltan.
 * `loading` se deriva comparando la clave resuelta con la actual: así el efecto nunca hace
 * setState de forma sincrónica (regla react-hooks/set-state-in-effect).
 */
export function useAssets(spec: CreativeSpec | undefined, format?: Format): AssetsState {
  const [resolved, setResolved] = useState<{ key: string; slots: AssetSlots }>({ key: "", slots: {} });
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [progress, setProgress] = useState<AssetsState["progress"]>({});
  const [generating, setGenerating] = useState(false);

  const fmt = format ?? spec?.format ?? "1x1";
  const needs = useMemo<AssetNeeds>(() => (spec ? assetHashesOf(resolveSpec(spec, fmt)) : {}), [spec, fmt]);
  const needsKey = useMemo(() => `${fmt}|${reload}|${JSON.stringify(needs)}`, [needs, fmt, reload]);

  useEffect(() => {
    let cancelled = false;
    // Todos los setState ocurren después de un await: nunca sincrónicos en el efecto.
    void (async () => {
      try {
        const slots = await resolveSlots(needs, fmt);
        if (cancelled) return;
        setResolved({ key: needsKey, slots });
        setError(undefined);
      } catch (e) {
        if (cancelled) return;
        setResolved({ key: needsKey, slots: {} });
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsKey, needs, fmt]);

  const slots = resolved.slots;
  const loading = resolved.key !== needsKey;

  const generateOne = useCallback(
    async (kind: LayerKind, opts?: { model?: string }) => {
      const slot = slots[kind];
      if (!slot?.request) return undefined;
      setGenerating(true);
      setError(undefined);
      try {
        const meta = await generateLayer(
          { ...slot.request, model: opts?.model ?? slot.request.model },
          { onProgress: (p) => setProgress((prev) => ({ ...prev, [kind]: p })) },
        );
        setResolved((prev) => {
          const target = prev.slots[kind];
          if (!target) return prev;
          return {
            ...prev,
            slots: { ...prev.slots, [kind]: { ...target, hash: meta.hash, exists: true, meta, url: assetUrl(meta.hash) } },
          };
        });
        return meta;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        setGenerating(false);
        setProgress((prev) => {
          const n = { ...prev };
          delete n[kind];
          return n;
        });
      }
    },
    [slots],
  );

  const generateMissing = useCallback(
    async (opts?: { model?: string }) => {
      const out: LayerMeta[] = [];
      for (const kind of KINDS) {
        const slot = slots[kind];
        if (slot && !slot.exists && slot.request) {
          const meta = await generateOne(kind, opts);
          if (meta) out.push(meta);
        }
      }
      return out;
    },
    [slots, generateOne],
  );

  const refresh = useCallback(() => setReload((v) => v + 1), []);

  const assets = useMemo<CreativeAssets>(
    () => ({ fondo: slots.fondo?.url, protagonista: slots.protagonista?.url }),
    [slots.fondo?.url, slots.protagonista?.url],
  );
  const missing = useMemo(() => KINDS.filter((k) => slots[k] && !slots[k]!.exists), [slots]);

  return { assets, slots, missing, loading, error, progress, generating, refresh, generateMissing, generateOne };
}

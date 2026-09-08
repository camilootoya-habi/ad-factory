"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CanvasFit, Creative } from "@/components/creative";
import { Configurator } from "./Configurator";
import { UtmPanel } from "./UtmPanel";
import { blankSpec } from "./spec";
import { assetUrl, useAssets } from "./useAssets";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { shortId, uuid } from "@/lib/creative/ids";
import { PRESETS } from "@/lib/creative/presets";
import { FORMATS } from "@/lib/creative/scale";
import type { CreativeRecord, CreativeSpec, LayerKind, LayerMeta, UtmSource } from "@/lib/creative/types";
import { isFondoAttrs, isProtagonistaAttrs } from "@/lib/replicate/prompts";
import { buildUtm } from "@/lib/utm";

/** Un preset abierto en la fábrica se clona: editarlo no toca la semilla. */
function cloneForFactory(spec: CreativeSpec): CreativeSpec {
  return { ...spec, id: uuid(), shortId: shortId(), origin: "factory", presetKey: spec.presetKey, createdAt: new Date().toISOString() };
}

export function FactoryPage() {
  const params = useSearchParams();
  const { error, toast } = useToast();
  const presetKey = params.get("preset");
  const creativeId = params.get("creative");
  const layerHash = params.get("layer");
  const layerKind = params.get("kind") as LayerKind | null;

  // El preset se resuelve al montar (es sincrónico y /presets → / cambia de ruta, así que
  // esta página se monta de nuevo). Los casos asíncronos van al efecto de abajo.
  const [spec, setSpec] = useState<CreativeSpec>(() =>
    presetKey && PRESETS[presetKey] ? cloneForFactory(PRESETS[presetKey]) : blankSpec(),
  );
  const [source, setSource] = useState<UtmSource>("meta");
  const [model, setModel] = useState<"quality" | "fast">("quality");
  const [showClearSpace, setShowClearSpace] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Carga asíncrona desde la query: ?creative= | ?layer=&kind=. Todos los setState ocurren
  // después de un await, nunca sincrónicos en el efecto.
  useEffect(() => {
    if (!creativeId && !(layerHash && layerKind)) return;
    let cancelled = false;

    void (async () => {
      try {
        if (creativeId) {
          const res = await fetch(`/api/creatives/${encodeURIComponent(creativeId)}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`No se encontró el creativo (${res.status}).`);
          const rec = (await res.json()) as CreativeRecord;
          if (cancelled) return;
          setSpec(rec.spec);
          setSource(rec.utm.source);
          return;
        }

        const res = await fetch(`/api/layers?kind=${layerKind}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`No se pudo leer la biblioteca (${res.status}).`);
        const metas = (await res.json()) as LayerMeta[];
        const meta = metas.find((m) => m.hash === layerHash);
        if (!meta) throw new Error("Esa capa ya no está en la biblioteca.");
        if (cancelled) return;
        setSpec((prev) => {
          if (meta.kind === "protagonista" && isProtagonistaAttrs(meta.attrs)) {
            return {
              ...prev,
              protagonista: {
                ...(prev.protagonista ?? { anchor: "bottom-right", widthPct: 70, offset: [6, 0] as [number, number] }),
                assetHash: meta.hash,
                recipe: meta.attrs,
              },
            };
          }
          if (meta.kind === "fondo" && isFondoAttrs(meta.attrs)) {
            return { ...prev, fondo: { kind: "asset", assetHash: meta.hash, recipe: meta.attrs, blurCu: 0, scale: 1 } };
          }
          return prev;
        });
        toast(`Capa "${meta.slug}" cargada.`, "ok");
      } catch (e) {
        if (!cancelled) error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [creativeId, layerHash, layerKind, error, toast]);

  const assets = useAssets(spec, spec.format);

  // Los attrs de una capa traída por hash viven en su LayerMeta: la UTM los usa para
  // describir lo que realmente hay en la imagen.
  const utm = useMemo(() => {
    const protMeta = assets.slots.protagonista?.meta?.attrs;
    const fondoMeta = assets.slots.fondo?.meta?.attrs;
    return buildUtm(spec, {
      source,
      date: new Date(),
      protagonistaAttrs: protMeta && isProtagonistaAttrs(protMeta) ? protMeta : undefined,
      fondoAttrs: fondoMeta && isFondoAttrs(fondoMeta) ? fondoMeta : undefined,
    });
  }, [spec, source, assets.slots.protagonista?.meta, assets.slots.fondo?.meta]);

  const f = FORMATS[spec.format];
  const missingCount = assets.missing.length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="label-editorial">Fábrica</div>
        <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em]">{spec.name}</h1>
        <p className="max-w-[680px] text-[15px] leading-6" style={{ color: "var(--color-content-secondary)" }}>
          Elige la combinación; sólo las capas de imagen pasan por Replicate. Lo que ves en el preview es exactamente el PNG
          que se descarga.
        </p>
      </header>

      <div className="flex flex-col-reverse gap-8 xl:flex-row xl:items-start">
        <div className="w-full xl:w-[440px] xl:shrink-0">
          <Configurator
            spec={spec}
            onChange={setSpec}
            source={source}
            onSourceChange={setSource}
            model={model}
            onModelChange={setModel}
            showClearSpace={showClearSpace}
            onShowClearSpace={setShowClearSpace}
            assets={assets}
          />
        </div>

        <div className="flex-1 min-w-0 xl:sticky xl:top-8 flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip mono>{`${f.w}×${f.h} · ${f.ratio}`}</Chip>
            {assets.loading && <Chip>resolviendo capas…</Chip>}
            {!assets.loading && missingCount === 0 && <Chip tone="ok">capas listas</Chip>}
            {missingCount > 0 && (
              <Button variant="brand" size="sm" loading={assets.generating} disabled={assets.generating} onClick={() => void assets.generateMissing({ model })}>
                Generar {missingCount} capa(s) faltante(s)
              </Button>
            )}
          </div>

          <div ref={previewRef} className="p-4 rounded-[var(--radius-md)]" style={{ background: "var(--color-surface-tertiary)" }}>
            <CanvasFit format={spec.format} maxWidth={720} maxHeight={720}>
              <Creative spec={spec} format={spec.format} assets={assets.assets} debug={{ clearSpace: showClearSpace }} />
            </CanvasFit>
          </div>

          {assets.error && (
            <p className="text-[13px] rounded-[var(--radius-sm)] p-3" style={{ background: "var(--color-surface-accent)", color: "var(--color-content-error)" }}>
              {assets.error}
            </p>
          )}

          <div className="card p-5">
            <UtmPanel spec={spec} utm={utm} assets={assets} previewRef={previewRef} />
          </div>

          {(assets.slots.protagonista?.hash || assets.slots.fondo?.hash) && (
            <div className="flex flex-col gap-1 text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--color-content-tertiary)" }}>
              {assets.slots.protagonista?.hash && (
                <a href={assetUrl(assets.slots.protagonista.hash)} target="_blank" rel="noreferrer">
                  protagonista · {assets.slots.protagonista.hash}
                </a>
              )}
              {assets.slots.fondo?.hash && (
                <a href={assetUrl(assets.slots.fondo.hash)} target="_blank" rel="noreferrer">
                  fondo · {assets.slots.fondo.hash}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

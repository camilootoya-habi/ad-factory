"use client";

import Link from "next/link";
import { CanvasFit, Creative } from "@/components/creative";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { FORMATS } from "@/lib/creative/scale";
import type { CreativeSpec, LayerKind } from "@/lib/creative/types";
import { useAssets } from "./useAssets";

const PRODUCTO_LABEL: Record<CreativeSpec["producto"], string> = {
  sellers: "Sellers",
  multiproducto: "Multiproducto",
  "inmo-sellers": "Inmo Sellers",
  "mm-sellers": "MM Sellers",
};

const KIND_LABEL: Record<LayerKind, string> = { fondo: "fondo", protagonista: "protagonista" };

export function PresetCard({ presetKey, spec, maxWidth = 360 }: { presetKey: string; spec: CreativeSpec; maxWidth?: number }) {
  const { assets, slots, missing, loading, generating, progress, generateMissing } = useAssets(spec);
  const { toast, error } = useToast();
  const f = FORMATS[spec.format];

  const onGenerate = async () => {
    if (!missing.length) return;
    if (!window.confirm(`Esto genera ${missing.length} capa(s) en Replicate y gasta crédito. ¿Continuar?`)) return;
    try {
      const metas = await generateMissing();
      toast(`${metas.length} capa(s) generada(s).`, "ok");
    } catch (e) {
      error(e);
    }
  };

  return (
    <article className="card flex flex-col overflow-hidden">
      <div className="p-3" style={{ background: "var(--color-surface-tertiary)" }}>
        <CanvasFit format={spec.format} maxWidth={maxWidth}>
          <Creative spec={spec} assets={assets} />
        </CanvasFit>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="label-editorial">{presetKey}</div>
            <h3 className="text-[16px] font-semibold leading-6 mt-1">{spec.name}</h3>
          </div>
          <Chip tone="brand">{PRODUCTO_LABEL[spec.producto]}</Chip>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip mono>{`${f.w}×${f.h} · ${f.ratio}`}</Chip>
          {(["fondo", "protagonista"] as LayerKind[]).map((kind) => {
            const slot = slots[kind];
            if (!slot) return null;
            const p = progress[kind];
            return (
              <Chip key={kind} tone={slot.exists ? "ok" : "warn"} title={slot.hash}>
                {KIND_LABEL[kind]} {p ? `· ${p.stage}…` : slot.exists ? "✓ en caché" : "falta"}
              </Chip>
            );
          })}
          {!slots.fondo && !slots.protagonista && !loading && <Chip>sin capas de imagen</Chip>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/?preset=${encodeURIComponent(presetKey)}`} className="btn-brand" style={{ padding: "10px 18px" }}>
            Abrir en fábrica
          </Link>
          <Button variant="ghost" onClick={onGenerate} disabled={loading || generating || missing.length === 0} loading={generating}>
            {missing.length ? `Generar ${missing.length} capa(s)` : "Capas listas"}
          </Button>
        </div>
      </div>
    </article>
  );
}

"use client";

import { useState } from "react";
import { PresetCard } from "@/components/factory/PresetCard";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { PRESETS, PRESET_KEYS } from "@/lib/creative/presets";
import { assetHashesOf, resolveSpec } from "@/lib/creative/resolve";
import type { LayerKind } from "@/lib/creative/types";
import { generateLayer, resolveRecipes, type LayerRequest } from "@/lib/replicate/browser";

/** Recorre los 6 presets, resuelve sus recetas y genera sólo las que faltan, en secuencia. */
async function generateAllMissing(onStep: (msg: string) => void): Promise<number> {
  const reqs: { key: string; kind: LayerKind; req: LayerRequest }[] = [];
  for (const key of PRESET_KEYS) {
    const spec = PRESETS[key];
    const needs = assetHashesOf(resolveSpec(spec));
    (["fondo", "protagonista"] as LayerKind[]).forEach((kind) => {
      const need = needs[kind];
      if (need?.recipe && !need.assetHash) {
        reqs.push({ key, kind, req: { kind, attrs: need.recipe, model: need.model, format: kind === "fondo" ? spec.format : undefined } });
      }
    });
  }
  const resolved = await resolveRecipes(reqs.map((r) => r.req));
  const pending = reqs.filter((_, i) => !resolved[i].exists);
  let done = 0;
  for (const { key, kind, req } of pending) {
    onStep(`${key} · ${kind} (${done + 1}/${pending.length})`);
    await generateLayer(req);
    done++;
  }
  return done;
}

export default function PresetsPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const { toast, error } = useToast();

  const onGenerateAll = async () => {
    if (!window.confirm("Esto genera en Replicate todas las capas que falten de los 6 presets y gasta crédito. ¿Continuar?")) return;
    setBusy("Resolviendo…");
    try {
      const n = await generateAllMissing(setBusy);
      toast(n ? `${n} capa(s) generada(s).` : "Todas las capas ya estaban en caché.", "ok");
      setVersion((v) => v + 1);
    } catch (e) {
      error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="label-editorial">Presets</div>
          <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em] mt-2">Las 6 referencias como semilla</h1>
          <p className="mt-2 max-w-[640px] text-[15px] leading-6" style={{ color: "var(--color-content-secondary)" }}>
            Cada preset es un <code>CreativeSpec</code> completo. Las capas de imagen se generan una vez y quedan en caché
            por hash; los fondos planos y gradientes son CSS y no cuestan nada.
          </p>
        </div>
        <Button variant="brand" onClick={onGenerateAll} loading={busy !== null} disabled={busy !== null}>
          {busy ?? "Generar capas de los 6"}
        </Button>
      </header>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3" key={version}>
        {PRESET_KEYS.map((key) => (
          <PresetCard key={key} presetKey={key} spec={PRESETS[key]} />
        ))}
      </div>
    </div>
  );
}

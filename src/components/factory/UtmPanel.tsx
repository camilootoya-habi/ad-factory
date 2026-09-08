"use client";

import { useState } from "react";
import { CREATIVE_ROOT_SELECTOR } from "@/components/creative";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { copyText } from "@/components/ui/copyText";
import type { CreativeSpec, LayerKind, Utm } from "@/lib/creative/types";
import { blobToDataUrl, downloadBlob, exportCreativePng } from "@/lib/export";
import type { AssetsState } from "./useAssets";

const KIND_LABEL: Record<LayerKind, string> = { fondo: "fondo", protagonista: "protagonista" };

export function UtmPanel({
  spec,
  utm,
  assets,
  previewRef,
}: {
  spec: CreativeSpec;
  utm: Utm;
  assets: AssetsState;
  previewRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { toast, error } = useToast();
  const [busy, setBusy] = useState<"png" | "save" | null>(null);
  const blocked = assets.missing.length > 0;

  /** Nodo real de la pieza (a tamaño completo), nunca el wrapper escalado. */
  const rootNode = (): HTMLElement => {
    const node = previewRef.current?.querySelector<HTMLElement>(CREATIVE_ROOT_SELECTOR);
    if (!node) throw new Error("No se encontró la pieza en el preview.");
    return node;
  };

  const onCopy = async (text: string, what: string) => {
    toast((await copyText(text)) ? `${what} copiada.` : "No se pudo copiar.", "info");
  };

  const onDownload = async () => {
    setBusy("png");
    try {
      const blob = await exportCreativePng(rootNode());
      downloadBlob(blob, utm.filename);
      toast("PNG descargado.", "ok");
    } catch (e) {
      error(e);
    } finally {
      setBusy(null);
    }
  };

  const onSave = async () => {
    setBusy("save");
    try {
      const blob = await exportCreativePng(rootNode());
      const dataUrl = await blobToDataUrl(blob);
      const up = await fetch(`/api/renders/${encodeURIComponent(spec.shortId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: utm.filename, dataUrl }),
      });
      if (!up.ok) throw new Error(`No se pudo guardar el PNG (${up.status}).`);
      const { url } = (await up.json()) as { url: string };

      const rec = await fetch("/api/creatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, utm, renderUrl: url }),
      });
      if (!rec.ok) throw new Error(`No se pudo guardar el creativo (${rec.status}).`);
      toast("Creativo guardado con su UTM.", "ok");
    } catch (e) {
      error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip mono>{utm.campaign}</Chip>
        <Chip mono title="utm_source · utm_medium">{`${utm.source} · ${utm.medium}`}</Chip>
        <Chip mono title="utm_term">{utm.term}</Chip>
        {blocked &&
          assets.missing.map((k) => (
            <Chip key={k} tone="warn">
              falta {KIND_LABEL[k]}
            </Chip>
          ))}
      </div>

      <div>
        <div className="label-editorial mb-2">utm_content</div>
        <button
          type="button"
          onClick={() => void onCopy(utm.content, "UTM")}
          title="Copiar utm_content"
          className="w-full text-left text-[12px] leading-5 break-all rounded-[var(--radius-sm)] p-3"
          style={{
            fontFamily: "var(--font-mono)",
            background: "var(--color-surface-secondary)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          {utm.content}
        </button>
      </div>

      <div>
        <div className="label-editorial mb-2">URL etiquetada</div>
        <div className="text-[12px] leading-5 break-all" style={{ color: "var(--color-content-tertiary)" }}>
          {utm.url}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="brand" onClick={onDownload} loading={busy === "png"} disabled={busy !== null || blocked} tooltip={blocked ? "Genera o elige las capas primero" : undefined}>
          Descargar PNG
        </Button>
        <Button variant="ghost" onClick={onSave} loading={busy === "save"} disabled={busy !== null || blocked}>
          Guardar creativo
        </Button>
        <Button variant="ghost" onClick={() => void onCopy(utm.content, "UTM")}>
          Copiar UTM
        </Button>
        <Button variant="ghost" onClick={() => void onCopy(utm.url, "URL")}>
          Copiar URL
        </Button>
      </div>

      <p className="text-[12px] leading-5" style={{ color: "var(--color-content-tertiary)" }}>
        El PNG se descarga como <code>{utm.filename}</code>: el archivo que sube el equipo a Meta ya es trazable.
      </p>
    </div>
  );
}

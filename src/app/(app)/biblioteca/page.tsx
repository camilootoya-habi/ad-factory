"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { copyText } from "@/components/ui/copyText";
import type { LayerKind, LayerMeta } from "@/lib/creative/types";
import { describeAttrs } from "@/lib/utm";

const KIND_OPTIONS = [
  { value: "protagonista", label: "Protagonistas" },
  { value: "fondo", label: "Fondos" },
] as const;

function formatBytesish(meta: LayerMeta): string {
  return `${meta.width}×${meta.height}${meta.hasAlpha ? " · alfa" : ""}`;
}

function shortModel(model: string): string {
  return model.replace("google/", "").replace("black-forest-labs/", "");
}

export default function BibliotecaPage() {
  const [kind, setKind] = useState<LayerKind>("protagonista");
  const [loaded, setLoaded] = useState<{ key: string; layers: LayerMeta[] } | null>(null);
  const [reload, setReload] = useState(0);
  const { toast, error } = useToast();

  const key = `${kind}|${reload}`;
  // `loading` se deriva: el efecto nunca hace setState de forma sincrónica.
  const layers = loaded?.key === key ? loaded.layers : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/layers?kind=${kind}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`No se pudo leer la biblioteca (${res.status}).`);
        const data = (await res.json()) as LayerMeta[];
        if (!cancelled) setLoaded({ key, layers: data });
      } catch (e) {
        if (cancelled) return;
        error(e);
        setLoaded({ key, layers: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, kind, error]);

  const load = useCallback(() => setReload((v) => v + 1), []);

  const onDelete = async (meta: LayerMeta) => {
    if (!window.confirm(`¿Eliminar la capa "${meta.slug}"? Volver a generarla gasta crédito.`)) return;
    try {
      const res = await fetch(`/api/layers/${meta.hash}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`No se pudo eliminar (${res.status}).`);
      toast("Capa eliminada.", "ok");
      load();
    } catch (e) {
      error(e);
    }
  };

  const onCopy = async (text: string) => {
    toast((await copyText(text)) ? "Copiado." : "No se pudo copiar.", "info");
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="label-editorial">Biblioteca</div>
          <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em] mt-2">Capas generadas</h1>
          <p className="mt-2 max-w-[640px] text-[15px] leading-6" style={{ color: "var(--color-content-secondary)" }}>
            Cada capa vive una sola vez, identificada por el hash de su receta. Reutilizarla en otra pieza no vuelve a gastar
            crédito; el slug es lo que entra en la UTM.
          </p>
        </div>
        <SegmentedControl value={kind} options={KIND_OPTIONS} onChange={setKind} ariaLabel="Tipo de capa" />
      </header>

      {layers === null && (
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 320, borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      )}

      {layers && layers.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-[15px]" style={{ color: "var(--color-content-secondary)" }}>
            Aún no hay {kind === "fondo" ? "fondos" : "protagonistas"} generados.
          </p>
          <p className="mt-2 text-[14px]">
            Empieza por los{" "}
            <Link href="/presets" className="underline" style={{ color: "var(--brand-primary)" }}>
              presets
            </Link>{" "}
            o arma uno en la{" "}
            <Link href="/" className="underline" style={{ color: "var(--brand-primary)" }}>
              fábrica
            </Link>
            .
          </p>
        </div>
      )}

      {layers && layers.length > 0 && (
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {layers.map((meta) => (
            <article key={meta.hash} className="card card-hover flex flex-col overflow-hidden">
              <div
                className="flex items-center justify-center p-3"
                style={{
                  aspectRatio: "1 / 1",
                  // Damero para ver el alfa de los recortes.
                  backgroundColor: "var(--color-surface-tertiary)",
                  backgroundImage:
                    "linear-gradient(45deg, var(--color-border-subtle) 25%, transparent 25%), linear-gradient(-45deg, var(--color-border-subtle) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-border-subtle) 75%), linear-gradient(-45deg, transparent 75%, var(--color-border-subtle) 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
                }}
              >
                <img
                  src={`/api/asset/${meta.hash}`}
                  alt={meta.slug}
                  loading="lazy"
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              </div>
              <div className="flex flex-col gap-3 p-4">
                <div>
                  <button
                    type="button"
                    onClick={() => onCopy(meta.slug)}
                    title="Copiar slug"
                    className="text-left text-[12px] leading-4 break-all"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--brand-primary)" }}
                  >
                    {meta.slug}
                  </button>
                  <p className="mt-2 text-[13px] leading-5" style={{ color: "var(--color-content-secondary)" }}>
                    {describeAttrs(meta.kind, meta.attrs)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip mono>{formatBytesish(meta)}</Chip>
                  <Chip mono title={meta.model}>
                    {shortModel(meta.model)}
                  </Chip>
                  <Chip mono>{new Date(meta.createdAt).toLocaleDateString("es-CO")}</Chip>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/?layer=${meta.hash}&kind=${meta.kind}`} className="btn-brand" style={{ padding: "10px 18px" }}>
                    Usar en fábrica
                  </Link>
                  <Button variant="ghost" onClick={() => onDelete(meta)}>
                    Eliminar
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

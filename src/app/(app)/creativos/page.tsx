"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { copyText } from "@/components/ui/copyText";
import { FORMATS } from "@/lib/creative/scale";
import type { CreativeRecord } from "@/lib/creative/types";

export default function CreativosPage() {
  const [loaded, setLoaded] = useState<{ key: number; records: CreativeRecord[] } | null>(null);
  const [reload, setReload] = useState(0);
  const { toast, error } = useToast();

  // `records === null` = cargando; se deriva de la clave para no hacer setState en el efecto.
  const records = loaded?.key === reload ? loaded.records : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/creatives", { cache: "no-store" });
        if (!res.ok) throw new Error(`No se pudo leer el registro (${res.status}).`);
        const data = (await res.json()) as CreativeRecord[];
        if (!cancelled) setLoaded({ key: reload, records: data });
      } catch (e) {
        if (cancelled) return;
        error(e);
        setLoaded({ key: reload, records: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, error]);

  const load = useCallback(() => setReload((v) => v + 1), []);

  const onCopy = async (text: string, what: string) => {
    toast((await copyText(text)) ? `${what} copiada.` : "No se pudo copiar.", "info");
  };

  const onDelete = async (r: CreativeRecord) => {
    if (!window.confirm(`¿Eliminar "${r.spec.name}" del registro?`)) return;
    try {
      const res = await fetch(`/api/creatives/${encodeURIComponent(r.spec.id)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`No se pudo eliminar (${res.status}).`);
      toast("Creativo eliminado.", "ok");
      load();
    } catch (e) {
      error(e);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="label-editorial">Creativos</div>
        <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.015em] mt-2">Piezas guardadas</h1>
        <p className="mt-2 max-w-[640px] text-[15px] leading-6" style={{ color: "var(--color-content-secondary)" }}>
          Cada pieza queda con su UTM. El PNG se llama igual que <code>utm_content</code>, así el archivo que sube el equipo
          a Meta ya es trazable por sí solo.
        </p>
      </header>

      {records === null && <Skeleton style={{ height: 240, borderRadius: "var(--radius-md)" }} />}

      {records && records.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-[15px]" style={{ color: "var(--color-content-secondary)" }}>
            Todavía no hay creativos guardados.
          </p>
          <p className="mt-2 text-[14px]">
            Arma uno en la{" "}
            <Link href="/" className="underline" style={{ color: "var(--brand-primary)" }}>
              fábrica
            </Link>{" "}
            y pulsa “Guardar creativo”.
          </p>
        </div>
      )}

      {records && records.length > 0 && (
        <div className="flex flex-col gap-4">
          {records.map((r) => {
            const f = FORMATS[r.spec.format];
            return (
              <article key={r.spec.id} className="card card-hover flex flex-col md:flex-row gap-5 p-4">
                <div className="shrink-0 w-full md:w-[220px]">
                  {r.renderUrl ? (
                    <img
                      src={r.renderUrl}
                      alt={r.spec.name}
                      loading="lazy"
                      className="w-full rounded-[var(--radius-sm)]"
                      style={{ aspectRatio: `${f.w} / ${f.h}`, objectFit: "cover", border: "1px solid var(--color-border-subtle)" }}
                    />
                  ) : (
                    <div
                      className="w-full rounded-[var(--radius-sm)] flex items-center justify-center label-editorial"
                      style={{ aspectRatio: `${f.w} / ${f.h}`, background: "var(--color-surface-tertiary)" }}
                    >
                      sin render
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[16px] font-semibold leading-6">{r.spec.name}</h3>
                    <Chip mono>{f.ratio}</Chip>
                    <Chip tone="brand">{r.spec.producto}</Chip>
                    <Chip mono>{r.utm.campaign}</Chip>
                    <Chip mono title="utm_term">
                      {r.utm.term}
                    </Chip>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCopy(r.utm.content, "UTM")}
                    title="Copiar utm_content"
                    className="text-left text-[12px] leading-5 break-all rounded-[var(--radius-sm)] p-3"
                    style={{ fontFamily: "var(--font-mono)", background: "var(--color-surface-secondary)", border: "1px solid var(--color-border-subtle)" }}
                  >
                    {r.utm.content}
                  </button>
                  <div className="text-[12px] leading-4 break-all" style={{ color: "var(--color-content-tertiary)" }}>
                    {r.utm.url}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {r.renderUrl && (
                      <a href={r.renderUrl} download={r.utm.filename} className="btn-brand" style={{ padding: "10px 18px" }}>
                        Descargar PNG
                      </a>
                    )}
                    <Button variant="ghost" onClick={() => onCopy(r.utm.url, "URL")}>
                      Copiar URL
                    </Button>
                    <Link href={`/?creative=${encodeURIComponent(r.spec.id)}`} className="btn-ghost" style={{ padding: "10px 18px" }}>
                      Abrir en fábrica
                    </Link>
                    <Button variant="ghost" onClick={() => onDelete(r)}>
                      Eliminar
                    </Button>
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--color-content-tertiary)" }}>
                    {new Date(r.createdAt).toLocaleString("es-CO")}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toHex } from "@/lib/brand/colors";
import { resolveSpec } from "@/lib/creative/resolve";
import { FORMATS } from "@/lib/creative/scale";
import type { CreativeSpec, Format } from "@/lib/creative/types";
import { LayerCta } from "./layers/LayerCta";
import { LayerDebug } from "./layers/LayerDebug";
import { LayerFondo } from "./layers/LayerFondo";
import { LayerLegal } from "./layers/LayerLegal";
import { LayerLogo } from "./layers/LayerLogo";
import { LayerOverlay } from "./layers/LayerOverlay";
import { LayerProtagonista } from "./layers/LayerProtagonista";
import { LayerTexto } from "./layers/LayerTexto";
import { LayerTitulo } from "./layers/LayerTitulo";

/** Selectores que usan el export del browser y el batch de Chrome. */
export const CREATIVE_ROOT_SELECTOR = "[data-creative-root]";
export const CREATIVE_READY_SELECTOR = '[data-creative-root][data-creative-ready="true"]';
/** Presente cuando falta alguna capa de imagen: la exportación final debe rechazarlo. */
export const CREATIVE_PLACEHOLDER_SELECTOR = "[data-creative-placeholder]";

/** URLs mismo origen (/api/asset/<hash>) o data: de las capas de imagen. */
export type CreativeAssets = { fondo?: string; protagonista?: string };

export type CreativeDebug = {
  /** Dibuja el rectángulo de clear space del logo. */
  clearSpace?: boolean;
  /** Dibuja las cajas de todos los slots. */
  boxes?: boolean;
};

export type CreativeProps = {
  spec: CreativeSpec;
  /** Formato a renderizar; por defecto el del spec. */
  format?: Format;
  assets?: CreativeAssets;
  debug?: CreativeDebug;
  /** Se llama cuando todas las <img> cargaron (o no hay) y las fuentes están listas. */
  onReady?: () => void;
};

/**
 * El único renderer de la pieza. Renderiza a TAMAÑO REAL en px (FORMATS[format]); la
 * captura apunta a [data-creative-root] y espera data-creative-ready="true".
 * Para verlo pequeño se envuelve en <CanvasFit>, nunca se escala aquí.
 */
export function Creative({ spec, format, assets, debug, onReady }: CreativeProps) {
  const resolved = useMemo(() => resolveSpec(spec, format), [spec, format]);
  const fmt = resolved.format;
  const { w, h } = FORMATS[fmt];
  const fondoUrl = assets?.fondo;
  const protagonistaUrl = assets?.protagonista;

  const rootRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Identidad de "lo que hay que esperar": cualquier cambio de spec, formato o URL
  // produce un objeto nuevo y la pieza vuelve a no-listo hasta verificar sus <img>.
  const waitKey = useMemo(() => ({ fondoUrl, protagonistaUrl, resolved }), [resolved, fondoUrl, protagonistaUrl]);
  const [readyFor, setReadyFor] = useState<object | null>(null);
  const ready = readyFor === waitKey;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    const imgs = Array.from(root.querySelectorAll("img"));
    const pending = imgs.filter((img) => !img.complete);
    let remaining = pending.length;

    const finish = () => {
      // Con fuentes de reemplazo los px de texto cambian: se espera a que Montserrat/Inter estén.
      const fonts = typeof document !== "undefined" && document.fonts ? document.fonts.ready : Promise.resolve();
      fonts.then(() => {
        if (!cancelled) setReadyFor(waitKey);
      });
    };
    const onDone = () => {
      remaining -= 1;
      if (remaining === 0) finish();
    };

    if (remaining === 0) finish();
    for (const img of pending) {
      img.addEventListener("load", onDone);
      img.addEventListener("error", onDone);
    }
    return () => {
      cancelled = true;
      for (const img of pending) {
        img.removeEventListener("load", onDone);
        img.removeEventListener("error", onDone);
      }
    };
  }, [waitKey]);

  useEffect(() => {
    if (ready) onReadyRef.current?.();
  }, [ready]);

  return (
    <div
      ref={rootRef}
      data-creative-root=""
      data-format={fmt}
      data-short-id={resolved.shortId}
      data-creative-ready={ready ? "true" : "false"}
      style={{
        position: "relative",
        width: w,
        height: h,
        flex: "none",
        overflow: "hidden",
        // Los blend modes del protagonista se mezclan sólo con las capas de la pieza.
        isolation: "isolate",
        background: toHex("white"),
        color: toHex("neutral-900"),
        fontFamily: "var(--font-headings)",
        fontStyle: "normal",
        lineHeight: 1,
        WebkitFontSmoothing: "antialiased",
        boxSizing: "border-box",
      }}
    >
      <LayerFondo spec={resolved} format={fmt} url={fondoUrl} />
      <LayerOverlay spec={resolved} format={fmt} />
      <LayerProtagonista spec={resolved} format={fmt} url={protagonistaUrl} />
      <LayerTitulo spec={resolved} format={fmt} />
      <LayerTexto spec={resolved} format={fmt} />
      <LayerCta spec={resolved} format={fmt} />
      <LayerLogo spec={resolved} format={fmt} showClearSpace={debug?.clearSpace} />
      <LayerLegal spec={resolved} format={fmt} />
      {debug?.boxes && <LayerDebug spec={resolved} format={fmt} />}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FORMATS } from "@/lib/creative/scale";
import type { Format } from "@/lib/creative/types";

export type CanvasFitProps = {
  format: Format;
  /** Ancho máximo del preview en px; también fija la escala inicial antes de medir. */
  maxWidth?: number;
  maxHeight?: number;
  /** El <Creative> a tamaño real. */
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function scaleFor(availW: number, maxH: number | undefined, w: number, h: number): number {
  let k = availW / w;
  if (maxH) k = Math.min(k, maxH / h);
  k = Math.min(k, 1); // nunca agranda: el preview es una reducción de la pieza real
  return Math.round(k * 10000) / 10000;
}

/**
 * Encaja un <Creative> (tamaño real) en su contenedor con transform: scale(k). El outer
 * ocupa el tamaño escalado para que el layout fluya; el nodo del Creative sigue a tamaño
 * real, así que la captura apunta a [data-creative-root], nunca a este wrapper.
 */
export function CanvasFit({ format, maxWidth, maxHeight, children, className, style }: CanvasFitProps) {
  const { w, h } = FORMATS[format];
  const outerRef = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(() => scaleFor(maxWidth ?? w, maxHeight, w, h));

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      const availW = Math.min(el.clientWidth || w, maxWidth ?? Infinity);
      const next = scaleFor(availW, maxHeight, w, h);
      if (next > 0) setK(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, maxWidth, maxHeight]);

  return (
    <div ref={outerRef} data-canvas-fit="" data-scale={k} className={className} style={{ width: "100%", maxWidth, ...style }}>
      <div style={{ width: w * k, height: h * k, position: "relative", overflow: "hidden" }}>
        <div style={{ width: w, height: h, transform: `scale(${k})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}

import { Fragment, type CSSProperties, type ReactNode } from "react";
import { rgba, toHex } from "@/lib/brand/colors";
import type { ResolvedSpec } from "@/lib/creative/resolve";
import { unitFor } from "@/lib/creative/scale";
import type { FondoAttrs, Format, LayerAttrs, LayerKind, ProtagonistaAttrs, Run } from "@/lib/creative/types";

/** Orden de apilado de las capas de la pieza. */
export const Z = {
  fondo: 0,
  overlay: 1,
  protagonista: 2,
  titulo: 3,
  texto: 4,
  cta: 5,
  logo: 6,
  legal: 7,
  debug: 9,
} as const;

export type LayerProps = { spec: ResolvedSpec; format: Format };

/**
 * Runs → spans con peso y color propios; "\n" dentro del texto → <br/>.
 * `defaultColor` ya viene en hex; los colores de los runs se resuelven aquí.
 */
export function renderRuns(runs: Run[], defaultColor: string, defaultWeight: number): ReactNode {
  return runs.map((run, i) => {
    const parts = run.text.split("\n");
    return (
      <span key={i} style={{ fontWeight: run.weight ?? defaultWeight, color: run.color ? toHex(run.color) : defaultColor, fontStyle: "normal" }}>
        {parts.map((part, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {part}
          </Fragment>
        ))}
      </span>
    );
  });
}

/** Número de líneas explícitas de un bloque de runs (para estimar alturas sin medir). */
export function lineCount(runs: Run[]): number {
  return runs.reduce((n, r) => n + (r.text.split("\n").length - 1), 1);
}

const MAX_LABEL = 64;

/** Texto corto del placeholder: "protagonista · mujer joven trigueña medio-cuerpo". */
export function describeRecipe(kind: LayerKind, recipe: LayerAttrs | undefined, assetHash?: string): string {
  const parts: string[] = [];
  if (recipe) {
    if (kind === "protagonista") {
      const r = recipe as ProtagonistaAttrs;
      parts.push(r.tipo);
      if (r.genero) parts.push(r.genero);
      if (r.edad) parts.push(r.edad);
      if (r.piel) parts.push(r.piel);
      if (r.pose) parts.push(r.pose);
      parts.push(r.encuadre);
      if (r.sujeto && !r.genero) parts.push(r.sujeto);
      if (r.copy && !r.sujeto) parts.push(r.copy);
    } else {
      const r = recipe as FondoAttrs;
      parts.push(r.tipo, r.estilo, `desenfoque ${r.desenfoque}`);
      if (r.elementos?.length) parts.push(r.elementos.slice(0, 3).join(", "));
    }
  } else if (assetHash) {
    parts.push(assetHash.slice(0, 8));
  } else {
    parts.push("sin receta");
  }
  const body = parts.join(" ").replace(/\s+/g, " ");
  const clipped = body.length > MAX_LABEL ? `${body.slice(0, MAX_LABEL - 1).trimEnd()}…` : body;
  return `${kind} · ${clipped}`;
}

/**
 * Caja de espera para una capa de imagen sin URL. Sólo aparece en el configurador; el
 * export debe rechazar piezas con [data-creative-placeholder].
 */
export function Placeholder({ label, format, style }: { label: string; format: Format; style?: CSSProperties }) {
  const u = unitFor(format);
  return (
    <div
      data-creative-placeholder=""
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24 * u,
        border: `${2 * u}px dashed ${toHex("neutral-300")}`,
        borderRadius: 12 * u,
        background: rgba("neutral-100", 0.7),
        color: toHex("neutral-600"),
        fontFamily: "var(--font-body)",
        fontSize: 24 * u,
        fontWeight: 600,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        textAlign: "center",
        lineHeight: 1.4,
        overflow: "hidden",
        ...style,
      }}
    >
      {label}
    </div>
  );
}

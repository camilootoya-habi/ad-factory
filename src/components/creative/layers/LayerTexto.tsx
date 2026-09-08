import { toHex } from "@/lib/brand/colors";
import { boxToPx, fontStyle } from "@/lib/creative/layout";
import { FORMATS, unitFor } from "@/lib/creative/scale";
import type { Callout, Format, Texto } from "@/lib/creative/types";
import { lineCount, renderRuns, Z, type LayerProps } from "./shared";
import { TextBlock } from "./TextBlock";

/** Diámetro del punto de callout y grosor de su línea, en cu (ref. 3). */
const DOT_CU = 32;
const LINE_CU = 3;
const DOT_STROKE_CU = 2;

function Bullets({ texto, format, color }: { texto: Texto; format: Format; color: string }) {
  const px = boxToPx(texto.box, format);
  const font = fontStyle(texto.size, format, { lineHeight: texto.lineHeight });
  const dot = font.fontSize * 0.28;
  const justify = texto.align === "center" ? "center" : texto.align === "right" ? "flex-end" : "flex-start";
  return (
    <div
      data-layer="texto-bullets"
      style={{ position: "absolute", left: px.left, top: px.top, width: px.width, height: px.height, zIndex: Z.texto, color, ...font }}
    >
      {texto.bullets!.map((line, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: justify, gap: font.fontSize * 0.35 }}>
          <span
            style={{
              flex: "none",
              width: dot,
              height: dot,
              borderRadius: 999,
              background: color,
              marginTop: (font.fontSize * font.lineHeight - dot) / 2,
            }}
          />
          <span style={{ textAlign: texto.align }}>{renderRuns(line, color, font.fontWeight)}</span>
        </div>
      ))}
    </div>
  );
}

type Segment = { x1: number; y1: number; x2: number; y2: number } | null;

/**
 * Punto de conexión: del centro del punto al borde más cercano de la caja del texto.
 * Si el punto queda dentro del rango vertical/horizontal de la caja la línea sale recta,
 * como en la referencia; si no, va al punto del borde más próximo.
 */
function connector(c: Callout, texto: Texto, format: Format): Segment {
  const { w, h } = FORMATS[format];
  const dx = (c.dot[0] / 100) * w;
  const dy = (c.dot[1] / 100) * h;
  const px = boxToPx(c.box, format);
  const font = fontStyle(c.size ?? texto.size, format, { lineHeight: texto.lineHeight });
  const height = px.height ?? lineCount(c.runs) * font.fontSize * font.lineHeight;
  const x1 = px.left;
  const x2 = px.left + px.width;
  const y1 = px.top;
  const y2 = px.top + height;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  if (dx > x2) return { x1: dx, y1: dy, x2, y2: clamp(dy, y1, y2) }; // caja a la izquierda → borde derecho
  if (dx < x1) return { x1: dx, y1: dy, x2: x1, y2: clamp(dy, y1, y2) }; // caja a la derecha → borde izquierdo
  if (dy > y2) return { x1: dx, y1: dy, x2: clamp(dx, x1, x2), y2 }; // caja arriba → borde inferior
  if (dy < y1) return { x1: dx, y1: dy, x2: clamp(dx, x1, x2), y2: y1 }; // caja abajo → borde superior
  return null; // el punto cae dentro de la caja: no hay línea
}

function Callouts({ texto, format, color }: { texto: Texto; format: Format; color: string }) {
  const { w, h } = FORMATS[format];
  const u = unitFor(format);
  const callouts = texto.callouts!;
  return (
    <>
      <svg
        data-layer="texto-callouts"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden
        style={{ position: "absolute", inset: 0, zIndex: Z.texto, pointerEvents: "none", overflow: "visible" }}
      >
        {callouts.map((c, i) => {
          const seg = connector(c, texto, format);
          const stroke = toHex(c.color, "white");
          const cx = (c.dot[0] / 100) * w;
          const cy = (c.dot[1] / 100) * h;
          return (
            <g key={i}>
              {seg && <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} stroke={stroke} strokeWidth={LINE_CU * u} />}
              <circle cx={cx} cy={cy} r={(DOT_CU * u) / 2} fill={toHex("white")} stroke={stroke} strokeWidth={DOT_STROKE_CU * u} />
            </g>
          );
        })}
      </svg>
      {callouts.map((c, i) => (
        <TextBlock
          key={i}
          layer="texto-callout"
          runs={c.runs}
          box={c.box}
          size={c.size ?? texto.size}
          align={c.align}
          color={color}
          format={format}
          zIndex={Z.texto}
          overrides={{ lineHeight: texto.lineHeight }}
        />
      ))}
    </>
  );
}

/** Capa 4: texto de apoyo. Párrafo de runs, bullets (una línea por Run[]) y/o callouts. */
export function LayerTexto({ spec, format }: LayerProps) {
  const t = spec.texto;
  if (!t) return null;
  const color = toHex(t.color, "neutral-900");
  return (
    <>
      {t.runs && t.runs.length > 0 && (
        <TextBlock
          layer="texto"
          runs={t.runs}
          box={t.box}
          size={t.size}
          align={t.align}
          color={color}
          format={format}
          zIndex={Z.texto}
          overrides={{ lineHeight: t.lineHeight }}
        />
      )}
      {t.bullets && t.bullets.length > 0 && <Bullets texto={t} format={format} color={color} />}
      {t.callouts && t.callouts.length > 0 && <Callouts texto={t} format={format} color={color} />}
    </>
  );
}

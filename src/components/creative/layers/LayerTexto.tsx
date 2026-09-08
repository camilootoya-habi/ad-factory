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
/** Longitud del trazo que sale del punto hacia el protagonista (≈7% y ≈4% del canvas). */
const LEAD_H_CU = 78;
const LEAD_V_CU = 44;

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
 * La línea nace en el punto y avanza HACIA EL PROTAGONISTA, es decir en dirección contraria
 * a la caja del texto: el punto queda pegado al texto y el trazo apunta a la casa, como en
 * la referencia 3. Se toma la dirección dominante (horizontal o vertical).
 */
function connector(c: Callout, texto: Texto, format: Format): Segment {
  const { w, h } = FORMATS[format];
  const u = unitFor(format);
  const dx = (c.dot[0] / 100) * w;
  const dy = (c.dot[1] / 100) * h;
  const px = boxToPx(c.box, format);
  const font = fontStyle(c.size ?? texto.size, format, { lineHeight: texto.lineHeight });
  const height = px.height ?? lineCount(c.runs) * font.fontSize * font.lineHeight;
  const cx = px.left + px.width / 2;
  const cy = px.top + height / 2;
  const ddx = dx - cx;
  const ddy = dy - cy;

  if (Math.abs(ddx) >= Math.abs(ddy)) {
    const lead = (ddx >= 0 ? 1 : -1) * LEAD_H_CU * u;
    return { x1: dx, y1: dy, x2: dx + lead, y2: dy };
  }
  const lead = (ddy >= 0 ? 1 : -1) * LEAD_V_CU * u;
  return { x1: dx, y1: dy, x2: dx, y2: dy + lead };
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

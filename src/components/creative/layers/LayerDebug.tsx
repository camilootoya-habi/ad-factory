import { boxToPx, ctaBoxPx, type PxBox } from "@/lib/creative/layout";
import { unitFor } from "@/lib/creative/scale";
import { Z, type LayerProps } from "./shared";

/** Contorno de una caja de slot con su etiqueta. Colores CSS con nombre: es depuración, no marca. */
function Outline({ box, label, color, u }: { box: PxBox; label: string; color: string; u: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height ?? 2 * u,
        border: `${1.5 * u}px dashed ${color}`,
        boxSizing: "border-box",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0,
          top: -20 * u,
          fontFamily: "var(--font-body)",
          fontSize: 14 * u,
          fontWeight: 600,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** Capa 9: cajas de todos los slots (debug.boxes). */
export function LayerDebug({ spec, format }: LayerProps) {
  const u = unitFor(format);
  return (
    <div data-layer="debug" style={{ position: "absolute", inset: 0, zIndex: Z.debug, pointerEvents: "none" }}>
      {spec.titulo && <Outline box={boxToPx(spec.titulo.box, format)} label="titulo" color="cyan" u={u} />}
      {spec.texto && spec.texto.box.w > 0 && <Outline box={boxToPx(spec.texto.box, format)} label="texto" color="lime" u={u} />}
      {spec.texto?.callouts?.map((c, i) => (
        <Outline key={i} box={boxToPx(c.box, format)} label={`callout ${i + 1}`} color="lime" u={u} />
      ))}
      {spec.cta && <Outline box={ctaBoxPx(spec.cta, format)} label={`cta · ${spec.cta.variant}`} color="orange" u={u} />}
    </div>
  );
}

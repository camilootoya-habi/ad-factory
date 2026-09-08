import { rgba, toHex } from "@/lib/brand/colors";
import { ctaBoxPx, ctaDefaultSize, fontStyle } from "@/lib/creative/layout";
import { unitFor } from "@/lib/creative/scale";
import type { Cta, Format } from "@/lib/creative/types";
import { renderRuns, Z, type LayerProps } from "./shared";

type GlyphKind = NonNullable<Cta["glyph"]>;

/** Glifos del CTA como SVG inline: círculo `bg` con símbolo `fg`. */
function Glyph({ kind, size, bg, fg }: { kind: GlyphKind; size: number; bg: string; fg: string }) {
  if (kind === "none") return null;
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden style={{ flex: "none", display: "block" }}>
      <circle cx="30" cy="30" r="30" fill={bg} />
      {kind === "play" && <path d="M24 18 L43 30 L24 42 Z" fill={fg} stroke={fg} strokeWidth="3" strokeLinejoin="round" />}
      {kind === "chevron-down" && (
        <path d="M18 24 L30 36 L42 24" fill="none" stroke={fg} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === "arrow-right" && (
        <path d="M18 30 H42 M32 20 L42 30 L32 40" fill="none" stroke={fg} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** Pastilla dentro de un contenedor redondeado; a la derecha queda ~20% para el logo in-cta. */
function PillInContainer({
  cta,
  format,
  containerDefault,
  pillDefault,
}: {
  cta: Cta;
  format: Format;
  containerDefault: "purple-400" | "white";
  pillDefault: "purple-900" | "purple-700";
}) {
  const u = unitFor(format);
  const box = ctaBoxPx(cta, format);
  const font = fontStyle(cta.size ?? ctaDefaultSize(cta.variant), format);
  const glyph: GlyphKind = cta.glyph ?? "play";
  const pillH = box.height * 0.55;
  const containerColor = toHex(cta.containerColor, containerDefault);
  const pillColor = toHex(cta.pillColor, pillDefault);
  const textColor = toHex(cta.textColor, "white");
  const glyphSize = Math.min(60 * u, pillH * 0.72);

  return (
    <div
      data-layer="cta"
      data-variant={cta.variant}
      style={{
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        zIndex: Z.cta,
        borderRadius: 34 * u,
        background: containerColor,
        display: "flex",
        alignItems: "center",
        paddingLeft: 30 * u,
        paddingRight: box.width * 0.2,
      }}
    >
      <div
        style={{
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          height: pillH,
          borderRadius: 999,
          background: pillColor,
          paddingLeft: 40 * u,
          paddingRight: glyph === "none" ? 40 * u : 14 * u,
          gap: 22 * u,
          color: textColor,
          whiteSpace: "nowrap",
          ...font,
        }}
      >
        <span>{renderRuns(cta.label, textColor, font.fontWeight)}</span>
        <Glyph kind={glyph} size={glyphSize} bg={toHex("white")} fg={pillColor} />
      </div>
    </div>
  );
}

/** Pastilla blanca sola, texto morado en bold y chevron (ref. 3). */
function PillOnly({ cta, format }: { cta: Cta; format: Format }) {
  const u = unitFor(format);
  const box = ctaBoxPx(cta, format);
  const font = fontStyle(cta.size ?? ctaDefaultSize(cta.variant), format, { weight: 700 });
  const glyph: GlyphKind = cta.glyph ?? "chevron-down";
  const pillColor = toHex(cta.pillColor, "white");
  const textColor = toHex(cta.textColor, "purple-800");
  return (
    <div
      data-layer="cta"
      data-variant={cta.variant}
      style={{
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        zIndex: Z.cta,
        borderRadius: 999,
        background: pillColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 20 * u,
        padding: `0 ${24 * u}px`,
        color: textColor,
        whiteSpace: "nowrap",
        ...font,
      }}
    >
      <span>{renderRuns(cta.label, textColor, 700)}</span>
      <Glyph kind={glyph} size={Math.min(60 * u, box.height * 0.7)} bg={textColor} fg={pillColor} />
    </div>
  );
}

/** Badge con gradiente oscuro y brillo, recto a la izquierda (puede salir del canvas), texto grande. */
function Badge({ cta, format }: { cta: Cta; format: Format }) {
  const u = unitFor(format);
  const box = ctaBoxPx(cta, format);
  const font = fontStyle(cta.size ?? ctaDefaultSize(cta.variant), format, { weight: 700 });
  const textColor = toHex(cta.textColor, "white");
  const r = 60 * u;
  return (
    <div
      data-layer="cta"
      data-variant={cta.variant}
      style={{
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        zIndex: Z.cta,
        borderRadius: `0 ${r}px ${r}px 0`,
        backgroundImage: [
          `linear-gradient(180deg, ${rgba("white", 0.14)} 0%, ${rgba("white", 0)} 55%)`,
          `linear-gradient(90deg, ${toHex("purple-950")} 0%, ${toHex("purple-700")} 55%, ${toHex("purple-600")} 100%)`,
        ].join(", "),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: textColor,
        whiteSpace: "nowrap",
        ...font,
      }}
    >
      <span>{renderRuns(cta.label, textColor, 700)}</span>
    </div>
  );
}

/** Capa 5: llamado a la acción. Son divs, no botones: la pieza es una imagen. */
export function LayerCta({ spec, format }: LayerProps) {
  const cta = spec.cta;
  if (!cta) return null;
  switch (cta.variant) {
    case "pastilla-oscura-sobre-lila":
      return <PillInContainer cta={cta} format={format} containerDefault="purple-400" pillDefault="purple-900" />;
    case "pastilla-morada-sobre-blanco":
      return <PillInContainer cta={cta} format={format} containerDefault="white" pillDefault="purple-700" />;
    case "pastilla-blanca":
      return <PillOnly cta={cta} format={format} />;
    case "badge-gradiente":
      return <Badge cta={cta} format={format} />;
  }
}

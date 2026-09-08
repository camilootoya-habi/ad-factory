import {
  checkLogoHeight,
  clearSpaceFor,
  logoReservedBox,
  logoSrc,
  logoWidthFor,
  pickTreatment,
  sanitizeLogoStyle,
} from "@/lib/brand/logo";
import { backgroundKindUnder, ctaBoxPx } from "@/lib/creative/layout";
import { FORMATS, unitFor } from "@/lib/creative/scale";
import type { LogoTreatment } from "@/lib/creative/types";
import { Z, type LayerProps } from "./shared";

const DEFAULT_MARGIN_CU = 48;

/**
 * Capa 6: logo de Habi según las reglas del brand center (brand/logo.ts). Tratamiento
 * "auto" mira lo que hay realmente debajo; el estilo pasa por sanitizeLogoStyle.
 */
export function LayerLogo({ spec, format, showClearSpace }: LayerProps & { showClearSpace?: boolean }) {
  const { logo } = spec;
  const { w, h } = FORMATS[format];
  const u = unitFor(format);
  const logoFormat = logo.format ?? "completo";
  const heightPx = logo.heightCu * u;
  const check = checkLogoHeight(heightPx);

  if (check.level === "error") {
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div
        data-layer="logo-error"
        style={{
          position: "absolute",
          right: 16 * u,
          bottom: 16 * u,
          zIndex: Z.debug,
          padding: `${8 * u}px ${12 * u}px`,
          borderRadius: 8 * u,
          background: "var(--color-content-error)",
          color: "var(--color-content-inverse)",
          fontFamily: "var(--font-body)",
          fontSize: 18 * u,
          fontWeight: 600,
          lineHeight: 1.3,
          maxWidth: w * 0.5,
        }}
      >
        {check.message}
      </div>
    );
  }

  const treatment: LogoTreatment =
    !logo.treatment || logo.treatment === "auto" ? pickTreatment(backgroundKindUnder(spec, logo.slot)) : logo.treatment;
  const width = logoWidthFor(logoFormat, heightPx);
  const margin = (logo.marginCu ?? DEFAULT_MARGIN_CU) * u;

  let left: number;
  let top: number;
  // Si el slot es in-cta pero no hay CTA, cae a la esquina inferior derecha.
  const slot = logo.slot === "in-cta" && !spec.cta ? "bottom-right" : logo.slot;

  switch (slot) {
    case "top-center":
      left = (w - width) / 2;
      top = margin;
      break;
    case "top-left":
      left = margin;
      top = margin;
      break;
    case "top-right":
      left = w - margin - width;
      top = margin;
      break;
    case "bottom-left":
      left = margin;
      top = h - margin - heightPx;
      break;
    case "bottom-right":
      left = w - margin - width;
      top = h - margin - heightPx;
      break;
    case "in-cta": {
      // Centrado en la franja derecha (~20%) que el CTA deja libre, nunca dentro del clear space.
      const box = ctaBoxPx(spec.cta!, format);
      const zone = box.width * 0.2;
      const padRight = Math.max((zone - width) / 2, clearSpaceFor(logoFormat, heightPx));
      left = box.left + box.width - padRight - width;
      top = box.top + (box.height - heightPx) / 2;
      break;
    }
  }

  const style = sanitizeLogoStyle({
    position: "absolute" as const,
    left,
    top,
    height: heightPx,
    width: "auto" as const,
    zIndex: Z.logo,
  });

  const reserved = logoReservedBox(logoFormat, heightPx);

  return (
    <>
      <img data-layer="logo" data-slot={slot} data-treatment={treatment} src={logoSrc(logoFormat, treatment)} alt="" draggable={false} style={style} />
      {showClearSpace && (
        <div
          data-layer="logo-clearspace"
          style={{
            position: "absolute",
            left: left - reserved.clearSpace,
            top: top - reserved.clearSpace,
            width: reserved.width,
            height: reserved.height,
            zIndex: Z.debug,
            border: `${2 * u}px dashed magenta`,
            pointerEvents: "none",
            boxSizing: "border-box",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 0,
              top: -22 * u,
              fontFamily: "var(--font-body)",
              fontSize: 14 * u,
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "magenta",
              whiteSpace: "nowrap",
            }}
          >
            clear space
          </span>
        </div>
      )}
    </>
  );
}

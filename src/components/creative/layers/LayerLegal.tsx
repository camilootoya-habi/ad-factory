import { backgroundKindUnder, fontStyle, inkOver } from "@/lib/creative/layout";
import { unitFor } from "@/lib/creative/scale";
import { Z, type LayerProps } from "./shared";

const MARGIN_CU = 28;

/** Capa 7: legal en caption, abajo a la derecha ("*AplicanTyC", ref. 3). */
export function LayerLegal({ spec, format }: LayerProps) {
  if (!spec.legal) return null;
  const u = unitFor(format);
  const font = fontStyle("caption", format);
  return (
    <div
      data-layer="legal"
      style={{
        position: "absolute",
        right: MARGIN_CU * u,
        bottom: MARGIN_CU * u,
        zIndex: Z.legal,
        color: inkOver(backgroundKindUnder(spec, "bottom-right")),
        whiteSpace: "nowrap",
        ...font,
      }}
    >
      {spec.legal}
    </div>
  );
}

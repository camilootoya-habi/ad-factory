import type { CSSProperties } from "react";
import { boxToPx, fontStyle, type FontOverrides } from "@/lib/creative/layout";
import type { AdScaleStep, Box, Format, Run } from "@/lib/creative/types";
import { renderRuns } from "./shared";

export type TextBlockProps = {
  runs: Run[];
  box: Box;
  size: AdScaleStep;
  align: "left" | "center" | "right";
  /** Hex ya resuelto. */
  color: string;
  format: Format;
  zIndex: number;
  overrides?: FontOverrides;
  layer: string;
  style?: CSSProperties;
};

/** Bloque de texto posicionado por caja: base de título, texto y callouts. */
export function TextBlock({ runs, box, size, align, color, format, zIndex, overrides, layer, style }: TextBlockProps) {
  const px = boxToPx(box, format);
  const font = fontStyle(size, format, overrides);
  return (
    <div
      data-layer={layer}
      style={{
        position: "absolute",
        left: px.left,
        top: px.top,
        width: px.width,
        height: px.height,
        zIndex,
        textAlign: align,
        color,
        whiteSpace: "normal",
        overflowWrap: "normal",
        ...font,
        ...style,
      }}
    >
      {renderRuns(runs, color, font.fontWeight)}
    </div>
  );
}

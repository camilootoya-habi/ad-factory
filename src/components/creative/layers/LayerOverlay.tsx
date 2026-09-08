import { overlayCss } from "@/lib/creative/layout";
import { Z, type LayerProps } from "./shared";

/** Capa 1: velo de marca en degradado diagonal sobre la foto. */
export function LayerOverlay({ spec }: LayerProps) {
  if (!spec.overlay) return null;
  return (
    <div
      data-layer="overlay"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: Z.overlay,
        pointerEvents: "none",
        backgroundImage: overlayCss(spec.overlay),
      }}
    />
  );
}

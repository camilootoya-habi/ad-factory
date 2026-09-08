import { anchorStyle } from "@/lib/creative/layout";
import type { ProtagonistaAttrs } from "@/lib/creative/types";
import { describeRecipe, Placeholder, Z, type LayerProps } from "./shared";

/** Proporción ancho/alto del placeholder según el encuadre (la imagen real trae la suya). */
function placeholderAspect(recipe?: ProtagonistaAttrs): number {
  switch (recipe?.encuadre) {
    case "cuerpo-completo":
      return 0.6;
    case "medio-cuerpo":
      return 0.8;
    case "detalle":
      return 1.3;
    default:
      return 1;
  }
}

/**
 * Capa 2: recorte del protagonista. Con blend "multiply" (grafiti del preset 01) la imagen
 * se genera sobre blanco y se multiplica sobre el muro: los blancos desaparecen.
 */
export function LayerProtagonista({ spec, format, url }: LayerProps & { url?: string }) {
  const p = spec.protagonista;
  if (!p) return null;

  const pos = anchorStyle(p, format);
  const common = {
    position: "absolute" as const,
    zIndex: Z.protagonista,
    left: pos.left,
    right: pos.right,
    top: pos.top,
    bottom: pos.bottom,
    width: pos.width,
    transform: pos.transform,
  };

  if (!url) {
    return (
      <Placeholder
        format={format}
        label={describeRecipe("protagonista", p.recipe, p.assetHash)}
        style={{ ...common, height: pos.width / placeholderAspect(p.recipe) }}
      />
    );
  }

  return (
    <img
      data-layer="protagonista"
      src={url}
      alt=""
      draggable={false}
      style={{
        ...common,
        height: "auto",
        mixBlendMode: p.blend && p.blend !== "normal" ? p.blend : undefined,
        opacity: p.opacity ?? 1,
      }}
    />
  );
}

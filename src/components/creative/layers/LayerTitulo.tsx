import { toHex } from "@/lib/brand/colors";
import { Z, type LayerProps } from "./shared";
import { TextBlock } from "./TextBlock";

/** Capa 3: título. Runs con peso/color propio; color por defecto del slot o neutral-900. */
export function LayerTitulo({ spec, format }: LayerProps) {
  const t = spec.titulo;
  if (!t || t.runs.length === 0) return null;
  return (
    <TextBlock
      layer="titulo"
      runs={t.runs}
      box={t.box}
      size={t.size}
      align={t.align}
      color={toHex(t.color, "neutral-900")}
      format={format}
      zIndex={Z.titulo}
      overrides={{ lineHeight: t.lineHeight, letterSpacing: t.letterSpacing }}
    />
  );
}

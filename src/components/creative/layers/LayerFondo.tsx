import { toHex } from "@/lib/brand/colors";
import { gradientCss } from "@/lib/creative/layout";
import { unitFor } from "@/lib/creative/scale";
import { describeRecipe, Placeholder, Z, type LayerProps } from "./shared";

const FULL = { position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: Z.fondo } as const;

/** Capa 0: foto (cover + focal + blur), color plano o gradiente. */
export function LayerFondo({ spec, format, url }: LayerProps & { url?: string }) {
  const { fondo } = spec;

  if (fondo.kind === "plano") return <div data-layer="fondo" style={{ ...FULL, background: toHex(fondo.color) }} />;

  if (fondo.kind === "gradiente") return <div data-layer="fondo" style={{ ...FULL, backgroundImage: gradientCss(fondo) }} />;

  if (!url) {
    return (
      <Placeholder
        format={format}
        label={describeRecipe("fondo", fondo.recipe, fondo.assetHash)}
        style={{ ...FULL, borderRadius: 0 }}
      />
    );
  }

  const u = unitFor(format);
  const [fx, fy] = fondo.focal ?? [50, 50];
  const blurPx = (fondo.blurCu ?? 0) * u;
  // Al desenfocar, el borde se aclara: un zoom leve lo saca del canvas.
  const scale = fondo.scale ?? (blurPx > 0 ? 1 + (blurPx * 2) / 1080 : 1);

  return (
    <img
      data-layer="fondo"
      src={url}
      alt=""
      draggable={false}
      style={{
        ...FULL,
        objectFit: "cover",
        objectPosition: `${fx}% ${fy}%`,
        filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "center",
      }}
    />
  );
}
